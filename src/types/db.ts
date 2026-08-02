// ============================================================
// زبان‌یار | Database types
// ============================================================

export type UserRole = 'student' | 'teacher' | 'admin';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type SkillKind =
  | 'grammar'
  | 'vocabulary'
  | 'listening'
  | 'speaking'
  | 'reading'
  | 'writing';
export type TestStatus = 'in_progress' | 'completed' | 'abandoned';
export type LessonStatus = 'draft' | 'published' | 'archived';
export type ExerciseKind =
  | 'mcq'
  | 'fill_blank'
  | 'reorder'
  | 'match'
  | 'short_answer'
  | 'essay'
  | 'speaking';
export type AssignmentStatus =
  | 'assigned'
  | 'submitted'
  | 'graded'
  | 'late'
  | 'skipped';
export type ConversationRole = 'user' | 'assistant' | 'system';
export type SubscriptionTier = 'free' | 'pro' | 'premium';
export type TranscriptSource = 'service' | 'browser' | 'heuristic';

export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const SKILLS: SkillKind[] = [
  'grammar',
  'vocabulary',
  'listening',
  'speaking',
  'reading',
  'writing',
];

export const SKILL_FA: Record<SkillKind, string> = {
  grammar: 'گرامر',
  vocabulary: 'واژگان',
  listening: 'شنیداری',
  speaking: 'گفتاری',
  reading: 'خواندن',
  writing: 'نوشتن',
};

export const SKILL_ICON: Record<SkillKind, string> = {
  grammar: '📐',
  vocabulary: '📚',
  listening: '🎧',
  speaking: '🗣️',
  reading: '📖',
  writing: '✍️',
};

export const LEVEL_FA: Record<CefrLevel, string> = {
  A1: 'مبتدی',
  A2: 'پایه',
  B1: 'متوسط',
  B2: 'متوسط بالا',
  C1: 'پیشرفته',
  C2: 'تسلط کامل',
};

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  locale: string;
  timezone: string;
  current_level: CefrLevel | null;
  target_level: CefrLevel | null;
  daily_goal_min: number;
  interests: string[];
  learning_pace: number;
  streak_days: number;
  last_active_on: string | null;
  onboarding_done: boolean;
  placement_done: boolean;
  subscription: SubscriptionTier;
  teacher_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillLevel {
  id: string;
  user_id: string;
  skill: SkillKind;
  level: CefrLevel;
  score: number;
  confidence: number;
  assessed_at: string;
}

export interface PlacementQuestion {
  id: string;
  skill: SkillKind;
  level: CefrLevel;
  prompt: string;
  prompt_fa?: string;
  options: string[];
  correct_index: number;
  explanation_fa?: string;
  error_tag?: string;
}

export interface PlacementAnswer {
  question_id: string;
  chosen_index: number;
  correct: boolean;
  skill: SkillKind;
  level: CefrLevel;
  error_tag?: string;
  time_spent_sec?: number;
}

export interface PlacementTest {
  id: string;
  user_id: string;
  status: TestStatus;
  current_index: number;
  questions: PlacementQuestion[];
  answers: PlacementAnswer[];
  raw_score: number | null;
  result_level: CefrLevel | null;
  skill_breakdown: Record<string, number>;
  ai_summary: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface LessonSection {
  heading_fa: string;
  body_fa?: string;
  body_en?: string;
  examples?: { en: string; fa: string }[];
  tip_fa?: string;
}

export interface Lesson {
  id: string;
  user_id: string | null;
  title: string;
  title_fa: string | null;
  slug: string | null;
  skill: SkillKind;
  level: CefrLevel;
  topic: string | null;
  summary_fa: string | null;
  content: { sections?: LessonSection[]; vocabulary?: VocabSeed[] };
  est_minutes: number;
  order_index: number;
  status: LessonStatus;
  ai_generated: boolean;
  created_at: string;
}

export interface VocabSeed {
  word: string;
  meaning_fa: string;
  example_en?: string;
  example_fa?: string;
  phonetic?: string;
  part_of_speech?: string;
}

export interface Exercise {
  id: string;
  lesson_id: string | null;
  user_id: string | null;
  kind: ExerciseKind;
  skill: SkillKind;
  level: CefrLevel;
  prompt: string;
  prompt_fa: string | null;
  options: string[];
  correct_answer: unknown;
  explanation_fa: string | null;
  points: number;
  order_index: number;
}

export interface Assignment {
  id: string;
  user_id: string;
  assigned_by: string | null;
  lesson_id: string | null;
  title: string;
  instructions_fa: string | null;
  skill: SkillKind;
  status: AssignmentStatus;
  due_at: string | null;
  max_points: number;
  created_at: string;
}

export interface Submission {
  id: string;
  assignment_id: string | null;
  exercise_id: string | null;
  user_id: string;
  answer: unknown;
  answer_text: string | null;
  audio_path: string | null;
  is_correct: boolean | null;
  score: number | null;
  time_spent_sec: number | null;
  ai_feedback: Record<string, unknown>;
  feedback_fa: string | null;
  graded_at: string | null;
  created_at: string;
}

export interface MistakeMemory {
  id: string;
  user_id: string;
  skill: SkillKind;
  error_tag: string;
  error_label_fa: string | null;
  description_fa: string | null;
  example_wrong: string | null;
  example_correct: string | null;
  occurrences: number;
  severity: number;
  resolved: boolean;
  last_seen_at: string;
}

export interface VocabularyMemory {
  id: string;
  user_id: string;
  word: string;
  meaning_fa: string;
  part_of_speech: string | null;
  example_en: string | null;
  example_fa: string | null;
  phonetic: string | null;
  level: CefrLevel;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  mastery: number;
  next_review_at: string;
  last_review_at: string | null;
  source: string | null;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  scenario: string | null;
  level: CefrLevel | null;
  mode: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: ConversationRole;
  content: string;
  translation_fa: string | null;
  corrections: Correction[];
  audio_path: string | null;
  created_at: string;
}

export interface Correction {
  wrong: string;
  right: string;
  note_fa: string;
  error_tag?: string;
}

export interface LearningHistory {
  id: string;
  user_id: string;
  event_type: string;
  skill: SkillKind | null;
  lesson_id: string | null;
  duration_sec: number;
  xp: number;
  accuracy: number | null;
  meta: Record<string, unknown>;
  occurred_on: string;
  created_at: string;
}

export interface ProgressReport {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  total_minutes: number;
  total_xp: number;
  lessons_done: number;
  accuracy_avg: number | null;
  skill_snapshot: Record<string, number>;
  strengths_fa: string[] | null;
  weaknesses_fa: string[] | null;
  coach_advice_fa: string | null;
}

export interface AiMemory {
  id: string;
  user_id: string;
  kind: string;
  key: string;
  value: string;
  weight: number;
}

export interface PronunciationWordScore {
  target: string;
  heard: string | null;
  score: number;
  status: 'correct' | 'close' | 'wrong' | 'missing' | 'extra';
  hint_fa?: string;
}

export interface PronunciationFeedback {
  words?: PronunciationWordScore[];
  strengths_fa?: string[];
  improvements_fa?: string[];
  problem_words?: string[];
  feedback_fa?: string;
  coverage?: number;
  confident?: boolean;
}

export interface PronunciationAttempt {
  id: string;
  user_id: string;
  target_text: string;
  transcript: string | null;
  accuracy_score: number;
  phoneme_feedback: PronunciationFeedback;
  audio_path: string | null;
  level: CefrLevel | null;
  duration_ms: number | null;
  source: TranscriptSource;
  used_fallback: boolean;
  created_at: string;
}
