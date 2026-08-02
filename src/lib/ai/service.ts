// ============================================================
// زبان‌یار | AI service layer
// Tries the configured AI provider, always falls back to the
// deterministic local engine so nothing ever hard-fails.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CefrLevel, Correction, SkillKind, VocabSeed } from '@/types/db';
import {
  AI_ENABLED,
  SPEECH_ENABLED,
  chatJson,
  transcribeAudio,
  type ChatMessage,
} from './provider';
import {
  COACH_SYSTEM,
  GRADER_SYSTEM,
  LESSON_SYSTEM,
  TUTOR_SYSTEM,
  type LearnerContext,
} from './prompts';
import { localCoach, localGrade, localLesson, localReply } from './local-engine';
import {
  scoreFromDuration,
  scoreTranscript,
  type PronunciationScore,
} from './pronunciation-engine';

// ------------------------------------------------------------
// Build learner memory context from the database
// ------------------------------------------------------------
export async function buildLearnerContext(
  supabase: SupabaseClient,
  userId: string
): Promise<LearnerContext & { weakestSkill?: SkillKind; streak?: number }> {
  const [profileRes, mistakesRes, vocabRes, memoryRes, skillsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase
      .from('mistakes_memory')
      .select('error_tag, error_label_fa, occurrences, skill')
      .eq('user_id', userId)
      .eq('resolved', false)
      .order('occurrences', { ascending: false })
      .limit(8),
    supabase
      .from('vocabulary_memory')
      .select('word, mastery')
      .eq('user_id', userId)
      .lt('mastery', 0.5)
      .order('lapses', { ascending: false })
      .limit(20),
    supabase
      .from('ai_memory')
      .select('key, value')
      .eq('user_id', userId)
      .order('weight', { ascending: false })
      .limit(10),
    supabase.from('skill_levels').select('skill, score').eq('user_id', userId),
  ]);

  const p = profileRes.data;
  const skills = skillsRes.data ?? [];
  const weakest = skills.length
    ? [...skills].sort((a, b) => Number(a.score) - Number(b.score))[0]?.skill
    : undefined;

  return {
    fullName: p?.full_name ?? null,
    level: p?.current_level ?? null,
    targetLevel: p?.target_level ?? null,
    interests: p?.interests ?? [],
    pace: p?.learning_pace ?? 1,
    streak: p?.streak_days ?? 0,
    weakestSkill: (weakest as SkillKind) ?? 'grammar',
    weaknesses: (mistakesRes.data ?? []).map((m) => ({
      tag: m.error_tag,
      label: m.error_label_fa || m.error_tag,
      occurrences: m.occurrences,
    })),
    hardWords: (vocabRes.data ?? []).map((v) => v.word),
    memories: memoryRes.data ?? [],
  };
}

// ------------------------------------------------------------
// Record mistakes into long-term memory (AI Error Intelligence)
// ------------------------------------------------------------
export async function recordMistakes(
  supabase: SupabaseClient,
  userId: string,
  errors: { error_tag?: string; note_fa?: string; wrong?: string; right?: string; skill?: SkillKind }[]
) {
  for (const e of errors) {
    if (!e.error_tag) continue;

    const { data: existing } = await supabase
      .from('mistakes_memory')
      .select('id, occurrences')
      .eq('user_id', userId)
      .eq('error_tag', e.error_tag)
      .maybeSingle();

    if (existing) {
      const occ = existing.occurrences + 1;
      await supabase
        .from('mistakes_memory')
        .update({
          occurrences: occ,
          severity: Math.min(1, 0.3 + occ * 0.07),
          last_seen_at: new Date().toISOString(),
          resolved: false,
          example_wrong: e.wrong ?? null,
          example_correct: e.right ?? null,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('mistakes_memory').insert({
        user_id: userId,
        skill: e.skill ?? 'grammar',
        error_tag: e.error_tag,
        error_label_fa: ERROR_LABELS_FA[e.error_tag] ?? e.error_tag,
        description_fa: e.note_fa ?? null,
        example_wrong: e.wrong ?? null,
        example_correct: e.right ?? null,
        occurrences: 1,
        severity: 0.4,
      });
    }
  }
}

export const ERROR_LABELS_FA: Record<string, string> = {
  past_simple: 'زمان گذشته ساده',
  present_simple: 'زمان حال ساده',
  present_perfect: 'زمان حال کامل',
  future_perfect: 'زمان آینده کامل',
  verb_to_be: 'فعل to be',
  subject_verb_agreement: 'مطابقت فاعل و فعل',
  article: 'حروف تعریف (a/an/the)',
  preposition: 'حروف اضافه',
  word_order: 'ترتیب کلمات',
  spelling: 'املای کلمات',
  punctuation: 'نشانه‌گذاری',
  capitalization: 'حروف بزرگ',
  capital_i: 'نوشتن ضمیر I',
  comparatives: 'صفات تفضیلی',
  quantifiers: 'کمیت‌سنج‌ها (much/many)',
  uncountable: 'اسامی غیرقابل شمارش',
  since_for: 'تفاوت since و for',
  conditional_1: 'شرطی نوع اول',
  conditional_3: 'شرطی نوع سوم',
  inverted_conditional: 'شرطی وارونه',
  passive_voice: 'جملات مجهول',
  reported_speech: 'نقل قول غیرمستقیم',
  gerund_infinitive: 'مصدر و اسم مصدر',
  phrasal_verbs: 'افعال عبارتی',
  collocations: 'هم‌آیی کلمات',
  advanced_vocab: 'واژگان پیشرفته',
  ed_ing_adjectives: 'صفات ed و ing',
  linkers: 'کلمات ربط',
  inversion: 'وارونگی جمله',
  unreal_past: 'گذشته غیرواقعی',
  modals: 'افعال کمکی وجهی',
  verb_choice: 'انتخاب فعل',
  register: 'سطح رسمی بودن زبان',
  style: 'سبک نوشتار',
  tone: 'لحن متن',
  nuance: 'ظرافت معنایی',
  functional_language: 'زبان کاربردی',
  infinitive_purpose: 'مصدر هدف',
  there_be: 'ساختار there is/are',
  antonyms: 'متضادها',
  daily_words: 'واژگان روزمره',
  detail_reading: 'درک جزئیات متن',
  inference: 'استنباط از متن',
  concession: 'جملات امتیازی',
  vowel_sounds: 'صداهای مصوت',
  irregular_verb: 'افعال بی‌قاعده',
  double_negative: 'منفی مضاعف',
};

// ------------------------------------------------------------
// Tutor reply
// ------------------------------------------------------------
export interface TutorResult {
  reply: string;
  translation_fa: string;
  corrections: Correction[];
  new_words: VocabSeed[];
  source: 'ai' | 'local';
}

export async function tutorReply(
  userText: string,
  ctx: LearnerContext,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  scenario?: string
): Promise<TutorResult> {
  if (AI_ENABLED) {
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: TUTOR_SYSTEM(ctx, scenario) },
        ...history.slice(-10),
        { role: 'user', content: userText },
      ];
      const out = await chatJson<Omit<TutorResult, 'source'>>(messages, { temperature: 0.8 });
      return {
        reply: out.reply ?? '',
        translation_fa: out.translation_fa ?? '',
        corrections: out.corrections ?? [],
        new_words: out.new_words ?? [],
        source: 'ai',
      };
    } catch (err) {
      console.error('[ai] tutorReply fallback:', err);
    }
  }
  return { ...localReply(userText, ctx), source: 'local' };
}

// ------------------------------------------------------------
// Grading
// ------------------------------------------------------------
export interface GradeResult {
  score: number;
  is_correct: boolean;
  feedback_fa: string;
  strengths_fa: string[];
  improvements_fa: string[];
  corrected_text: string;
  errors: (Correction & { skill?: SkillKind })[];
  source: 'ai' | 'local';
}

export async function gradeAnswer(
  text: string,
  skill: SkillKind,
  ctx: LearnerContext,
  question?: string
): Promise<GradeResult> {
  if (AI_ENABLED) {
    try {
      const out = await chatJson<Omit<GradeResult, 'source'>>(
        [
          { role: 'system', content: GRADER_SYSTEM(ctx, skill) },
          {
            role: 'user',
            content: `${question ? `سؤال: ${question}\n\n` : ''}پاسخ زبان‌آموز:\n${text}`,
          },
        ],
        { temperature: 0.3 }
      );
      return {
        score: Number(out.score ?? 0),
        is_correct: Boolean(out.is_correct),
        feedback_fa: out.feedback_fa ?? '',
        strengths_fa: out.strengths_fa ?? [],
        improvements_fa: out.improvements_fa ?? [],
        corrected_text: out.corrected_text ?? text,
        errors: out.errors ?? [],
        source: 'ai',
      };
    } catch (err) {
      console.error('[ai] gradeAnswer fallback:', err);
    }
  }
  return { ...localGrade(text, skill), source: 'local' };
}

// ------------------------------------------------------------
// Lesson generation
// ------------------------------------------------------------
export interface GeneratedLesson {
  title: string;
  title_fa: string;
  summary_fa: string;
  est_minutes: number;
  sections: { heading_fa: string; body_fa: string; examples?: { en: string; fa: string }[]; tip_fa?: string }[];
  vocabulary: VocabSeed[];
  exercises: {
    kind: string;
    prompt: string;
    prompt_fa?: string;
    options: string[];
    correct_answer: number;
    explanation_fa?: string;
    error_tag?: string;
  }[];
  source: 'ai' | 'local';
  topic?: string;
}

export async function generateLesson(
  skill: SkillKind,
  level: CefrLevel,
  topic: string,
  ctx: LearnerContext
): Promise<GeneratedLesson> {
  if (AI_ENABLED) {
    try {
      const out = await chatJson<Omit<GeneratedLesson, 'source'>>(
        [
          { role: 'system', content: LESSON_SYSTEM(ctx, skill, level, topic) },
          { role: 'user', content: `یک درس کامل درباره «${topic}» بساز.` },
        ],
        { temperature: 0.7, maxTokens: 3000 }
      );
      if (out?.sections?.length) return { ...out, source: 'ai' };
    } catch (err) {
      console.error('[ai] generateLesson fallback:', err);
    }
  }
  const local = localLesson(skill, level, topic);
  return { ...local, source: 'local' } as GeneratedLesson;
}

// ------------------------------------------------------------
// Coach
// ------------------------------------------------------------
export interface CoachResult {
  greeting_fa: string;
  analysis_fa: string;
  focus_area_fa: string;
  next_steps: { title_fa: string; why_fa: string; minutes: number; skill: string }[];
  motivation_fa: string;
  source: 'ai' | 'local';
}

export async function coachAdvice(
  ctx: LearnerContext & { weakestSkill?: SkillKind; streak?: number }
): Promise<CoachResult> {
  if (AI_ENABLED) {
    try {
      const out = await chatJson<Omit<CoachResult, 'source'>>(
        [
          { role: 'system', content: COACH_SYSTEM(ctx) },
          { role: 'user', content: 'وضعیت من را تحلیل کن و برنامه امروز را بده.' },
        ],
        { temperature: 0.6 }
      );
      if (out?.next_steps?.length) return { ...out, source: 'ai' };
    } catch (err) {
      console.error('[ai] coachAdvice fallback:', err);
    }
  }
  return { ...localCoach(ctx), source: 'local' };
}

// ------------------------------------------------------------
// Pronunciation
// ------------------------------------------------------------

export interface PronunciationResult extends PronunciationScore {
  /** Where the transcript came from. */
  source: 'service' | 'browser' | 'heuristic';
  /** true when the local engine produced the score, not a speech service. */
  used_fallback: boolean;
}

/**
 * Transcribe an utterance and score it against the target sentence.
 *
 * Resolution order, degrading gracefully at every step:
 *   1. Server-side STT provider (SPEECH_API_KEY / OPENAI_API_KEY)
 *   2. A transcript the browser already produced on-device (free)
 *   3. Duration-only heuristic, flagged as not confident
 *
 * Never throws: a misconfigured or failing provider always lands on
 * the local engine, matching the rest of the AI layer.
 */
export async function transcribeAndScore(
  targetText: string,
  audio: { data: Buffer; mimeType: string } | null,
  opts: { browserTranscript?: string; durationMs?: number } = {}
): Promise<PronunciationResult> {
  // ---- 1. server-side speech service ----
  if (SPEECH_ENABLED && audio) {
    try {
      const { text } = await transcribeAudio(audio.data, {
        mimeType: audio.mimeType,
        language: 'en',
        // Priming with the target improves accuracy on accented speech.
        prompt: targetText,
      });
      return {
        ...scoreTranscript(targetText, text),
        source: 'service',
        used_fallback: false,
      };
    } catch (err) {
      console.error('[ai] transcribeAndScore fallback:', err);
    }
  }

  // ---- 2. transcript captured on-device by the browser ----
  const browser = opts.browserTranscript?.trim();
  if (browser) {
    return {
      ...scoreTranscript(targetText, browser),
      source: 'browser',
      used_fallback: true,
    };
  }

  // ---- 3. nothing to compare against ----
  return {
    ...scoreFromDuration(targetText, opts.durationMs ?? 0),
    source: 'heuristic',
    used_fallback: true,
  };
}
