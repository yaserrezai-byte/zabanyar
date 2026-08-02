import { z } from 'zod';
import { getAuth, unauthorized, badRequest, serverError } from '@/lib/auth';
import { scenarioById, scenariosForLevel } from '@/lib/group-chat';
import type { CefrLevel } from '@/types/db';

export const dynamic = 'force-dynamic';

const Body = z.object({
  scenario_id: z.string().min(1).max(60),
  max_participants: z.coerce.number().int().min(2).max(8).optional(),
});

/**
 * Matchmaking: put the learner into an open room at their own CEFR
 * level, or open a new one. The heavy lifting is join_group_session()
 * in the database, which uses FOR UPDATE SKIP LOCKED so two learners
 * racing for the last seat cannot both win it.
 */
export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const { supabase, user } = auth;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return badRequest('سناریوی نامعتبر است.');
  }

  const scenario = scenarioById(body.scenario_id);
  if (!scenario) return badRequest('این سناریو وجود ندارد.');

  try {
    // Level: prefer the placement result, else the speaking skill.
    const [{ data: profile }, { data: speaking }] = await Promise.all([
      supabase.from('profiles').select('current_level, full_name').eq('id', user.id).maybeSingle(),
      supabase.from('skill_levels').select('level').eq('user_id', user.id).eq('skill', 'speaking').maybeSingle(),
    ]);

    const level = (profile?.current_level ?? speaking?.level ?? 'A2') as CefrLevel;

    if (!scenariosForLevel(level).some((s) => s.id === scenario.id)) {
      return badRequest(
        `این سناریو برای سطح ${scenario.minLevel} و بالاتر است. سطح فعلی شما ${level} است.`
      );
    }

    // Opportunistic housekeeping — cheap, and keeps stale rooms out of
    // matchmaking without needing a cron job.
    await supabase.rpc('expire_idle_group_sessions', { idle_minutes: 10 });

    const { data: sessionId, error } = await supabase.rpc('join_group_session', {
      p_scenario: scenario.id,
      p_topic: scenario.topic,
      p_topic_fa: scenario.topic_fa,
      p_level: level,
      p_max: body.max_participants ?? 4,
    });

    if (error) throw error;

    const [{ data: session }, { data: participants }] = await Promise.all([
      supabase.from('group_sessions').select('*').eq('id', sessionId).single(),
      supabase
        .from('group_participants')
        .select('user_id, joined_at, message_count, profiles(full_name, display_name, current_level)')
        .eq('session_id', sessionId)
        .is('left_at', null),
    ]);

    return Response.json({
      session_id: sessionId,
      session,
      level,
      me: user.id,
      participants: (participants ?? []).map((p) => {
        const prof = p.profiles as unknown as
          { full_name: string | null; display_name: string | null; current_level: string | null } | null;
        return {
          user_id: p.user_id,
          name: prof?.display_name || prof?.full_name || 'زبان‌آموز',
          level: prof?.current_level ?? null,
          is_me: p.user_id === user.id,
          message_count: p.message_count,
        };
      }),
    });
  } catch (e) {
    console.error('[group/join]', e);
    return serverError('ورود به گفت‌وگوی گروهی ناموفق بود.');
  }
}
