// ============================================================
// زبان‌یار | Gamification helpers
//
// The authoritative badge evaluation lives in the database
// (public.award_badges) so it cannot be bypassed by a client.
// This module mirrors the same predicates in TypeScript so the
// rules are unit-testable and so the UI can show progress toward
// badges that have not been earned yet.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Badge {
  id: string;
  code: string;
  title_fa: string;
  description_fa: string;
  icon: string;
  criteria: BadgeCriteria;
  tier: BadgeTier;
  sort_order: number;
}

export interface BadgeCriteria {
  type: string;
  threshold?: number;
}

export interface EarnedBadge {
  badge_id: string;
  earned_at: string;
  seen: boolean;
  progress: { value?: number };
}

/** Everything award_badges() can measure, gathered once per check. */
export interface LearnerStats {
  totalEvents: number;
  totalXp: number;
  streakDays: number;
  placementDone: boolean;
  vocabReviewed: number;
  vocabMastered: number;
  messages: number;
  lessonsCompleted: number;
  pronunciationGood: number;
  flawlessStreak: number;
  earlyBird: boolean;
  nightOwl: boolean;
}

export const EMPTY_STATS: LearnerStats = {
  totalEvents: 0,
  totalXp: 0,
  streakDays: 0,
  placementDone: false,
  vocabReviewed: 0,
  vocabMastered: 0,
  messages: 0,
  lessonsCompleted: 0,
  pronunciationGood: 0,
  flawlessStreak: 0,
  earlyBird: false,
  nightOwl: false,
};

/**
 * Current measured value for a criteria type.
 * Booleans surface as 0/1 so progress bars work uniformly.
 */
export function measure(type: string, stats: LearnerStats): number {
  switch (type) {
    case 'total_events': return stats.totalEvents;
    case 'total_xp': return stats.totalXp;
    case 'streak': return stats.streakDays;
    case 'placement_done': return stats.placementDone ? 1 : 0;
    case 'vocab_reviewed': return stats.vocabReviewed;
    case 'vocab_mastered': return stats.vocabMastered;
    case 'messages': return stats.messages;
    case 'lessons_completed': return stats.lessonsCompleted;
    case 'pronunciation_good': return stats.pronunciationGood;
    case 'flawless_streak': return stats.flawlessStreak;
    case 'early_bird': return stats.earlyBird ? 1 : 0;
    case 'night_owl': return stats.nightOwl ? 1 : 0;
    default: return 0;
  }
}

/** Mirrors the SQL: value >= threshold (threshold defaults to 1). */
export function isEarned(criteria: BadgeCriteria, stats: LearnerStats): boolean {
  const value = measure(criteria.type, stats);
  const threshold = criteria.threshold ?? 1;
  return value >= threshold;
}

/** 0..1 progress toward a badge, for the locked-badge UI. */
export function progressRatio(criteria: BadgeCriteria, stats: LearnerStats): number {
  const value = measure(criteria.type, stats);
  const threshold = criteria.threshold ?? 1;
  if (threshold <= 0) return 1;
  return Math.max(0, Math.min(1, value / threshold));
}

/**
 * Longest run of consecutive graded submissions with zero recorded
 * errors. Mirrors the window function in award_badges().
 */
export function longestFlawlessRun(
  submissions: { errorCount: number }[]
): number {
  let best = 0;
  let run = 0;
  for (const s of submissions) {
    if (s.errorCount === 0) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/**
 * Streak length from a set of activity dates (YYYY-MM-DD).
 * Returns 0 when the most recent activity is older than yesterday,
 * matching the trigger's "gap resets the streak" behaviour.
 */
export function computeStreak(dates: string[], today = new Date()): number {
  if (!dates.length) return 0;

  const unique = Array.from(new Set(dates)).sort();
  const last = unique[unique.length - 1];

  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (last !== todayStr && last !== yesterdayStr) return 0;

  let streak = 1;
  for (let i = unique.length - 1; i > 0; i--) {
    const cur = new Date(unique[i] + 'T00:00:00Z');
    const prev = new Date(unique[i - 1] + 'T00:00:00Z');
    const diff = (cur.getTime() - prev.getTime()) / 86_400_000;
    if (diff === 1) streak += 1;
    else break;
  }
  return streak;
}

export const TIER_STYLE: Record<BadgeTier, { bg: string; fg: string; label: string }> = {
  bronze:   { bg: 'rgb(180 83 9 / .12)',   fg: '#b45309', label: 'برنز' },
  silver:   { bg: 'rgb(100 116 139 / .14)', fg: '#475569', label: 'نقره' },
  gold:     { bg: 'rgb(245 158 11 / .16)',  fg: '#b45309', label: 'طلا' },
  platinum: { bg: 'rgb(139 92 246 / .14)',  fg: '#6d28d9', label: 'پلاتین' },
};

/**
 * Collect every measurable statistic for a learner.
 * Runs through the caller's client, so RLS still applies.
 */
export async function collectStats(
  supabase: SupabaseClient,
  userId: string
): Promise<LearnerStats> {
  const [
    profileRes,
    historyRes,
    vocabRes,
    messagesRes,
    pronRes,
    submissionsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('streak_days, placement_done').eq('id', userId).maybeSingle(),
    supabase.from('learning_history').select('event_type, xp, created_at').eq('user_id', userId),
    supabase.from('vocabulary_memory').select('mastery').eq('user_id', userId),
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('role', 'user'),
    supabase.from('pronunciation_attempts').select('accuracy_score, source').eq('user_id', userId),
    supabase.from('submissions').select('ai_feedback, created_at').eq('user_id', userId)
      .not('graded_at', 'is', null).order('created_at', { ascending: true }),
  ]);

  const history = historyRes.data ?? [];
  const vocab = vocabRes.data ?? [];
  const pron = pronRes.data ?? [];
  const subs = submissionsRes.data ?? [];

  const hourIn = (iso: string) =>
    Number(
      new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit', hour12: false, timeZone: 'Asia/Tehran',
      }).format(new Date(iso))
    );

  return {
    totalEvents: history.length,
    totalXp: history.reduce((t, h) => t + (h.xp ?? 0), 0),
    streakDays: profileRes.data?.streak_days ?? 0,
    placementDone: Boolean(profileRes.data?.placement_done),
    vocabReviewed: history.filter((h) => h.event_type === 'vocab_reviewed').length,
    vocabMastered: vocab.filter((v) => Number(v.mastery) >= 0.8).length,
    messages: messagesRes.count ?? 0,
    lessonsCompleted: history.filter((h) => h.event_type === 'lesson_completed').length,
    pronunciationGood: pron.filter(
      (p) => Number(p.accuracy_score) >= 80 && p.source !== 'heuristic'
    ).length,
    flawlessStreak: longestFlawlessRun(
      subs.map((s) => {
        const fb = s.ai_feedback as { errors?: unknown[] } | null;
        return { errorCount: Array.isArray(fb?.errors) ? fb!.errors!.length : 0 };
      })
    ),
    earlyBird: history.some((h) => hourIn(h.created_at as string) < 7),
    nightOwl: history.some((h) => {
      const hr = hourIn(h.created_at as string);
      return hr >= 0 && hr <= 4;
    }),
  };
}

export interface AwardedBadge {
  code: string;
  title_fa: string;
  icon: string;
  tier: BadgeTier;
}

/**
 * Ask the database to evaluate and award badges. Safe to call after
 * every learning event: award_badges() is idempotent thanks to the
 * unique(user_id, badge_id) constraint, and returns only what was
 * newly granted by this call.
 *
 * Never throws — gamification must not break a learning flow.
 */
export async function checkBadges(
  supabase: SupabaseClient,
  userId?: string
): Promise<AwardedBadge[]> {
  try {
    const { data, error } = await supabase.rpc('award_badges', {
      target: userId ?? null,
    });
    if (error) {
      console.error('[gamification] award_badges:', error.message);
      return [];
    }
    return (data ?? []) as AwardedBadge[];
  } catch (err) {
    console.error('[gamification] award_badges threw:', err);
    return [];
  }
}
