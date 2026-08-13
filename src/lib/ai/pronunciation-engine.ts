// ============================================================
// زبان‌یار | Deterministic pronunciation scoring
//
// Mirrors the philosophy of local-engine.ts: no external service is
// required for the feature to be useful. When a transcript exists
// (from a server-side STT provider, or the browser's free on-device
// Web Speech API) this module scores it against the target sentence
// with a phonetic-aware comparison tuned for Persian speakers.
//
// When no transcript exists at all we say so honestly rather than
// inventing a score — see scoreFromDuration().
// ============================================================

import type { CefrLevel } from '@/types/db';

// ------------------------------------------------------------
// Phonetic normalisation
// ------------------------------------------------------------

/**
 * Collapse spellings that sound alike so "practise/practice" or
 * "colour/color" don't count as mispronunciation.
 */
export function phoneticKey(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return '';

  // silent leading clusters
  w = w.replace(/^(kn|gn|pn|wr|ps)/, (m) => m[1]);
  w = w.replace(/^x/, 'z');

  // common digraphs → single symbols
  w = w
    .replace(/ough/g, 'of')
    .replace(/augh/g, 'af')
    .replace(/tion/g, 'shn')
    .replace(/sion/g, 'shn')
    .replace(/ture/g, 'chr')
    .replace(/ph/g, 'f')
    .replace(/gh/g, '')
    .replace(/ck/g, 'k')
    .replace(/sh/g, 'S')
    .replace(/ch/g, 'C')
    .replace(/th/g, 'T')
    .replace(/wh/g, 'w')
    .replace(/qu/g, 'kw')
    .replace(/x/g, 'ks');

  // voiced/unvoiced pairs Persian speakers often merge
  w = w.replace(/c/g, 'k').replace(/z/g, 's').replace(/v/g, 'w');

  // silent terminal e
  w = w.replace(/e$/, '');

  // vowels carry little weight for intelligibility → single class
  w = w.replace(/[aeiouy]+/g, 'a');

  // squash doubles
  w = w.replace(/(.)\1+/g, '$1');

  return w;
}

/**
 * Phonetic key for Spanish. Spanish spelling is far more regular than
 * English, so the mapping is mostly about the letters that sound alike
 * and the ones a Persian speaker tends to merge.
 */
export function phoneticKeyEs(word: string): string {
  let w = word.toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
  if (!w) return '';

  // strip accents — they mark stress, not a different consonant
  w = w
    .replace(/[á]/g, 'a').replace(/[é]/g, 'e').replace(/[í]/g, 'i')
    .replace(/[ó]/g, 'o').replace(/[úü]/g, 'u');

  // 'h' is always silent
  w = w.replace(/h/g, '');

  // digraphs first
  w = w
    .replace(/ch/g, 'C')
    .replace(/ll/g, 'y')     // yeísmo: ll and y merged in modern Spanish
    .replace(/rr/g, 'R')     // trill kept distinct from the tap
    .replace(/qu/g, 'k')
    .replace(/gu([ei])/g, 'g$1');

  // c/z -> /θ/ before e,i (Castilian); c -> /k/ elsewhere
  w = w.replace(/c([ei])/g, 'T$1').replace(/z/g, 'T').replace(/c/g, 'k');

  // g before e,i sounds like j (/x/)
  w = w.replace(/g([ei])/g, 'j$1');

  // b and v are the same sound in Spanish
  w = w.replace(/v/g, 'b');

  // ñ is a single palatal sound
  w = w.replace(/ñ/g, 'N');

  // vowels carry little weight for intelligibility
  w = w.replace(/[aeiou]+/g, 'a');

  // squash doubles
  w = w.replace(/(.)\1+/g, '$1');

  return w;
}

/** Phonetic key for the given language. */
export function keyFor(word: string, language: 'en' | 'es' = 'en'): string {
  return language === 'es' ? phoneticKeyEs(word) : phoneticKey(word);
}

/** Levenshtein distance between two strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr.slice();
  }
  return prev[b.length];
}

/** Similarity in 0..1 derived from edit distance. */
export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return Math.max(0, 1 - levenshtein(a, b) / max);
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Keep Spanish letters: stripping them turned "español" into "espaol"
    // and every accented word scored as mispronounced.
    .replace(/[^a-z0-9áéíóúüñ'\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// ------------------------------------------------------------
// Persian-speaker pronunciation hints
// ------------------------------------------------------------

interface Hint {
  test: RegExp;
  note_fa: string;
}

/** Sounds that don't exist in Persian, or map onto a different phoneme. */
const HINTS: Hint[] = [
  { test: /th/i, note_fa: 'صدای «th» در فارسی وجود ندارد. نوک زبان را بین دندان‌ها بگذارید — نه «س» و نه «ت».' },
  { test: /\bw/i, note_fa: 'حرف «w» با لب‌های غنچه ادا می‌شود، نه مثل «v» فارسی.' },
  { test: /ng\b/i, note_fa: 'در پایان کلمه، «ng» یک صدای تودماغی است؛ «گ» را جدا تلفظ نکنید.' },
  { test: /^s[ptkmnlw]/i, note_fa: 'کلمه با دو بی‌صدا شروع می‌شود؛ قبلش «اِ» اضافه نکنید (مثلاً «اِستارت» نگویید).' },
  { test: /ed\b/i, note_fa: 'پایانه «ed» بسته به فعل، /t/ یا /d/ یا /ɪd/ تلفظ می‌شود.' },
  { test: /r\b/i, note_fa: 'در انگلیسی بریتانیایی «r» پایانی معمولاً تلفظ نمی‌شود و نباید غلتان باشد.' },
  { test: /[aeiou]{2}/i, note_fa: 'این کلمه مصوت مرکب دارد؛ آن را کشیده و یکپارچه ادا کنید.' },
  { test: /tion\b/i, note_fa: 'پایانه «tion» مثل «شِن» تلفظ می‌شود.' },
];

/** Sounds that trip up a Persian speaker in Castilian Spanish. */
const HINTS_ES: Hint[] = [
  { test: /rr/i, note_fa: '«rr» باید غلتان و کشیده باشد؛ نوک زبان چند بار بلرزد — با «ر» تکی فارسی فرق دارد.' },
  { test: /^r/i, note_fa: '«r» در ابتدای کلمه هم غلتان تلفظ می‌شود، مثل «rr».' },
  { test: /j|g[ei]/i, note_fa: 'صدای «j» و «g» پیش از e/i مثل «خ» فارسی است، نه «ج».' },
  { test: /z|c[ei]/i, note_fa: 'در اسپانیایی اروپا «z» و «c» پیش از e/i مثل th انگلیسی در think تلفظ می‌شود، نه «س».' },
  { test: /ñ/i, note_fa: '«ñ» یک صدای واحد است («نی»)، نه دو صدای جدا.' },
  { test: /ll|y/i, note_fa: '«ll» در اسپانیایی امروز تقریباً مثل «ی» تلفظ می‌شود.' },
  { test: /^h/i, note_fa: 'حرف «h» همیشه بی‌صداست: hola خوانده می‌شود «اولا».' },
  { test: /v/i, note_fa: '«v» و «b» یک صدا دارند؛ «v» را مثل «و» فارسی تلفظ نکنید.' },
  { test: /[aeiou]{2}/i, note_fa: 'مصوت‌های اسپانیایی کوتاه و خالص‌اند؛ آن‌ها را کشیده نکنید.' },
];

function hintFor(word: string, language: 'en' | 'es' = 'en'): string | undefined {
  const set = language === 'es' ? HINTS_ES : HINTS;
  return set.find((h) => h.test.test(word))?.note_fa;
}

// ------------------------------------------------------------
// Result shape
// ------------------------------------------------------------

export interface WordScore {
  target: string;
  heard: string | null;
  score: number;          // 0..100
  status: 'correct' | 'close' | 'wrong' | 'missing' | 'extra';
  hint_fa?: string;
}

export interface PronunciationScore {
  accuracy_score: number;              // 0..100 overall
  transcript: string;
  words: WordScore[];
  feedback_fa: string;
  strengths_fa: string[];
  improvements_fa: string[];
  problem_words: string[];
  coverage: number;                    // 0..1 — how much of the target was attempted
  confident: boolean;                  // false when no real transcript existed
}

const STATUS_FA: Record<WordScore['status'], string> = {
  correct: 'درست',
  close: 'نزدیک',
  wrong: 'نادرست',
  missing: 'گفته نشد',
  extra: 'اضافه',
};

export { STATUS_FA };

// ------------------------------------------------------------
// Core: align transcript against target and score
// ------------------------------------------------------------

/**
 * Word-level alignment via LCS, then phonetic scoring of each pair.
 * Word order matters, so a learner who says the words jumbled does
 * not get full marks.
 */
export function scoreTranscript(
  targetText: string,
  transcript: string,
  language: 'en' | 'es' = 'en'
): PronunciationScore {
  const target = tokenize(targetText);
  const heard = tokenize(transcript);

  if (!target.length) {
    return {
      accuracy_score: 0,
      transcript,
      words: [],
      feedback_fa: 'جمله هدف خالی است.',
      strengths_fa: [],
      improvements_fa: [],
      problem_words: [],
      coverage: 0,
      confident: false,
    };
  }

  const words = alignWords(target, heard, language);

  const targetWords = words.filter((w) => w.status !== 'extra');
  const attempted = targetWords.filter((w) => w.status !== 'missing').length;
  const coverage = targetWords.length ? attempted / targetWords.length : 0;

  // overall = mean word score, with a penalty for spurious extra words
  const mean =
    targetWords.reduce((s, w) => s + w.score, 0) / (targetWords.length || 1);
  const extras = words.filter((w) => w.status === 'extra').length;
  const extraPenalty = Math.min(15, extras * 5);

  const accuracy = Math.max(0, Math.min(100, Math.round(mean - extraPenalty)));

  const problem = targetWords
    .filter((w) => w.status === 'wrong' || w.status === 'missing')
    .map((w) => w.target);

  const closeOnes = targetWords.filter((w) => w.status === 'close');

  // ---- Persian feedback ----
  const strengths: string[] = [];
  const improvements: string[] = [];

  const correctCount = targetWords.filter((w) => w.status === 'correct').length;
  if (correctCount) {
    strengths.push(`${correctCount} کلمه از ${targetWords.length} کلمه را درست ادا کردید.`);
  }
  if (coverage >= 0.95) {
    strengths.push('کل جمله را کامل خواندید.');
  }
  if (accuracy >= 85) {
    strengths.push('تلفظ کلی شما روان و قابل فهم است.');
  }
  if (!strengths.length) {
    strengths.push('شروع خوبی بود — با تکرار بهتر می‌شود.');
  }

  if (problem.length) {
    improvements.push(`روی این کلمه‌ها بیشتر تمرین کنید: ${problem.slice(0, 6).join('، ')}`);
  }
  if (closeOnes.length) {
    improvements.push(
      `این کلمه‌ها تقریباً درست بودند ولی کامل واضح نبودند: ${closeOnes
        .slice(0, 5)
        .map((w) => w.target)
        .join('، ')}`
    );
  }
  if (coverage < 0.7) {
    improvements.push('بخشی از جمله گفته نشد؛ کل جمله را یک‌نفس بخوانید.');
  }
  if (extras) {
    improvements.push('کلمه‌های اضافه‌ای شنیده شد؛ فقط جمله هدف را بخوانید.');
  }
  // surface the single most useful phonetic hint
  const topHint = words.find((w) => w.hint_fa && w.status !== 'correct')?.hint_fa;
  if (topHint) improvements.push(topHint);
  if (!improvements.length) {
    improvements.push('عالی بود! برای تثبیت، همین جمله را چند بار دیگر تکرار کنید.');
  }

  return {
    accuracy_score: accuracy,
    transcript,
    words,
    feedback_fa: verdict(accuracy, targetWords.length, correctCount),
    strengths_fa: strengths,
    improvements_fa: improvements,
    problem_words: problem,
    coverage: Number(coverage.toFixed(3)),
    confident: true,
  };
}

function verdict(score: number, total: number, correct: number): string {
  if (score >= 90)
    return `عالی! ${correct} از ${total} کلمه کاملاً درست بود. امتیاز تلفظ شما ${score} از ۱۰۰.`;
  if (score >= 75)
    return `خوب بود. ${correct} از ${total} کلمه درست ادا شد. امتیاز شما ${score} از ۱۰۰ — با کمی تمرین به عالی می‌رسید.`;
  if (score >= 55)
    return `قابل قبول است. امتیاز شما ${score} از ۱۰۰. چند کلمه واضح ادا نشد؛ آهسته‌تر و شمرده‌تر تکرار کنید.`;
  if (score >= 30)
    return `نیاز به تمرین دارد. امتیاز شما ${score} از ۱۰۰. ابتدا جمله را گوش کنید، بعد کلمه‌به‌کلمه تکرار کنید.`;
  return `تلفظ فاصله زیادی با جمله هدف داشت (امتیاز ${score} از ۱۰۰). مطمئن شوید میکروفون روشن است و جمله را شمرده بخوانید.`;
}

// ------------------------------------------------------------
// Word alignment (LCS on phonetic keys, order-preserving)
// ------------------------------------------------------------

function alignWords(
  target: string[],
  heard: string[],
  language: 'en' | 'es' = 'en'
): WordScore[] {
  const tKeys = target.map((w) => keyFor(w, language));
  const hKeys = heard.map((w) => keyFor(w, language));

  // LCS table over "phonetically similar enough" pairs
  const n = target.length;
  const m = heard.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0)
  );

  const near = (i: number, j: number) => similarity(tKeys[i], hKeys[j]) >= 0.6;

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = near(i, j)
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: WordScore[] = [];
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (near(i, j)) {
      out.push(scoreWord(target[i], heard[j], language));
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push(missing(target[i], language));
      i++;
    } else {
      out.push({ target: '', heard: heard[j], score: 0, status: 'extra' });
      j++;
    }
  }
  while (i < n) out.push(missing(target[i++], language));
  while (j < m) out.push({ target: '', heard: heard[j++], score: 0, status: 'extra' });

  return out;
}

function missing(word: string, language: 'en' | 'es' = 'en'): WordScore {
  return {
    target: word,
    heard: null,
    score: 0,
    status: 'missing',
    hint_fa: hintFor(word, language),
  };
}

function scoreWord(
  target: string,
  heard: string,
  language: 'en' | 'es' = 'en'
): WordScore {
  const exact = target.toLowerCase() === heard.toLowerCase();
  const phon = similarity(keyFor(target, language), keyFor(heard, language));
  const raw = similarity(target.toLowerCase(), heard.toLowerCase());

  // phonetic match dominates; raw spelling nudges it
  const score = Math.round(Math.min(100, (phon * 0.75 + raw * 0.25) * 100));

  let status: WordScore['status'];
  if (exact || score >= 92) status = 'correct';
  else if (score >= 70) status = 'close';
  else status = 'wrong';

  return {
    target,
    heard,
    score: exact ? 100 : score,
    status,
    hint_fa: status === 'correct' ? undefined : hintFor(target, language),
  };
}

// ------------------------------------------------------------
// No transcript available
// ------------------------------------------------------------

/**
 * Last-resort path: neither a speech service nor the browser produced
 * a transcript. We deliberately do NOT fabricate an accuracy score —
 * we return confident:false and a low-commitment estimate based only
 * on whether the recording length is plausible for the sentence.
 */
export function scoreFromDuration(
  targetText: string,
  durationMs: number,
  language: 'en' | 'es' = 'en'
): PronunciationScore {
  const words = tokenize(targetText);
  // ~380 ms per word is a comfortable speaking pace
  const expected = Math.max(700, words.length * 380);
  const ratio = durationMs / expected;

  let plausibility: number;
  if (ratio < 0.25) plausibility = 15;
  else if (ratio < 0.55) plausibility = 40;
  else if (ratio <= 2.2) plausibility = 60;
  else plausibility = 42;

  const tooShort = ratio < 0.55;
  const tooLong = ratio > 2.2;

  return {
    accuracy_score: plausibility,
    transcript: '',
    words: words.map((w) => ({
      target: w,
      heard: null,
      score: plausibility,
      status: 'close' as const,
      hint_fa: hintFor(w, language),
    })),
    feedback_fa: tooShort
      ? 'ضبط شما خیلی کوتاه بود. مطمئن شوید کل جمله را خوانده‌اید و میکروفون فعال است.'
      : tooLong
        ? 'ضبط شما طولانی‌تر از حد انتظار بود. جمله را یکپارچه و بدون مکث طولانی بخوانید.'
        : 'صدای شما ضبط شد، اما در این مرورگر امکان تبدیل گفتار به متن فراهم نبود؛ بنابراین امتیاز دقیق تلفظ محاسبه نشد.',
    strengths_fa: tooShort ? [] : ['طول ضبط با جمله هدف تناسب دارد.'],
    improvements_fa: [
      'برای دریافت امتیاز دقیق، از مرورگر کروم استفاده کنید یا کلید سرویس گفتار را در تنظیمات اضافه کنید.',
      ...(hintFor(targetText, language) ? [hintFor(targetText, language)!] : []),
    ],
    problem_words: [],
    coverage: 0,
    confident: false,
  };
}

// ------------------------------------------------------------
// Target sentence bank, graded by CEFR level
// ------------------------------------------------------------

export interface TargetSentence {
  id: string;
  text: string;
  translation_fa: string;
  level: CefrLevel;
  focus_fa: string;
}

export const SENTENCE_BANK: TargetSentence[] = [
  // ---------- A1 ----------
  { id: 'a1-1', text: 'Good morning. How are you?', translation_fa: 'صبح بخیر. حال شما چطور است؟', level: 'A1', focus_fa: 'احوال‌پرسی روزمره' },
  { id: 'a1-2', text: 'My name is Sara and I am a student.', translation_fa: 'اسم من سارا است و دانشجو هستم.', level: 'A1', focus_fa: 'معرفی خود' },
  { id: 'a1-3', text: 'I have three books and two pens.', translation_fa: 'من سه کتاب و دو خودکار دارم.', level: 'A1', focus_fa: 'اعداد و اسم جمع' },
  { id: 'a1-4', text: 'This is my house. It is very big.', translation_fa: 'این خانه من است. خیلی بزرگ است.', level: 'A1', focus_fa: 'صدای th' },
  { id: 'a1-5', text: 'What time do you wake up?', translation_fa: 'چه ساعتی بیدار می‌شوی؟', level: 'A1', focus_fa: 'پرسش با what' },

  // ---------- A2 ----------
  { id: 'a2-1', text: 'Yesterday I went to the market with my brother.', translation_fa: 'دیروز با برادرم به بازار رفتم.', level: 'A2', focus_fa: 'گذشته ساده' },
  { id: 'a2-2', text: 'She works at a hospital every weekend.', translation_fa: 'او هر آخر هفته در بیمارستان کار می‌کند.', level: 'A2', focus_fa: 'سوم‌شخص مفرد' },
  { id: 'a2-3', text: 'Could you please repeat that more slowly?', translation_fa: 'می‌شود لطفاً آهسته‌تر تکرار کنید؟', level: 'A2', focus_fa: 'درخواست مؤدبانه' },
  { id: 'a2-4', text: 'The weather is warmer than last week.', translation_fa: 'هوا از هفته گذشته گرم‌تر است.', level: 'A2', focus_fa: 'صفت تفضیلی' },
  { id: 'a2-5', text: 'I would like a cup of coffee, please.', translation_fa: 'لطفاً یک فنجان قهوه می‌خواهم.', level: 'A2', focus_fa: 'سفارش دادن' },

  // ---------- B1 ----------
  { id: 'b1-1', text: 'I have been learning English for three years.', translation_fa: 'سه سال است که انگلیسی یاد می‌گیرم.', level: 'B1', focus_fa: 'حال کامل استمراری' },
  { id: 'b1-2', text: 'If it rains tomorrow, we will stay at home.', translation_fa: 'اگر فردا باران ببارد، خانه می‌مانیم.', level: 'B1', focus_fa: 'شرطی نوع اول' },
  { id: 'b1-3', text: 'The meeting was cancelled because of the storm.', translation_fa: 'جلسه به‌خاطر طوفان لغو شد.', level: 'B1', focus_fa: 'مجهول و پایانه ed' },
  { id: 'b1-4', text: 'Although it was expensive, I decided to buy it.', translation_fa: 'با اینکه گران بود، تصمیم گرفتم بخرمش.', level: 'B1', focus_fa: 'جمله امتیازی' },
  { id: 'b1-5', text: 'She suggested going to the theatre this evening.', translation_fa: 'او پیشنهاد داد امشب به تئاتر برویم.', level: 'B1', focus_fa: 'اسم مصدر' },

  // ---------- B2 ----------
  { id: 'b2-1', text: 'The research demonstrates a significant improvement in performance.', translation_fa: 'این پژوهش بهبود چشمگیری در عملکرد نشان می‌دهد.', level: 'B2', focus_fa: 'واژگان آکادمیک' },
  { id: 'b2-2', text: 'Had I known about the traffic, I would have left earlier.', translation_fa: 'اگر از ترافیک خبر داشتم، زودتر راه می‌افتادم.', level: 'B2', focus_fa: 'شرطی وارونه' },
  { id: 'b2-3', text: 'Not only was the film thrilling, but it was also thought-provoking.', translation_fa: 'فیلم نه‌تنها هیجان‌انگیز بود، بلکه تأمل‌برانگیز هم بود.', level: 'B2', focus_fa: 'وارونگی جمله' },
  { id: 'b2-4', text: 'The committee thoroughly examined the environmental consequences.', translation_fa: 'کمیته پیامدهای زیست‌محیطی را به‌دقت بررسی کرد.', level: 'B2', focus_fa: 'کلمات چندهجایی' },
  { id: 'b2-5', text: 'She managed to persuade them despite their initial reluctance.', translation_fa: 'با وجود بی‌میلی اولیه‌شان توانست متقاعدشان کند.', level: 'B2', focus_fa: 'ریتم جمله بلند' },

  // ---------- C1 ----------
  { id: 'c1-1', text: 'The phenomenon is particularly noticeable in urban environments.', translation_fa: 'این پدیده به‌ویژه در محیط‌های شهری محسوس است.', level: 'C1', focus_fa: 'تکیه کلمات بلند' },
  { id: 'c1-2', text: 'Seldom have I encountered such a compelling argument.', translation_fa: 'به‌ندرت با چنین استدلال متقاعدکننده‌ای روبه‌رو شده‌ام.', level: 'C1', focus_fa: 'وارونگی رسمی' },
  { id: 'c1-3', text: 'The authorities acknowledged the unprecedented scale of the crisis.', translation_fa: 'مقامات مقیاس بی‌سابقه بحران را پذیرفتند.', level: 'C1', focus_fa: 'خوشه‌های بی‌صدا' },
  { id: 'c1-4', text: 'His explanation only served to exacerbate the confusion.', translation_fa: 'توضیح او فقط سردرگمی را بیشتر کرد.', level: 'C1', focus_fa: 'واژگان پیشرفته' },

  // ---------- C2 ----------
  { id: 'c2-1', text: 'The manuscript exemplifies the quintessential characteristics of the period.', translation_fa: 'این دست‌نوشته ویژگی‌های اصیل آن دوره را نمونه‌وار نشان می‌دهد.', level: 'C2', focus_fa: 'کلمات بسیار بلند' },
  { id: 'c2-2', text: 'Her remarks were widely interpreted as an oblique criticism of the board.', translation_fa: 'اظهارات او عمدتاً نقدی غیرمستقیم به هیئت‌مدیره تعبیر شد.', level: 'C2', focus_fa: 'آهنگ کلام' },
  { id: 'c2-3', text: 'Notwithstanding the obstacles, the initiative proved remarkably successful.', translation_fa: 'با وجود موانع، این ابتکار به‌طرز چشمگیری موفق بود.', level: 'C2', focus_fa: 'ساختار رسمی' },
];

/** Sentences at the learner's level, with graceful spill to neighbours. */
export function sentencesForLevel(level: CefrLevel | null): TargetSentence[] {
  const order: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const idx = level ? order.indexOf(level) : 1;
  const primary = SENTENCE_BANK.filter((s) => s.level === order[idx]);
  if (primary.length >= 4) return primary;

  const neighbours = SENTENCE_BANK.filter(
    (s) => s.level === order[Math.max(0, idx - 1)] || s.level === order[Math.min(5, idx + 1)]
  );
  return [...primary, ...neighbours].slice(0, 6);
}
