// ============================================================
// زبان‌یار | Deterministic local engine
// Every AI feature has a rule-based fallback so the product is
// fully usable with zero external AI credentials.
// ============================================================

import type {
  CefrLevel,
  Correction,
  SkillKind,
  VocabSeed,
} from '@/types/db';
import { LEVEL_FA, SKILL_FA } from '@/types/db';
import type { LearnerContext } from './prompts';

const ORDER: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// ------------------------------------------------------------
// 1) Rule-based grammar checker
// ------------------------------------------------------------
interface Rule {
  re: RegExp;
  tag: string;
  skill: SkillKind;
  note_fa: string;
  fix: (m: RegExpMatchArray) => string;
}

const RULES: Rule[] = [
  { re: /\bi\s+(am|was|have|will|can|do|don't|like|think|want|need)\b/g, tag: 'capital_i', skill: 'writing', note_fa: 'ضمیر I همیشه با حرف بزرگ نوشته می‌شود.', fix: (m) => m[0].replace(/^i/, 'I') },
  { re: /\b(he|she|it)\s+(are|am)\b/gi, tag: 'verb_to_be', skill: 'grammar', note_fa: 'با فاعل سوم‌شخص مفرد از is استفاده کنید.', fix: (m) => `${m[1]} is` },
  { re: /\b(i)\s+(is|are)\b/gi, tag: 'verb_to_be', skill: 'grammar', note_fa: 'با I همیشه am می‌آید.', fix: () => 'I am' },
  { re: /\b(we|they|you)\s+(is|was)\b/gi, tag: 'verb_to_be', skill: 'grammar', note_fa: 'با فاعل جمع از are/were استفاده کنید.', fix: (m) => `${m[1]} ${m[2].toLowerCase() === 'is' ? 'are' : 'were'}` },
  { re: /\b(he|she|it)\s+(go|do|have|make|take|want|need|like|work|play|know)\b/gi, tag: 'subject_verb_agreement', skill: 'grammar', note_fa: 'در حال ساده با سوم‌شخص مفرد، فعل s می‌گیرد.', fix: (m) => { const v = m[2].toLowerCase(); const irr: Record<string, string> = { go: 'goes', do: 'does', have: 'has' }; return `${m[1]} ${irr[v] ?? v + 's'}`; } },
  { re: /\bdidn't\s+(\w+ed|went|saw|ate|took|made|came|got|said)\b/gi, tag: 'past_simple', skill: 'grammar', note_fa: 'بعد از didn\'t فعل به شکل ساده می‌آید، نه گذشته.', fix: (m) => { const irr: Record<string, string> = { went: 'go', saw: 'see', ate: 'eat', took: 'take', made: 'make', came: 'come', got: 'get', said: 'say' }; const v = m[1].toLowerCase(); return `didn't ${irr[v] ?? v.replace(/ed$/, '')}`; } },
  { re: /\byesterday\s+i\s+(go|eat|see|take|make|come|get)\b/gi, tag: 'past_simple', skill: 'grammar', note_fa: 'با yesterday باید از گذشته ساده استفاده کنید.', fix: (m) => { const irr: Record<string, string> = { go: 'went', eat: 'ate', see: 'saw', take: 'took', make: 'made', come: 'came', get: 'got' }; return `Yesterday I ${irr[m[1].toLowerCase()]}`; } },
  { re: /\bmore\s+(bigger|better|taller|faster|smaller|easier|happier|older|younger)\b/gi, tag: 'comparatives', skill: 'grammar', note_fa: 'صفت تفضیلی را همزمان با more و er نسازید.', fix: (m) => m[1].toLowerCase() },
  // "a" before a vowel SOUND (includes silent-h words such as honest/hour)
  { re: /\ba\s+((?:[aeiou]|h(?:onest|onour|onor|our|eir))\w*)/gi, tag: 'article', skill: 'grammar', note_fa: 'قبل از صدای مصوت از an استفاده می‌شود (حتی اگر حرف اول h بی‌صدا باشد، مثل honest و hour).', fix: (m) => `an ${m[1]}` },
  // "an" before a consonant SOUND (u-/eu- words such as university sound like /ju/)
  { re: /\ban\s+((?:[bcdfgjklmnpqrstvwxyz]|u(?:ni|se|ser|ni|ro|tili)|eu)\w*)/gi, tag: 'article', skill: 'grammar', note_fa: 'قبل از صدای بی‌صدا از a استفاده می‌شود (کلماتی مثل university با صدای /ju/ شروع می‌شوند).', fix: (m) => `a ${m[1]}` },
  { re: /\bdepend\s+of\b/gi, tag: 'preposition', skill: 'grammar', note_fa: 'ترکیب درست depend on است.', fix: () => 'depend on' },
  { re: /\bgood\s+in\s+(english|math|sport)/gi, tag: 'preposition', skill: 'grammar', note_fa: 'ترکیب درست good at است.', fix: (m) => `good at ${m[1]}` },
  { re: /\bmarried\s+with\b/gi, tag: 'preposition', skill: 'grammar', note_fa: 'ترکیب درست married to است.', fix: () => 'married to' },
  { re: /\bexplain\s+me\b/gi, tag: 'word_order', skill: 'grammar', note_fa: 'درست: explain to me.', fix: () => 'explain to me' },
  { re: /\bmany\s+(information|advice|money|furniture|homework|news)\b/gi, tag: 'quantifiers', skill: 'grammar', note_fa: 'با اسم غیرقابل شمارش از much استفاده کنید.', fix: (m) => `much ${m[1]}` },
  { re: /\b(informations|advices|moneys|furnitures|homeworks|newses|peoples)\b/gi, tag: 'uncountable', skill: 'grammar', note_fa: 'این اسم غیرقابل شمارش است و جمع بسته نمی‌شود.', fix: (m) => m[1].replace(/e?s$/, '') },
  { re: /\bfor\s+(improve|learn|study|practice|get|make)\b/gi, tag: 'infinitive_purpose', skill: 'grammar', note_fa: 'برای بیان هدف از to + فعل استفاده کنید.', fix: (m) => `to ${m[1]}` },
  // "since" + a DURATION (digits or spelled-out numbers) should be "for"
  { re: /\bsince\s+((?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|many|several|few|a\s+few)\s+)?(years?|months?|weeks?|days?|hours?|minutes?|decades?|ages)\b/gi, tag: 'since_for', skill: 'grammar', note_fa: 'برای بیان مدت‌زمان از for استفاده کنید، نه since. (since برای نقطه شروع است، مثل since 2020)', fix: (m) => `for ${m[1] ?? ''}${m[2]}` },
  { re: /\bi\s+am\s+agree\b/gi, tag: 'verb_choice', skill: 'grammar', note_fa: 'درست: I agree (بدون am).', fix: () => 'I agree' },
  { re: /\bhow\s+much\s+(people|books|students|cars|things)\b/gi, tag: 'quantifiers', skill: 'grammar', note_fa: 'با اسم قابل شمارش از how many استفاده کنید.', fix: (m) => `how many ${m[1]}` },
  { re: /\b(recieve|beleive|seperate|definately|occured|adress|wich|thier|alot)\b/gi, tag: 'spelling', skill: 'writing', note_fa: 'املای این کلمه اشتباه است.', fix: (m) => ({ recieve: 'receive', beleive: 'believe', seperate: 'separate', definately: 'definitely', occured: 'occurred', adress: 'address', wich: 'which', thier: 'their', alot: 'a lot' }[m[1].toLowerCase()] ?? m[1]) },
];

export interface LocalGrade {
  score: number;
  is_correct: boolean;
  feedback_fa: string;
  strengths_fa: string[];
  improvements_fa: string[];
  corrected_text: string;
  errors: (Correction & { skill: SkillKind })[];
}

export function localGrade(text: string, skill: SkillKind = 'writing'): LocalGrade {
  const original = (text ?? '').trim();
  let corrected = original;
  const errors: (Correction & { skill: SkillKind })[] = [];
  const seen = new Set<string>();

  for (const rule of RULES) {
    const matches = Array.from(original.matchAll(rule.re));
    for (const m of matches) {
      const right = rule.fix(m);
      if (right.toLowerCase() === m[0].toLowerCase()) continue;
      const key = `${rule.tag}:${m[0].toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      errors.push({ wrong: m[0], right, note_fa: rule.note_fa, error_tag: rule.tag, skill: rule.skill });
      corrected = corrected.replace(m[0], right);
    }
  }

  // sentence-level checks
  const words = original.split(/\s+/).filter(Boolean);
  if (original && !/[.!?]$/.test(original)) {
    errors.push({ wrong: original.slice(-16), right: original.slice(-16) + '.', note_fa: 'جمله را با نقطه یا علامت پایانی تمام کنید.', error_tag: 'punctuation', skill: 'writing' });
    corrected = corrected.replace(/\s*$/, '.');
  }
  if (original && /^[a-z]/.test(original)) {
    errors.push({ wrong: original.slice(0, 12), right: original.charAt(0).toUpperCase() + original.slice(1, 12), note_fa: 'جمله باید با حرف بزرگ شروع شود.', error_tag: 'capitalization', skill: 'writing' });
    corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
  }

  const errorRate = words.length ? errors.length / Math.max(words.length / 8, 1) : 1;
  let score = Math.round(Math.max(0, Math.min(100, 100 - errorRate * 22)));
  if (words.length < 4) score = Math.min(score, 55);

  const strengths: string[] = [];
  if (words.length >= 25) strengths.push('طول پاسخ مناسب و کافی است.');
  if (errors.filter((e) => e.error_tag === 'spelling').length === 0) strengths.push('املای کلمات درست است.');
  if (/\b(because|although|however|therefore|which|while|so that)\b/i.test(original)) strengths.push('از جملات پیچیده و کلمات ربط استفاده کرده‌اید. عالی!');
  if (!strengths.length) strengths.push('تلاش خوبی بود؛ ادامه بده!');

  const improvements = Array.from(new Set(errors.map((e) => e.note_fa))).slice(0, 5);
  if (!improvements.length) improvements.push('برای پیشرفت بیشتر، جملات طولانی‌تر و متنوع‌تر بنویسید.');

  const feedback_fa =
    errors.length === 0
      ? `عالی بود! هیچ اشتباه قابل توجهی در بخش ${SKILL_FA[skill]} پیدا نکردم. امتیاز شما ${score} از ۱۰۰.`
      : `${errors.length} نکته برای بهبود پیدا کردم. امتیاز شما ${score} از ۱۰۰. مهم‌ترین نکته: ${errors[0].note_fa}`;

  return { score, is_correct: score >= 70, feedback_fa, strengths_fa: strengths, improvements_fa: improvements, corrected_text: corrected, errors };
}

// ------------------------------------------------------------
// 2) Local conversation engine
// ------------------------------------------------------------
const OPENERS = [
  "That's interesting! Tell me more about it.",
  'Nice! I like how you explained that.',
  'Good point. I hadn\'t thought of it that way.',
  'Thanks for sharing that with me.',
  'I see what you mean.',
];

const FOLLOW_UPS = [
  'What do you usually do at the weekend?',
  'How did that make you feel?',
  'Can you describe it in more detail?',
  'What would you change about it?',
  'Have you tried something similar before?',
  'Why do you think that happened?',
  'What is your plan for next week?',
];

const OPENER_FA = [
  'جالب بود! بیشتر برایم بگو.',
  'خوب بود! توضیحت را دوست داشتم.',
  'نکته خوبی است. از این زاویه به آن فکر نکرده بودم.',
  'ممنون که این را با من در میان گذاشتی.',
  'منظورت را متوجه شدم.',
];

const FOLLOW_UPS_FA = [
  'معمولاً آخر هفته چه می‌کنی؟',
  'چه حسی به تو داد؟',
  'می‌توانی با جزئیات بیشتری توضیح دهی؟',
  'چه چیزی را در آن تغییر می‌دادی؟',
  'قبلاً چیز مشابهی را امتحان کرده‌ای؟',
  'چرا فکر می‌کنی این اتفاق افتاد؟',
  'برنامه‌ات برای هفته آینده چیست؟',
];

export interface LocalReply {
  reply: string;
  translation_fa: string;
  corrections: Correction[];
  new_words: VocabSeed[];
}

export function localReply(userText: string, ctx: LearnerContext = {}): LocalReply {
  const graded = localGrade(userText, 'speaking');
  const h = hash(userText);
  const opener = OPENERS[h % OPENERS.length];
  const openerFa = OPENER_FA[h % OPENER_FA.length];

  let follow = FOLLOW_UPS[(h >> 3) % FOLLOW_UPS.length];
  let followFa = FOLLOW_UPS_FA[(h >> 3) % FOLLOW_UPS_FA.length];

  if (ctx.interests?.length) {
    const topic = ctx.interests[h % ctx.interests.length];
    follow = `By the way, tell me about ${topic} — what do you enjoy most about it?`;
    followFa = `راستی، درباره «${topic}» بگو — بیشتر از چه چیزش لذت می‌بری؟`;
  }

  return {
    reply: `${opener} ${follow}`,
    translation_fa: `${openerFa} ${followFa}`,
    corrections: graded.errors.map(({ wrong, right, note_fa, error_tag }) => ({ wrong, right, note_fa, error_tag })),
    new_words: [],
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// ------------------------------------------------------------
// 3) Local lesson generator
// ------------------------------------------------------------
interface LessonTemplate {
  title: string;
  title_fa: string;
  summary_fa: string;
  sections: { heading_fa: string; body_fa: string; examples: { en: string; fa: string }[]; tip_fa: string }[];
  vocabulary: VocabSeed[];
  exercises: { kind: 'mcq' | 'fill_blank'; prompt: string; prompt_fa: string; options: string[]; correct_answer: number; explanation_fa: string; error_tag: string }[];
}

const LESSON_TEMPLATES: Record<string, LessonTemplate> = {
  past_simple: {
    title: 'Past Simple Tense',
    title_fa: 'زمان گذشته ساده',
    summary_fa: 'یادگیری ساخت و کاربرد زمان گذشته ساده برای بیان کارهای تمام‌شده.',
    sections: [
      { heading_fa: 'گذشته ساده چیست؟', body_fa: 'زمان گذشته ساده برای کارهایی به‌کار می‌رود که در گذشته شروع شده و تمام شده‌اند. معمولاً با قیدهای زمان مثل yesterday، last week و in 2020 همراه است.', examples: [{ en: 'I watched a film yesterday.', fa: 'دیروز یک فیلم تماشا کردم.' }, { en: 'They travelled to Shiraz last month.', fa: 'ماه گذشته به شیراز سفر کردند.' }], tip_fa: 'اگر زمان مشخصی در گذشته ذکر شده، حتماً از گذشته ساده استفاده کنید.' },
      { heading_fa: 'افعال باقاعده و بی‌قاعده', body_fa: 'افعال باقاعده در گذشته ed می‌گیرند (work → worked). اما افعال بی‌قاعده شکل خاص خود را دارند و باید حفظ شوند (go → went، see → saw، eat → ate).', examples: [{ en: 'She finished her homework.', fa: 'او تکالیفش را تمام کرد.' }, { en: 'He went to the market.', fa: 'او به بازار رفت.' }], tip_fa: 'روزی ۵ فعل بی‌قاعده حفظ کنید؛ در یک ماه بر همه مسلط می‌شوید.' },
      { heading_fa: 'جملات منفی و سؤالی', body_fa: 'برای منفی کردن از didn\'t + شکل ساده فعل استفاده می‌کنیم و برای سؤال از Did + فاعل + شکل ساده فعل. توجه کنید که بعد از did و didn\'t فعل هرگز گذشته نمی‌شود.', examples: [{ en: "I didn't go to school.", fa: 'به مدرسه نرفتم.' }, { en: 'Did you see him?', fa: 'او را دیدی؟' }], tip_fa: 'رایج‌ترین اشتباه فارسی‌زبانان: گفتن didn\'t went به‌جای didn\'t go.' },
    ],
    vocabulary: [
      { word: 'yesterday', meaning_fa: 'دیروز', example_en: 'I called her yesterday.', example_fa: 'دیروز به او زنگ زدم.', part_of_speech: 'adverb' },
      { word: 'travel', meaning_fa: 'سفر کردن', example_en: 'We travelled by train.', example_fa: 'با قطار سفر کردیم.', part_of_speech: 'verb' },
      { word: 'finish', meaning_fa: 'تمام کردن', example_en: 'She finished the book.', example_fa: 'او کتاب را تمام کرد.', part_of_speech: 'verb' },
      { word: 'happen', meaning_fa: 'اتفاق افتادن', example_en: 'What happened?', example_fa: 'چه اتفاقی افتاد؟', part_of_speech: 'verb' },
      { word: 'remember', meaning_fa: 'به یاد آوردن', example_en: 'I remembered his name.', example_fa: 'اسمش را به یاد آوردم.', part_of_speech: 'verb' },
      { word: 'decide', meaning_fa: 'تصمیم گرفتن', example_en: 'They decided to stay.', example_fa: 'تصمیم گرفتند بمانند.', part_of_speech: 'verb' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'Last night we ___ dinner at 8.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['have', 'had', 'has', 'having'], correct_answer: 1, explanation_fa: 'last night نشانه گذشته است؛ گذشته have می‌شود had.', error_tag: 'past_simple' },
      { kind: 'mcq', prompt: "She didn't ___ the message.", prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['saw', 'seen', 'see', 'sees'], correct_answer: 2, explanation_fa: "بعد از didn't فعل ساده می‌آید.", error_tag: 'past_simple' },
      { kind: 'mcq', prompt: '___ you finish the project?', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['Do', 'Did', 'Does', 'Done'], correct_answer: 1, explanation_fa: 'برای سؤال در گذشته ساده از Did استفاده می‌شود.', error_tag: 'past_simple' },
      { kind: 'mcq', prompt: 'They ___ to Isfahan in 2019.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['go', 'goes', 'went', 'gone'], correct_answer: 2, explanation_fa: 'گذشته go می‌شود went.', error_tag: 'past_simple' },
      { kind: 'mcq', prompt: 'I ___ my keys this morning.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['lose', 'lost', 'losed', 'losing'], correct_answer: 1, explanation_fa: 'lose یک فعل بی‌قاعده است و گذشته آن lost می‌شود.', error_tag: 'past_simple' },
      { kind: 'mcq', prompt: 'He ___ very tired after the trip.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['is', 'was', 'were', 'be'], correct_answer: 1, explanation_fa: 'با he در گذشته از was استفاده می‌شود.', error_tag: 'verb_to_be' },
    ],
  },
  present_perfect: {
    title: 'Present Perfect',
    title_fa: 'حال کامل',
    summary_fa: 'کاربرد حال کامل برای تجربه‌ها و کارهایی که تا اکنون ادامه دارند.',
    sections: [
      { heading_fa: 'ساختار حال کامل', body_fa: 'حال کامل با have/has + قسمت سوم فعل ساخته می‌شود و برای بیان تجربه، تغییر، یا کاری که نتیجه‌اش تا الان ادامه دارد به‌کار می‌رود.', examples: [{ en: 'I have visited Paris twice.', fa: 'دو بار پاریس رفته‌ام.' }, { en: 'She has finished her work.', fa: 'او کارش را تمام کرده است.' }], tip_fa: 'اگر زمان دقیق گذشته ذکر شود، باید از گذشته ساده استفاده کنید نه حال کامل.' },
      { heading_fa: 'since و for', body_fa: 'since برای نقطه شروع (since 2020، since Monday) و for برای مدت‌زمان (for three years، for two hours) استفاده می‌شود.', examples: [{ en: 'I have lived here since 2018.', fa: 'از سال ۲۰۱۸ اینجا زندگی می‌کنم.' }, { en: 'We have known each other for ten years.', fa: 'ده سال است که همدیگر را می‌شناسیم.' }], tip_fa: 'اشتباه رایج: since ten years — درستش for ten years است.' },
      { heading_fa: 'already، yet، just', body_fa: 'already در جملات مثبت، yet در منفی و سؤالی، و just برای کاری که همین الان تمام شده به‌کار می‌رود.', examples: [{ en: 'I have already eaten.', fa: 'قبلاً غذا خورده‌ام.' }, { en: "He hasn't arrived yet.", fa: 'او هنوز نرسیده است.' }], tip_fa: 'just همیشه بین have و فعل اصلی قرار می‌گیرد.' },
    ],
    vocabulary: [
      { word: 'already', meaning_fa: 'قبلاً، پیش از این', example_en: 'I have already seen it.', example_fa: 'قبلاً آن را دیده‌ام.', part_of_speech: 'adverb' },
      { word: 'yet', meaning_fa: 'هنوز', example_en: "She hasn't called yet.", example_fa: 'او هنوز زنگ نزده است.', part_of_speech: 'adverb' },
      { word: 'experience', meaning_fa: 'تجربه', example_en: 'It was a great experience.', example_fa: 'تجربه فوق‌العاده‌ای بود.', part_of_speech: 'noun' },
      { word: 'achieve', meaning_fa: 'به دست آوردن، رسیدن به', example_en: 'She has achieved her goal.', example_fa: 'او به هدفش رسیده است.', part_of_speech: 'verb' },
      { word: 'recently', meaning_fa: 'اخیراً', example_en: 'I have recently moved.', example_fa: 'اخیراً نقل مکان کرده‌ام.', part_of_speech: 'adverb' },
      { word: 'improve', meaning_fa: 'بهبود یافتن', example_en: 'My English has improved.', example_fa: 'انگلیسی‌ام بهتر شده است.', part_of_speech: 'verb' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'I have lived here ___ five years.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['since', 'for', 'from', 'during'], correct_answer: 1, explanation_fa: 'برای مدت‌زمان از for استفاده می‌شود.', error_tag: 'since_for' },
      { kind: 'mcq', prompt: 'She ___ finished her homework.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['have', 'has', 'had', 'having'], correct_answer: 1, explanation_fa: 'با she از has استفاده می‌شود.', error_tag: 'present_perfect' },
      { kind: 'mcq', prompt: "They haven't arrived ___.", prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['already', 'yet', 'just', 'ever'], correct_answer: 1, explanation_fa: 'در جملات منفی از yet استفاده می‌شود.', error_tag: 'present_perfect' },
      { kind: 'mcq', prompt: 'Have you ___ been to London?', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['ever', 'never', 'yet', 'still'], correct_answer: 0, explanation_fa: 'در سؤال تجربه از ever استفاده می‌شود.', error_tag: 'present_perfect' },
      { kind: 'mcq', prompt: 'I have known him ___ we were children.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['for', 'since', 'from', 'while'], correct_answer: 1, explanation_fa: 'since نقطه شروع را نشان می‌دهد.', error_tag: 'since_for' },
      { kind: 'mcq', prompt: 'He has ___ his keys.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['lose', 'lost', 'losing', 'loses'], correct_answer: 1, explanation_fa: 'قسمت سوم lose می‌شود lost.', error_tag: 'present_perfect' },
    ],
  },
  articles: {
    title: 'Articles: a, an, the',
    title_fa: 'حروف تعریف: a، an، the',
    summary_fa: 'یادگیری کاربرد درست حروف تعریف که یکی از سخت‌ترین بخش‌ها برای فارسی‌زبانان است.',
    sections: [
      { heading_fa: 'a و an', body_fa: 'a و an برای اسم مفرد قابل شمارش نامعین به‌کار می‌روند. انتخاب بین a و an به صدای اولین حرف بستگی دارد نه املای آن: قبل از صدای مصوت an و قبل از صدای بی‌صدا a.', examples: [{ en: 'I need a pen.', fa: 'یک خودکار لازم دارم.' }, { en: 'She is an engineer.', fa: 'او یک مهندس است.' }], tip_fa: 'an hour درست است چون h تلفظ نمی‌شود؛ a university هم درست است چون با صدای /ju/ شروع می‌شود.' },
      { heading_fa: 'the', body_fa: 'the وقتی استفاده می‌شود که هم گوینده و هم شنونده بدانند درباره کدام چیز صحبت می‌شود؛ یا وقتی چیزی قبلاً ذکر شده، یا منحصربه‌فرد است.', examples: [{ en: 'The sun is bright today.', fa: 'امروز خورشید درخشان است.' }, { en: 'I bought a car. The car is red.', fa: 'یک ماشین خریدم. ماشین قرمز است.' }], tip_fa: 'در فارسی حرف تعریف نداریم، برای همین این بخش نیاز به تمرین زیاد دارد.' },
      { heading_fa: 'بدون حرف تعریف', body_fa: 'با اسم‌های جمع کلی، اسم‌های غیرقابل شمارش کلی، نام کشورها (اکثراً)، وعده‌های غذایی و زبان‌ها معمولاً حرف تعریف نمی‌آید.', examples: [{ en: 'I like music.', fa: 'موسیقی دوست دارم.' }, { en: 'She speaks English.', fa: 'او انگلیسی صحبت می‌کند.' }], tip_fa: 'اشتباه رایج: the life is hard — درستش life is hard است.' },
    ],
    vocabulary: [
      { word: 'unique', meaning_fa: 'منحصربه‌فرد', example_en: 'It is a unique idea.', example_fa: 'ایده منحصربه‌فردی است.', part_of_speech: 'adjective' },
      { word: 'specific', meaning_fa: 'مشخص، معین', example_en: 'Be more specific.', example_fa: 'دقیق‌تر بگو.', part_of_speech: 'adjective' },
      { word: 'general', meaning_fa: 'کلی، عمومی', example_en: 'In general, it works.', example_fa: 'به‌طور کلی کار می‌کند.', part_of_speech: 'adjective' },
      { word: 'hour', meaning_fa: 'ساعت', example_en: 'I waited an hour.', example_fa: 'یک ساعت منتظر ماندم.', part_of_speech: 'noun' },
      { word: 'university', meaning_fa: 'دانشگاه', example_en: 'She goes to a university.', example_fa: 'او به دانشگاه می‌رود.', part_of_speech: 'noun' },
      { word: 'choice', meaning_fa: 'انتخاب', example_en: 'It was a good choice.', example_fa: 'انتخاب خوبی بود.', part_of_speech: 'noun' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'She is ___ honest person.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['a', 'an', 'the', '—'], correct_answer: 1, explanation_fa: 'در honest حرف h تلفظ نمی‌شود، پس an می‌آید.', error_tag: 'article' },
      { kind: 'mcq', prompt: 'I saw ___ moon last night.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['a', 'an', 'the', '—'], correct_answer: 2, explanation_fa: 'ماه منحصربه‌فرد است، پس the می‌آید.', error_tag: 'article' },
      { kind: 'mcq', prompt: 'He studies at ___ university.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['a', 'an', 'the', '—'], correct_answer: 0, explanation_fa: 'university با صدای /ju/ شروع می‌شود، پس a می‌آید.', error_tag: 'article' },
      { kind: 'mcq', prompt: '___ life is beautiful.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['A', 'An', 'The', '—'], correct_answer: 3, explanation_fa: 'با مفهوم کلی حرف تعریف نمی‌آید.', error_tag: 'article' },
      { kind: 'mcq', prompt: 'Can you pass me ___ salt?', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['a', 'an', 'the', '—'], correct_answer: 2, explanation_fa: 'نمکی که روی میز است مشخص است، پس the می‌آید.', error_tag: 'article' },
      { kind: 'mcq', prompt: 'I waited for ___ hour.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['a', 'an', 'the', '—'], correct_answer: 1, explanation_fa: 'hour با صدای مصوت شروع می‌شود.', error_tag: 'article' },
    ],
  },
  daily_conversation: {
    title: 'Everyday Conversations',
    title_fa: 'مکالمات روزمره',
    summary_fa: 'عبارات کاربردی برای گفت‌وگوهای روزمره و موقعیت‌های واقعی.',
    sections: [
      { heading_fa: 'سلام و احوال‌پرسی', body_fa: 'در انگلیسی احوال‌پرسی بسته به موقعیت رسمی یا غیررسمی متفاوت است. در محیط دوستانه از Hey و What\'s up و در محیط رسمی از Good morning و How do you do استفاده کنید.', examples: [{ en: "Hi! How's it going?", fa: 'سلام! اوضاع چطوره؟' }, { en: 'Good morning. How are you today?', fa: 'صبح بخیر. امروز چطورید؟' }], tip_fa: 'پاسخ کوتاه و متقابل بدهید: Not bad, thanks. And you?' },
      { heading_fa: 'درخواست مؤدبانه', body_fa: 'برای درخواست مؤدبانه از Could you، Would you mind و May I استفاده کنید. استفاده از please لحن را بسیار مؤدبانه‌تر می‌کند.', examples: [{ en: 'Could you help me, please?', fa: 'می‌شود لطفاً کمکم کنید؟' }, { en: 'Would you mind opening the window?', fa: 'اشکالی ندارد پنجره را باز کنید؟' }], tip_fa: 'بعد از Would you mind فعل ing می‌گیرد.' },
      { heading_fa: 'ابراز نظر', body_fa: 'برای بیان نظر از In my opinion، I think، I believe و Personally استفاده کنید. برای مخالفت مؤدبانه از I see your point, but... کمک بگیرید.', examples: [{ en: 'In my opinion, this is the best option.', fa: 'به نظر من این بهترین گزینه است.' }, { en: "I see your point, but I disagree.", fa: 'منظورت را می‌فهمم، اما موافق نیستم.' }], tip_fa: 'به‌جای I am agree بگویید I agree.' },
    ],
    vocabulary: [
      { word: 'appreciate', meaning_fa: 'قدردانی کردن', example_en: 'I appreciate your help.', example_fa: 'از کمکت ممنونم.', part_of_speech: 'verb' },
      { word: 'apologise', meaning_fa: 'عذرخواهی کردن', example_en: 'I apologise for being late.', example_fa: 'بابت تأخیر عذر می‌خواهم.', part_of_speech: 'verb' },
      { word: 'suggest', meaning_fa: 'پیشنهاد دادن', example_en: 'I suggest we leave now.', example_fa: 'پیشنهاد می‌کنم الان برویم.', part_of_speech: 'verb' },
      { word: 'convenient', meaning_fa: 'مناسب، راحت', example_en: 'Is Monday convenient for you?', example_fa: 'دوشنبه برایتان مناسب است؟' , part_of_speech: 'adjective' },
      { word: 'available', meaning_fa: 'در دسترس', example_en: 'Are you available tomorrow?', example_fa: 'فردا وقت دارید؟', part_of_speech: 'adjective' },
      { word: 'prefer', meaning_fa: 'ترجیح دادن', example_en: 'I prefer tea to coffee.', example_fa: 'چای را به قهوه ترجیح می‌دهم.', part_of_speech: 'verb' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'Would you mind ___ the door?', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['close', 'closing', 'to close', 'closed'], correct_answer: 1, explanation_fa: 'بعد از mind فعل ing می‌گیرد.', error_tag: 'gerund_infinitive' },
      { kind: 'mcq', prompt: 'I ___ with your opinion.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['am agree', 'agree', 'agreeing', 'am agreeing'], correct_answer: 1, explanation_fa: 'agree خودش فعل است و به am نیاز ندارد.', error_tag: 'verb_choice' },
      { kind: 'mcq', prompt: 'I prefer tea ___ coffee.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['than', 'to', 'from', 'over than'], correct_answer: 1, explanation_fa: 'ساختار درست prefer A to B است.', error_tag: 'preposition' },
      { kind: 'mcq', prompt: '___ you help me with this?', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['Could', 'Should', 'Must', 'May'], correct_answer: 0, explanation_fa: 'Could مؤدبانه‌ترین شکل درخواست است.', error_tag: 'modals' },
      { kind: 'mcq', prompt: 'Thanks a lot! — ___', prompt_fa: 'مناسب‌ترین پاسخ را انتخاب کنید.', options: ['No problem.', 'Yes please.', 'I am fine.', 'Good bye.'], correct_answer: 0, explanation_fa: 'پاسخ رایج به تشکر No problem است.', error_tag: 'functional_language' },
      { kind: 'mcq', prompt: 'Is Friday ___ for you?', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['comfortable', 'convenient', 'available', 'possible to'], correct_answer: 1, explanation_fa: 'برای زمان مناسب از convenient استفاده می‌شود.', error_tag: 'collocations' },
    ],
  },
};

const TOPIC_MAP: Record<SkillKind, string[]> = {
  grammar: ['past_simple', 'present_perfect', 'articles'],
  vocabulary: ['daily_conversation', 'articles'],
  listening: ['daily_conversation'],
  speaking: ['daily_conversation'],
  reading: ['present_perfect', 'articles'],
  writing: ['articles', 'past_simple'],
};

export function localLesson(skill: SkillKind, level: CefrLevel, hintTag?: string) {
  let key = hintTag && LESSON_TEMPLATES[hintTag] ? hintTag : undefined;
  if (!key) {
    const pool = TOPIC_MAP[skill] ?? ['past_simple'];
    key = pool[Math.floor(Math.random() * pool.length)];
  }
  const t = LESSON_TEMPLATES[key];
  return {
    ...t,
    est_minutes: 12,
    topic: key,
    level,
    skill,
    title_fa: `${t.title_fa} — سطح ${level} (${LEVEL_FA[level]})`,
  };
}

// ------------------------------------------------------------
// 4) Local coach
// ------------------------------------------------------------
export function localCoach(ctx: LearnerContext & { streak?: number; minutesThisWeek?: number; weakestSkill?: SkillKind }) {
  const name = ctx.fullName || 'زبان‌آموز عزیز';
  const level = ctx.level ?? 'A1';
  const weak = ctx.weaknesses?.[0];
  const weakSkill = ctx.weakestSkill ?? 'grammar';

  const steps = [
    { title_fa: weak ? `تمرین هدفمند روی «${weak.label}»` : `تمرین ${SKILL_FA[weakSkill]}`, why_fa: weak ? `این اشتباه ${weak.occurrences} بار تکرار شده و بیشترین تأثیر را روی نمره شما دارد.` : `${SKILL_FA[weakSkill]} ضعیف‌ترین مهارت فعلی شماست.`, minutes: 12, skill: weakSkill },
    { title_fa: 'مرور لغات سررسیدشده', why_fa: 'مرور به‌موقع باعث می‌شود لغات به حافظه بلندمدت منتقل شوند.', minutes: 8, skill: 'vocabulary' as SkillKind },
    { title_fa: 'یک مکالمه کوتاه با مربی هوشمند', why_fa: 'تولید فعال زبان سریع‌ترین راه تثبیت آموخته‌هاست.', minutes: 10, skill: 'speaking' as SkillKind },
  ];

  const streak = ctx as { streak?: number };
  const motivations = [
    'هر روز ۱۵ دقیقه، از هفته‌ای دو ساعت یک‌باره مؤثرتر است. 💪',
    'اشتباه کردن یعنی داری یاد می‌گیری. ادامه بده! 🌱',
    'زبان با تکرار ساخته می‌شود، نه با استعداد. 🚀',
    'همین امروز یک قدم کوچک بردار؛ فردا خودت را تشویق خواهی کرد. ⭐',
  ];

  return {
    greeting_fa: `سلام ${name}! 👋`,
    analysis_fa: `سطح فعلی شما ${level} (${LEVEL_FA[level]}) است${streak.streak ? ` و ${streak.streak} روز پیاپی فعال بوده‌اید` : ''}. ${weak ? `الگوی تکرارشونده‌ای در «${weak.label}» دیده می‌شود که با تمرین هدفمند سریع برطرف می‌شود.` : 'روند یادگیری‌تان متعادل است؛ برای رشد سریع‌تر روی تولید زبان تمرکز کنید.'}`,
    focus_area_fa: weak ? weak.label : SKILL_FA[weakSkill],
    next_steps: steps,
    motivation_fa: motivations[Math.floor(Math.random() * motivations.length)],
  };
}

// ------------------------------------------------------------
// 5) SM-2 spaced repetition
// ------------------------------------------------------------
export interface Sm2Input { ease_factor: number; interval_days: number; repetitions: number; lapses: number; }
export interface Sm2Output extends Sm2Input { next_review_at: string; mastery: number; }

/** quality: 0 = forgot, 3 = hard, 4 = good, 5 = easy */
export function sm2(prev: Sm2Input, quality: number): Sm2Output {
  let { ease_factor: ef, interval_days: interval, repetitions: reps, lapses } = prev;

  if (quality < 3) {
    reps = 0;
    interval = 1;
    lapses += 1;
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(interval * ef);
  }

  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  ef = Math.max(1.3, Math.min(2.8, ef));

  const next = new Date();
  next.setDate(next.getDate() + interval);

  const mastery = Math.max(0, Math.min(1, reps / 6 - lapses * 0.08));

  return {
    ease_factor: Number(ef.toFixed(2)),
    interval_days: interval,
    repetitions: reps,
    lapses,
    next_review_at: next.toISOString(),
    mastery: Number(mastery.toFixed(3)),
  };
}

// ------------------------------------------------------------
// 6) Level scoring
// ------------------------------------------------------------
export function scoreToLevel(score: number): CefrLevel {
  if (score < 25) return 'A1';
  if (score < 42) return 'A2';
  if (score < 60) return 'B1';
  if (score < 76) return 'B2';
  if (score < 90) return 'C1';
  return 'C2';
}

export function levelIndex(l: CefrLevel): number {
  return ORDER.indexOf(l);
}

export function nextLevel(l: CefrLevel): CefrLevel {
  return ORDER[Math.min(ORDER.indexOf(l) + 1, 5)];
}

/** Weighted placement scoring — harder correct answers count more. */
export function computePlacement(
  answers: { level: CefrLevel; correct: boolean; skill: SkillKind }[]
): { score: number; level: CefrLevel; breakdown: Record<string, number> } {
  if (!answers.length) return { score: 0, level: 'A1', breakdown: {} };

  const weights: Record<CefrLevel, number> = { A1: 1, A2: 1.6, B1: 2.4, B2: 3.4, C1: 4.6, C2: 6 };

  let earned = 0;
  let total = 0;
  const bySkill: Record<string, { e: number; t: number }> = {};

  for (const a of answers) {
    const w = weights[a.level];
    total += w;
    if (a.correct) earned += w;
    bySkill[a.skill] ??= { e: 0, t: 0 };
    bySkill[a.skill].t += w;
    if (a.correct) bySkill[a.skill].e += w;
  }

  const score = Number(((earned / total) * 100).toFixed(2));
  const breakdown: Record<string, number> = {};
  for (const [k, v] of Object.entries(bySkill)) {
    breakdown[k] = Number(((v.e / v.t) * 100).toFixed(2));
  }

  return { score, level: scoreToLevel(score), breakdown };
}
