// ============================================================
// زبان‌یار | Resolving the active learning language
//
// The active language lives in profiles.active_language. Server
// components and API routes resolve it here so no caller has to
// remember the fallback rules.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_LANGUAGE,
  toLanguage,
  type LearningLanguage,
} from '@/lib/languages';

/** Read the learner's active language. Never throws. */
export async function getActiveLanguage(
  supabase: SupabaseClient,
  userId: string
): Promise<LearningLanguage> {
  const { data } = await supabase
    .from('profiles')
    .select('active_language')
    .eq('id', userId)
    .maybeSingle();
  return toLanguage(data?.active_language);
}

export interface LanguageTrack {
  language: LearningLanguage;
  current_level: string | null;
  target_level: string | null;
  placement_done: boolean;
  streak_days: number;
  last_active_on: string | null;
}

/**
 * The learner's row for one language, creating it on first use so a
 * newly-chosen language always has somewhere to record progress.
 */
export async function ensureLanguageTrack(
  supabase: SupabaseClient,
  userId: string,
  language: LearningLanguage
): Promise<LanguageTrack> {
  const { data: existing } = await supabase
    .from('user_languages')
    .select('language, current_level, target_level, placement_done, streak_days, last_active_on')
    .eq('user_id', userId)
    .eq('language', language)
    .maybeSingle();

  if (existing) return existing as LanguageTrack;

  const { data: created } = await supabase
    .from('user_languages')
    .insert({ user_id: userId, language })
    .select('language, current_level, target_level, placement_done, streak_days, last_active_on')
    .single();

  return (
    (created as LanguageTrack) ?? {
      language,
      current_level: null,
      target_level: null,
      placement_done: false,
      streak_days: 0,
      last_active_on: null,
    }
  );
}

/** Every language the learner has started, for the switcher UI. */
export async function listLanguageTracks(
  supabase: SupabaseClient,
  userId: string
): Promise<LanguageTrack[]> {
  const { data } = await supabase
    .from('user_languages')
    .select('language, current_level, target_level, placement_done, streak_days, last_active_on')
    .eq('user_id', userId);
  return (data ?? []) as LanguageTrack[];
}

/**
 * Active language plus its track, resolved together — the shape most
 * pages actually need.
 */
export async function getLanguageContext(
  supabase: SupabaseClient,
  userId: string
): Promise<{ language: LearningLanguage; track: LanguageTrack }> {
  const language = await getActiveLanguage(supabase, userId);
  const track = await ensureLanguageTrack(supabase, userId, language);
  return { language, track };
}

export { DEFAULT_LANGUAGE };
