import { getAuth, unauthorized, serverError } from '@/lib/auth';
import { checkBadges, collectStats, progressRatio, type Badge } from '@/lib/gamification';

export const dynamic = 'force-dynamic';

/**
 * Badges for the signed-in learner: the full catalogue annotated with
 * what they have earned and how far along they are on the rest.
 */
export async function GET() {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const { supabase, user } = auth;

  try {
    // Evaluate first so the response reflects anything just unlocked.
    const awarded = await checkBadges(supabase, user.id);

    const [{ data: catalogue }, { data: earned }, stats] = await Promise.all([
      supabase.from('badges').select('*').eq('active', true).order('sort_order'),
      supabase.from('user_badges').select('badge_id, earned_at, seen, progress').eq('user_id', user.id),
      collectStats(supabase, user.id),
    ]);

    const earnedMap = new Map((earned ?? []).map((e) => [e.badge_id, e]));

    const badges = ((catalogue ?? []) as Badge[]).map((b) => {
      const mine = earnedMap.get(b.id);
      return {
        code: b.code,
        title_fa: b.title_fa,
        description_fa: b.description_fa,
        icon: b.icon,
        tier: b.tier,
        earned: Boolean(mine),
        earned_at: mine?.earned_at ?? null,
        seen: mine?.seen ?? true,
        progress: mine ? 1 : progressRatio(b.criteria, stats),
        threshold: b.criteria?.threshold ?? 1,
      };
    });

    return Response.json({
      badges,
      earned_count: badges.filter((b) => b.earned).length,
      total_count: badges.length,
      newly_awarded: awarded,
      stats,
    });
  } catch (e) {
    console.error('[badges]', e);
    return serverError('دریافت نشان‌ها ناموفق بود.');
  }
}

/** Mark badges as seen so the celebration toast stops reappearing. */
export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const { supabase, user } = auth;

  try {
    const body = await req.json().catch(() => ({}));
    const codes: string[] = Array.isArray(body?.codes) ? body.codes.slice(0, 50) : [];

    let query = supabase.from('user_badges').update({ seen: true }).eq('user_id', user.id);

    if (codes.length) {
      const { data: ids } = await supabase.from('badges').select('id').in('code', codes);
      const badgeIds = (ids ?? []).map((b) => b.id);
      if (!badgeIds.length) return Response.json({ ok: true, updated: 0 });
      query = query.in('badge_id', badgeIds);
    }

    const { error } = await query.eq('seen', false);
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (e) {
    console.error('[badges:seen]', e);
    return serverError();
  }
}
