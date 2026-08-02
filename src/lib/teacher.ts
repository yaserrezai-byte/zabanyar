// ============================================================
// زبان‌یار | Teacher panel data helpers (server-side)
//
// Every query here runs through the caller's own Supabase client, so
// RLS remains the real boundary: a teacher can only ever read rows for
// students whose profiles.teacher_id points at them. Nothing in this
// file uses the service role.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CefrLevel, SkillKind, StudentRosterRow } from '@/types/db';
import { daysAgo } from '@/utils/dates';

export interface StudentSummary extends StudentRosterRow {
  xp7: number;
  minutes7: number;
  activeDays7: number;
  avgAccuracy: number | null;
  openMistakes: number;
  pendingReview: number;
  lastEventAt: string | null;
}

/** The signed-in teacher's roster (all students when admin). */
export async function getRoster(
  supabase: SupabaseClient
): Promise<StudentRosterRow[]> {
  const { data, error } = await supabase.rpc('my_students');
  if (error) {
    console.error('[teacher] my_students:', error.message);
    return [];
  }
  return (data ?? []) as StudentRosterRow[];
}

/**
 * Roster enriched with 7-day activity, accuracy, open error patterns
 * and how many submissions still await manual review.
 *
 * Uses a small number of batched queries rather than N per student.
 */
export async function getRosterWithStats(
  supabase: SupabaseClient
): Promise<StudentSummary[]> {
  const roster = await getRoster(supabase);
  if (!roster.length) return [];

  const ids = roster.map((s) => s.id);
  const since = daysAgo(7);

  const [historyRes, mistakesRes, pendingRes] = await Promise.all([
    supabase
      .from('learning_history')
      .select('user_id, xp, duration_sec, accuracy, occurred_on, created_at')
      .in('user_id', ids)
      .gte('occurred_on', since),
    supabase
      .from('mistakes_memory')
      .select('user_id')
      .in('user_id', ids)
      .eq('resolved', false),
    supabase
      .from('submissions')
      .select('user_id')
      .in('user_id', ids)
      .is('teacher_feedback', null)
      .not('answer_text', 'is', null),
  ]);

  const history = historyRes.data ?? [];
  const mistakes = mistakesRes.data ?? [];
  const pending = pendingRes.data ?? [];

  const countBy = (rows: { user_id: string }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.user_id, (m.get(r.user_id) ?? 0) + 1);
    return m;
  };

  const mistakeCount = countBy(mistakes);
  const pendingCount = countBy(pending);

  return roster.map((s) => {
    const events = history.filter((h) => h.user_id === s.id);
    const accuracies = events
      .filter((e) => e.accuracy != null)
      .map((e) => Number(e.accuracy));
    const lastEvent = events
      .map((e) => e.created_at as string)
      .sort()
      .at(-1) ?? null;

    return {
      ...s,
      xp7: events.reduce((t, e) => t + (e.xp ?? 0), 0),
      minutes7: Math.round(
        events.reduce((t, e) => t + (e.duration_sec ?? 0), 0) / 60
      ),
      activeDays7: new Set(events.map((e) => e.occurred_on)).size,
      avgAccuracy: accuracies.length
        ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)
        : null,
      openMistakes: mistakeCount.get(s.id) ?? 0,
      pendingReview: pendingCount.get(s.id) ?? 0,
      lastEventAt: lastEvent,
    };
  });
}

/** Detail bundle for one student. Returns null when out of scope (RLS). */
export async function getStudentDetail(
  supabase: SupabaseClient,
  studentId: string
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, full_name, email, current_level, target_level, streak_days, daily_goal_min, interests, last_active_on, placement_done, created_at, teacher_id, role'
    )
    .eq('id', studentId)
    .maybeSingle();

  // RLS returns nothing when this student is not ours.
  if (!profile) return null;

  const since = daysAgo(30);

  const [skills, mistakes, submissions, history, assignments] = await Promise.all([
    supabase
      .from('skill_levels')
      .select('id, skill, level, score, confidence, assessed_at')
      .eq('user_id', studentId),
    supabase
      .from('mistakes_memory')
      .select('id, skill, error_tag, error_label_fa, description_fa, example_wrong, example_correct, occurrences, severity, resolved, last_seen_at')
      .eq('user_id', studentId)
      .order('occurrences', { ascending: false })
      .limit(12),
    supabase
      .from('submissions')
      .select('id, answer_text, score, is_correct, feedback_fa, teacher_feedback, teacher_score, teacher_feedback_at, created_at, assignment_id')
      .eq('user_id', studentId)
      .not('answer_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('learning_history')
      .select('event_type, skill, xp, duration_sec, accuracy, occurred_on')
      .eq('user_id', studentId)
      .gte('occurred_on', since)
      .order('occurred_on', { ascending: false }),
    supabase
      .from('assignments')
      .select('id, title, skill, status, due_at, created_at')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return {
    profile,
    skills: skills.data ?? [],
    mistakes: mistakes.data ?? [],
    submissions: submissions.data ?? [],
    history: history.data ?? [],
    assignments: assignments.data ?? [],
  };
}

/** Aggregate numbers for the teacher overview. */
export function summarise(students: StudentSummary[]) {
  const withLevel = students.filter((s) => s.current_level);
  const accuracies = students
    .map((s) => s.avgAccuracy)
    .filter((a): a is number => a != null);

  const levelOrder: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const byLevel = levelOrder.map((lv) => ({
    level: lv,
    count: students.filter((s) => s.current_level === lv).length,
  }));

  return {
    total: students.length,
    active7: students.filter((s) => s.activeDays7 > 0).length,
    inactive: students.filter((s) => s.activeDays7 === 0).length,
    avgAccuracy: accuracies.length
      ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)
      : null,
    totalMinutes7: students.reduce((t, s) => t + s.minutes7, 0),
    totalPending: students.reduce((t, s) => t + s.pendingReview, 0),
    placementPending: students.filter((s) => !s.placement_done).length,
    byLevel: byLevel.filter((b) => b.count > 0),
    unlevelled: students.length - withLevel.length,
  };
}

export const SKILL_ORDER: SkillKind[] = [
  'grammar',
  'vocabulary',
  'listening',
  'speaking',
  'reading',
  'writing',
];
