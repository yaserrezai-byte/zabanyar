import { z } from 'zod';
import { getAuth, unauthorized, badRequest, forbidden, serverError } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { groupGuideTurn } from '@/lib/ai/service';
import {
  MESSAGE_COOLDOWN_MS,
  moderate,
  scenarioById,
  seedFrom,
  shouldGuideSpeak,
} from '@/lib/group-chat';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  session_id: z.string().uuid(),
  text: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const { supabase, user } = auth;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return badRequest('پیام نامعتبر است.');
  }

  // ---------- content moderation (before anything is broadcast) ----------
  const verdict = moderate(body.text);
  if (!verdict.allowed) {
    return Response.json({ error: verdict.reason_fa, blocked: true }, { status: 422 });
  }

  try {
    // ---------- membership ----------
    const { data: membership } = await supabase
      .from('group_participants')
      .select('id, left_at')
      .eq('session_id', body.session_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || membership.left_at) {
      return forbidden('شما عضو این گفت‌وگو نیستید.');
    }

    // ---------- rate limit (server-side; the DB trigger is the backstop) ----------
    const { data: last } = await supabase
      .from('group_messages')
      .select('created_at')
      .eq('session_id', body.session_id)
      .eq('sender_id', user.id)
      .eq('sender_type', 'user')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (last) {
      const elapsed = Date.now() - new Date(last.created_at).getTime();
      if (elapsed < MESSAGE_COOLDOWN_MS) {
        return Response.json(
          {
            error: 'کمی آهسته‌تر! هر ۲ ثانیه می‌توانید یک پیام بفرستید.',
            retry_after_ms: MESSAGE_COOLDOWN_MS - elapsed,
          },
          { status: 429 }
        );
      }
    }

    // ---------- store the learner's message ----------
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, display_name')
      .eq('id', user.id)
      .maybeSingle();

    const senderName = profile?.display_name || profile?.full_name || 'زبان‌آموز';

    const { data: saved, error: insErr } = await supabase
      .from('group_messages')
      .insert({
        session_id: body.session_id,
        sender_type: 'user',
        sender_id: user.id,
        sender_name: senderName,
        content: body.text.trim(),
      })
      .select('id, created_at')
      .single();

    if (insErr) {
      // check_violation = the DB-level rate limit fired
      if (insErr.code === '23514' || /آهسته/.test(insErr.message)) {
        return Response.json({ error: 'کمی آهسته‌تر! هر ۲ ثانیه یک پیام.' }, { status: 429 });
      }
      throw insErr;
    }

    // Realtime delivers the INSERT to every subscriber, so there is no
    // manual broadcast here.

    await supabase
      .from('group_participants')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('session_id', body.session_id)
      .eq('user_id', user.id);

    // ---------- should the guide speak? ----------
    const [{ data: session }, { data: recent }, { data: present }] = await Promise.all([
      supabase.from('group_sessions')
        .select('scenario_id, topic, level_cefr, last_ai_at, message_count')
        .eq('id', body.session_id).single(),
      supabase.from('group_messages')
        .select('sender_type, sender_name, content, created_at')
        .eq('session_id', body.session_id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('group_participants')
        .select('user_id, profiles(full_name, display_name)')
        .eq('session_id', body.session_id)
        .is('left_at', null),
    ]);

    const history = (recent ?? []).slice().reverse();
    const lastAiIdx = history.map((m) => m.sender_type).lastIndexOf('ai');
    const messagesSinceAi = lastAiIdx === -1
      ? history.filter((m) => m.sender_type === 'user').length
      : history.slice(lastAiIdx + 1).filter((m) => m.sender_type === 'user').length;

    const lastAiAt = session?.last_ai_at ? new Date(session.last_ai_at).getTime() : null;
    const prevMsg = history[history.length - 2];

    const reason = shouldGuideSpeak({
      messagesSinceAi,
      msSinceAi: lastAiAt ? Date.now() - lastAiAt : Infinity,
      msSinceLastMessage: prevMsg ? Date.now() - new Date(prevMsg.created_at).getTime() : 0,
      activeParticipants: (present ?? []).length,
      totalMessages: history.filter((m) => m.sender_type === 'user').length,
    });

    let guide = null;
    if (reason !== 'none') {
      const names = (present ?? []).map((p) => {
        const prof = p.profiles as unknown as
          { full_name: string | null; display_name: string | null } | null;
        return prof?.display_name || prof?.full_name || 'زبان‌آموز';
      });

      const turn = await groupGuideTurn(reason, scenarioById(session?.scenario_id ?? ''), {
        level: session?.level_cefr ?? 'A2',
        participants: names,
        transcript: history.map((m) => ({
          name: m.sender_type === 'ai' ? 'Guide' : (m.sender_name ?? 'Learner'),
          content: m.content,
        })),
        seed: seedFrom(body.session_id, history.length, reason),
      });

      // AI rows violate the "sender_id must be set" shape for users and
      // are written with the service role, which bypasses RLS.
      const admin = createAdminClient();
      const { data: aiRow } = await admin
        .from('group_messages')
        .insert({
          session_id: body.session_id,
          sender_type: 'ai',
          sender_id: null,
          sender_name: 'راهنما',
          content: turn.content,
          translation_fa: turn.translation_fa,
          corrections: turn.corrections,
        })
        .select('id, created_at')
        .single();

      await admin
        .from('group_sessions')
        .update({ last_ai_at: new Date().toISOString() })
        .eq('id', body.session_id);

      guide = {
        id: aiRow?.id,
        content: turn.content,
        translation_fa: turn.translation_fa,
        corrections: turn.corrections,
        source: turn.source,
        reason,
      };
    }

    // ---------- credit the learner ----------
    await supabase.from('learning_history').insert({
      user_id: user.id,
      event_type: 'group_conversation_turn',
      skill: 'speaking',
      duration_sec: 45,
      xp: 4,
      meta: { session_id: body.session_id, scenario: session?.scenario_id },
    });

    return Response.json({
      ok: true,
      message_id: saved.id,
      created_at: saved.created_at,
      guide,
    });
  } catch (e) {
    console.error('[group/message]', e);
    return serverError('ارسال پیام ناموفق بود.');
  }
}
