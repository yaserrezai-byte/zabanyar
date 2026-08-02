import { getAuth, unauthorized, serverError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

/**
 * Opt-in leaderboard.
 *
 * Reads public.leaderboard_view, which already filters to
 * show_on_leaderboard = true and exposes no email or per-user
 * learning data. Learners who have not opted in are invisible here —
 * including to themselves.
 */
export async function GET(req: Request) {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const { supabase, user } = auth;

  const url = new URL(req.url);
  const period = url.searchParams.get('period') === 'weekly' ? 'weekly' : 'all';
  const page = Math.max(0, Number(url.searchParams.get('page') ?? 0) || 0);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(url.searchParams.get('limit') ?? PAGE_SIZE) || PAGE_SIZE)
  );

  const sortColumn = period === 'weekly' ? 'weekly_xp' : 'total_xp';

  try {
    const [listRes, meRes, optinRes] = await Promise.all([
      supabase
        .from('leaderboard_view')
        .select('user_id, name, current_level, streak_days, total_xp, weekly_xp, active_days_7, badge_count',
                { count: 'exact' })
        .order(sortColumn, { ascending: false })
        .order('streak_days', { ascending: false })
        .range(page * limit, page * limit + limit - 1),
      supabase
        .from('leaderboard_view')
        .select('user_id, name, total_xp, weekly_xp, streak_days, badge_count')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('show_on_leaderboard, display_name')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    if (listRes.error) throw listRes.error;

    const rows = (listRes.data ?? []).map((r, i) => ({
      rank: page * limit + i + 1,
      // Never return the raw id for other people — only a flag.
      is_me: r.user_id === user.id,
      name: r.name,
      current_level: r.current_level,
      streak_days: r.streak_days,
      xp: period === 'weekly' ? r.weekly_xp : r.total_xp,
      active_days_7: r.active_days_7,
      badge_count: r.badge_count,
    }));

    // The caller's own rank, even when they are past the current page.
    let myRank: number | null = null;
    if (meRes.data) {
      const myXp = period === 'weekly' ? meRes.data.weekly_xp : meRes.data.total_xp;
      const { count } = await supabase
        .from('leaderboard_view')
        .select('user_id', { count: 'exact', head: true })
        .gt(sortColumn, myXp);
      myRank = (count ?? 0) + 1;
    }

    return Response.json({
      period,
      page,
      limit,
      total: listRes.count ?? rows.length,
      rows,
      opted_in: Boolean(optinRes.data?.show_on_leaderboard),
      display_name: optinRes.data?.display_name ?? null,
      me: meRes.data
        ? {
            rank: myRank,
            xp: period === 'weekly' ? meRes.data.weekly_xp : meRes.data.total_xp,
            streak_days: meRes.data.streak_days,
            badge_count: meRes.data.badge_count,
          }
        : null,
    });
  } catch (e) {
    console.error('[leaderboard]', e);
    return serverError('دریافت جدول امتیاز ناموفق بود.');
  }
}
