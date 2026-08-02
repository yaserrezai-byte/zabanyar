// ============================================================
// زبان‌یار | Group conversation — shared logic
//
// Scenario catalogue, content moderation and the AI "conversation
// guide" cadence. Kept free of Next/Supabase imports so the pure
// helpers stay unit-testable.
// ============================================================

import type { CefrLevel } from '@/types/db';

// ------------------------------------------------------------
// Scenarios
// ------------------------------------------------------------
export interface GroupScenario {
  id: string;
  topic: string;
  topic_fa: string;
  icon: string;
  description_fa: string;
  minLevel: CefrLevel;
  roles_fa: string[];
  starters: string[];
}

export const GROUP_SCENARIOS: GroupScenario[] = [
  {
    id: 'coffee_shop',
    topic: 'At the coffee shop',
    topic_fa: 'در کافی‌شاپ',
    icon: '☕',
    description_fa: 'سفارش دادن، گپ‌زدن با دوستان و صحبت درباره نوشیدنی‌ها.',
    minLevel: 'A1',
    roles_fa: ['مشتری', 'مشتری دوم', 'باریستا', 'دوست'],
    starters: [
      'What would you like to order?',
      'Have you tried the coffee here before?',
      'This place is busy today, isn\'t it?',
    ],
  },
  {
    id: 'travel_plans',
    topic: 'Planning a trip together',
    topic_fa: 'برنامه‌ریزی سفر',
    icon: '✈️',
    description_fa: 'انتخاب مقصد، بودجه و برنامه سفر گروهی.',
    minLevel: 'A2',
    roles_fa: ['برنامه‌ریز', 'مسافر', 'راهنما'],
    starters: [
      'Where should we go on our next trip?',
      'How much can we spend on this trip?',
      'Do you prefer the beach or the mountains?',
    ],
  },
  {
    id: 'restaurant',
    topic: 'Dinner at a restaurant',
    topic_fa: 'شام در رستوران',
    icon: '🍽️',
    description_fa: 'سفارش غذا، تعارف کردن و گفت‌وگو سر میز شام.',
    minLevel: 'A1',
    roles_fa: ['مهمان', 'مهمان دوم', 'گارسون'],
    starters: [
      'What are you going to have tonight?',
      'Shall we share a starter?',
      'Could we see the menu, please?',
    ],
  },
  {
    id: 'job_interview',
    topic: 'A panel job interview',
    topic_fa: 'مصاحبه شغلی گروهی',
    icon: '💼',
    description_fa: 'یک نفر داوطلب و بقیه مصاحبه‌کننده — تمرین زبان رسمی.',
    minLevel: 'B1',
    roles_fa: ['داوطلب', 'مصاحبه‌کننده', 'مدیر منابع انسانی'],
    starters: [
      'Could you tell us a little about yourself?',
      'What are your main strengths?',
      'Why do you want to work with us?',
    ],
  },
  {
    id: 'study_group',
    topic: 'A study group discussion',
    topic_fa: 'گروه مطالعه',
    icon: '📚',
    description_fa: 'بحث درباره یادگیری زبان و تبادل تجربه.',
    minLevel: 'A2',
    roles_fa: ['زبان‌آموز', 'زبان‌آموز', 'هماهنگ‌کننده'],
    starters: [
      'How long have you been learning English?',
      'What is the hardest part of English for you?',
      'Which method works best for you?',
    ],
  },
  {
    id: 'debate',
    topic: 'A friendly debate',
    topic_fa: 'مناظره دوستانه',
    icon: '⚖️',
    description_fa: 'موافق و مخالف یک موضوع — تمرین استدلال و کلمات ربط.',
    minLevel: 'B2',
    roles_fa: ['موافق', 'مخالف', 'داور'],
    starters: [
      'Do you think social media does more harm than good?',
      'Should working from home be a right?',
      'Is it better to travel alone or with friends?',
    ],
  },
];

export function scenarioById(id: string): GroupScenario | undefined {
  return GROUP_SCENARIOS.find((s) => s.id === id);
}

const LEVEL_ORDER: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Scenarios a learner at `level` can join (their level or below). */
export function scenariosForLevel(level: CefrLevel | null): GroupScenario[] {
  const idx = level ? LEVEL_ORDER.indexOf(level) : 0;
  return GROUP_SCENARIOS.filter((s) => LEVEL_ORDER.indexOf(s.minLevel) <= idx);
}

// ------------------------------------------------------------
// Content moderation
//
// A deliberately small, extensible blocklist. This is a politeness
// filter for a classroom, not a security control — it runs before
// broadcast so nothing offensive reaches other learners.
// ------------------------------------------------------------
const BLOCKED_EN = [
  'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cunt',
  'whore', 'slut', 'retard', 'faggot', 'nigger', 'rape', 'kill yourself',
];

const BLOCKED_FA = [
  'کیر', 'کص', 'کun', 'جنده', 'کونی', 'مادرجنده', 'حرومزاده',
  'بیشرف', 'عوضی', 'گاییدم', 'پدرسگ', 'خارکسه',
];

/** Leet/spacing evasion: "f.u.c.k" or "f u c k" → "fuck". */
function normaliseForFilter(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0@]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export interface ModerationResult {
  allowed: boolean;
  reason_fa?: string;
  matched?: string;
}

export function moderate(text: string): ModerationResult {
  const raw = text.trim();

  if (!raw) {
    return { allowed: false, reason_fa: 'پیام خالی است.' };
  }
  if (raw.length > 500) {
    return { allowed: false, reason_fa: 'پیام بیش از حد طولانی است (حداکثر ۵۰۰ کاراکتر).' };
  }

  const flat = normaliseForFilter(raw);
  for (const word of BLOCKED_EN) {
    if (flat.includes(normaliseForFilter(word))) {
      return {
        allowed: false,
        reason_fa: 'پیام شما حاوی کلمات نامناسب است. لطفاً محترمانه گفت‌وگو کنید.',
        matched: word,
      };
    }
  }
  for (const word of BLOCKED_FA) {
    if (raw.includes(word)) {
      return {
        allowed: false,
        reason_fa: 'پیام شما حاوی کلمات نامناسب است. لطفاً محترمانه گفت‌وگو کنید.',
        matched: word,
      };
    }
  }

  // crude flood guard: "aaaaaaaaaa" or the same word repeated
  if (/(.)\1{9,}/.test(raw)) {
    return { allowed: false, reason_fa: 'لطفاً از تکرار بی‌مورد حروف خودداری کنید.' };
  }

  return { allowed: true };
}

// ------------------------------------------------------------
// AI guide cadence
//
// The guide must not answer every message — that would turn a group
// chat back into a 1:1 tutor session. It speaks when the room needs
// a nudge.
// ------------------------------------------------------------
export interface CadenceInput {
  /** user messages since the guide last spoke */
  messagesSinceAi: number;
  /** ms since the guide last spoke (Infinity if never) */
  msSinceAi: number;
  /** ms since ANY message (used to detect a stalled room) */
  msSinceLastMessage: number;
  /** how many learners are currently present */
  activeParticipants: number;
  /** total user messages in the room */
  totalMessages: number;
}

export type GuideReason =
  | 'opening'      // room just started
  | 'interval'     // enough turns have passed
  | 'stalled'      // nobody has spoken for a while
  | 'none';

/**
 * Decide whether the AI guide should speak.
 * Pure function so the policy is unit-testable.
 */
export function shouldGuideSpeak(input: CadenceInput): GuideReason {
  const {
    messagesSinceAi, msSinceAi, msSinceLastMessage,
    activeParticipants, totalMessages,
  } = input;

  // Kick the room off on the first turn or two, once at least two
  // people are present. Note the cadence is evaluated AFTER the
  // learner's message is stored, so totalMessages is already >= 1 at
  // the moment the room genuinely opens — requiring 0 here would mean
  // the guide never introduced the scenario.
  if (msSinceAi === Infinity && activeParticipants >= 2 && totalMessages <= 1) {
    return 'opening';
  }

  // Never interrupt twice within 20s.
  if (msSinceAi < 20_000) return 'none';

  // Room has gone quiet for 45s+ with people still present.
  if (msSinceLastMessage > 45_000 && activeParticipants >= 1 && totalMessages > 0) {
    return 'stalled';
  }

  // Roughly every 4 learner turns (5 in bigger rooms, to stay out of the way).
  const every = activeParticipants >= 3 ? 5 : 4;
  if (messagesSinceAi >= every) return 'interval';

  return 'none';
}

// ------------------------------------------------------------
// Local fallback guide
//
// Used when no AI provider is configured or the provider fails, so a
// live group session never stalls waiting on an external service.
// ------------------------------------------------------------
const FALLBACK_OPENERS_FA = [
  'سلام به همگی! 👋 بیایید شروع کنیم.',
  'خوش آمدید! امروز با هم انگلیسی تمرین می‌کنیم.',
];

const FALLBACK_NUDGES = [
  { en: 'Great! Can someone else share their opinion?', fa: 'عالی! کس دیگری هم نظرش را بگوید؟' },
  { en: 'Interesting point. Why do you think so?', fa: 'نکته جالبی بود. چرا این‌طور فکر می‌کنید؟' },
  { en: 'Let\'s hear from someone who hasn\'t spoken yet.', fa: 'بیایید از کسی بشنویم که هنوز صحبت نکرده است.' },
  { en: 'Can you give an example?', fa: 'می‌توانید یک مثال بزنید؟' },
  { en: 'Does everyone agree with that?', fa: 'همه با این موضوع موافق‌اند؟' },
];

const FALLBACK_STALLED = [
  { en: 'It got quiet! Who wants to continue?', fa: 'ساکت شد! چه کسی ادامه می‌دهد؟' },
  { en: 'Let\'s keep going — what do you think about this?', fa: 'ادامه دهیم — نظر شما درباره این چیست؟' },
];

export interface GuideTurn {
  content: string;
  translation_fa: string;
  source: 'ai' | 'local';
}

/** Deterministic guide turn, no external service required. */
export function localGuideTurn(
  reason: GuideReason,
  scenario: GroupScenario | undefined,
  seed: number
): GuideTurn {
  if (reason === 'opening') {
    const starter = scenario?.starters[seed % (scenario.starters.length || 1)]
      ?? 'Let\'s begin! Please introduce yourselves.';
    const hello = FALLBACK_OPENERS_FA[seed % FALLBACK_OPENERS_FA.length];
    return {
      content: `Welcome everyone! Today's topic: ${scenario?.topic ?? 'free conversation'}. ${starter}`,
      translation_fa: `${hello} موضوع امروز: ${scenario?.topic_fa ?? 'گفت‌وگوی آزاد'} — ${starter}`,
      source: 'local',
    };
  }

  const pool = reason === 'stalled' ? FALLBACK_STALLED : FALLBACK_NUDGES;
  const pick = pool[seed % pool.length];
  return { content: pick.en, translation_fa: pick.fa, source: 'local' };
}

/** Stable pseudo-random seed so repeated calls do not repeat text. */
export function seedFrom(...parts: (string | number)[]): number {
  let h = 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Client-side mirror of the DB rate limit (UX only; the DB is truth). */
export const MESSAGE_COOLDOWN_MS = 2000;
