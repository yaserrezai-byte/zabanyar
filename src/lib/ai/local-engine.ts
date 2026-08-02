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
  { re: /\b(recieve|beleive|seperate|definately|occured|adress|wich|thier|alot|intresting|interresting|becouse|beacuse|writting|allways|wich|goverment|enviroment|wether|tommorow|untill|realy|succesful|neccessary|comfortmable|diffrent|langauge|betwen|freind|wierd|acheive)\b/gi, tag: 'spelling', skill: 'writing', note_fa: 'املای این کلمه اشتباه است.', fix: (m) => ({ recieve: 'receive', beleive: 'believe', seperate: 'separate', definately: 'definitely', occured: 'occurred', adress: 'address', wich: 'which', thier: 'their', alot: 'a lot', intresting: 'interesting', interresting: 'interesting', becouse: 'because', beacuse: 'because', writting: 'writing', allways: 'always', goverment: 'government', enviroment: 'environment', wether: 'whether', tommorow: 'tomorrow', untill: 'until', realy: 'really', succesful: 'successful', neccessary: 'necessary', comfortmable: 'comfortable', diffrent: 'different', langauge: 'language', betwen: 'between', freind: 'friend', wierd: 'weird', acheive: 'achieve' }[m[1].toLowerCase()] ?? m[1]) },
  // Over-regularised irregular verbs — one of the most common Persian-speaker errors
  { re: /\b(buyed|readed|writed|goed|comed|maked|taked|getted|thinked|bringed|teached|catched|falled|feeled|finded|holded|keeped|knowed|leaved|losed|meeted|payed|runned|sayed|seeed|selled|sended|sitted|sleeped|speaked|spended|standed|swimmed|telled|understanded|weared|winned|drinked|driveed|eated|choosed|breaked|builded|beginned)\b/gi, tag: 'irregular_verb', skill: 'grammar', note_fa: 'این فعل بی‌قاعده است و در گذشته ed نمی‌گیرد؛ شکل گذشته‌اش را باید حفظ کنید.', fix: (m) => ({ buyed: 'bought', readed: 'read', writed: 'wrote', goed: 'went', comed: 'came', maked: 'made', taked: 'took', getted: 'got', thinked: 'thought', bringed: 'brought', teached: 'taught', catched: 'caught', falled: 'fell', feeled: 'felt', finded: 'found', holded: 'held', keeped: 'kept', knowed: 'knew', leaved: 'left', losed: 'lost', meeted: 'met', payed: 'paid', runned: 'ran', sayed: 'said', seeed: 'saw', selled: 'sold', sended: 'sent', sitted: 'sat', sleeped: 'slept', speaked: 'spoke', spended: 'spent', standed: 'stood', swimmed: 'swam', telled: 'told', understanded: 'understood', weared: 'wore', winned: 'won', drinked: 'drank', driveed: 'drove', eated: 'ate', choosed: 'chose', breaked: 'broke', builded: 'built', beginned: 'began' }[m[1].toLowerCase()] ?? m[1]) },
  // Double negative (very common transfer error from Persian)
  { re: /\b(didn't|don't|doesn't|can't|won't|haven't|hasn't)\s+(\w+\s+)?(nobody|nothing|nowhere|no one|none)\b/gi, tag: 'double_negative', skill: 'grammar', note_fa: 'در انگلیسی دو منفی همزمان نمی‌آید؛ به‌جای nobody از anybody و به‌جای nothing از anything استفاده کنید.', fix: (m) => { const map: Record<string,string> = { nobody: 'anybody', nothing: 'anything', nowhere: 'anywhere', 'no one': 'anyone', none: 'any' }; return `${m[1]} ${m[2] ?? ''}${map[m[3].toLowerCase()] ?? m[3]}`; } },
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

  // Rules are applied cumulatively: each rule matches against the text
  // produced by the previous ones, so overlapping fixes compose correctly
  // (e.g. "didn't saw nobody" -> "didn't see nobody" -> "didn't see anybody")
  // instead of each rule reinstating stale text from the original.
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    const matches = Array.from(corrected.matchAll(rule.re));
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
  prepositions: {
    title: 'Prepositions of Place and Time',
    title_fa: 'حروف اضافه مکان و زمان',
    summary_fa: 'کاربرد درست in، on و at که یکی از پرتکرارترین اشتباهات فارسی‌زبانان است.',
    sections: [
      { heading_fa: 'حروف اضافه زمان', body_fa: 'برای سال و ماه از in، برای روز و تاریخ از on و برای ساعت دقیق از at استفاده می‌کنیم. این تقسیم‌بندی در فارسی وجود ندارد و باید جداگانه حفظ شود.', examples: [{ en: 'I was born in 1995.', fa: 'در سال ۱۹۹۵ متولد شدم.' }, { en: 'The meeting is on Monday.', fa: 'جلسه روز دوشنبه است.' }, { en: 'We start at 8 o\u2019clock.', fa: 'ساعت ۸ شروع می‌کنیم.' }], tip_fa: 'قاعده بزرگ به کوچک: in (بزرگ‌ترین) ← on ← at (دقیق‌ترین).' },
      { heading_fa: 'حروف اضافه مکان', body_fa: 'in برای فضای بسته، on برای روی سطح و at برای نقطه یا مکان مشخص به‌کار می‌رود.', examples: [{ en: 'She is in the kitchen.', fa: 'او در آشپزخانه است.' }, { en: 'The book is on the table.', fa: 'کتاب روی میز است.' }, { en: 'I am at the bus stop.', fa: 'من در ایستگاه اتوبوس هستم.' }], tip_fa: 'at the station یعنی نقطه‌ای مشخص؛ in the station یعنی داخل ساختمان آن.' },
      { heading_fa: 'ترکیب‌های ثابت', body_fa: 'بعضی افعال حرف اضافه ثابتی دارند که باید با هم حفظ شوند: depend on، good at، interested in، married to، listen to.', examples: [{ en: 'It depends on the weather.', fa: 'به هوا بستگی دارد.' }, { en: 'She is good at maths.', fa: 'او در ریاضی خوب است.' }], tip_fa: 'اشتباه رایج: depend of به‌جای depend on.' },
    ],
    vocabulary: [
      { word: 'depend', meaning_fa: 'بستگی داشتن', example_en: 'It depends on you.', example_fa: 'به تو بستگی دارد.', part_of_speech: 'verb' },
      { word: 'arrive', meaning_fa: 'رسیدن', example_en: 'We arrived at the airport.', example_fa: 'به فرودگاه رسیدیم.', part_of_speech: 'verb' },
      { word: 'between', meaning_fa: 'بین', example_en: 'It is between the bank and the shop.', example_fa: 'بین بانک و مغازه است.', part_of_speech: 'preposition' },
      { word: 'opposite', meaning_fa: 'روبه‌رو', example_en: 'The park is opposite my house.', example_fa: 'پارک روبه‌روی خانه من است.', part_of_speech: 'preposition' },
      { word: 'during', meaning_fa: 'در طول', example_en: 'I slept during the film.', example_fa: 'در طول فیلم خوابیدم.', part_of_speech: 'preposition' },
      { word: 'until', meaning_fa: 'تا وقتی که', example_en: 'Wait until tomorrow.', example_fa: 'تا فردا صبر کن.', part_of_speech: 'preposition' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'I was born ___ 1998.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['in', 'on', 'at', 'to'], correct_answer: 0, explanation_fa: 'برای سال از in استفاده می‌شود.', error_tag: 'preposition' },
      { kind: 'mcq', prompt: 'The class starts ___ 9 a.m.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['in', 'on', 'at', 'by'], correct_answer: 2, explanation_fa: 'برای ساعت دقیق از at استفاده می‌شود.', error_tag: 'preposition' },
      { kind: 'mcq', prompt: 'My birthday is ___ Friday.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['in', 'on', 'at', 'of'], correct_answer: 1, explanation_fa: 'برای روزهای هفته از on استفاده می‌شود.', error_tag: 'preposition' },
      { kind: 'mcq', prompt: 'It depends ___ the price.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['of', 'on', 'to', 'from'], correct_answer: 1, explanation_fa: 'ترکیب ثابت depend on است.', error_tag: 'preposition' },
      { kind: 'mcq', prompt: 'She is very good ___ cooking.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['in', 'on', 'at', 'with'], correct_answer: 2, explanation_fa: 'ترکیب ثابت good at است.', error_tag: 'preposition' },
      { kind: 'mcq', prompt: 'The keys are ___ the drawer.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['in', 'on', 'at', 'by'], correct_answer: 0, explanation_fa: 'برای داخل فضای بسته از in استفاده می‌شود.', error_tag: 'preposition' },
    ],
  },
  comparatives: {
    title: 'Comparatives and Superlatives',
    title_fa: 'صفات تفضیلی و عالی',
    summary_fa: 'مقایسه کردن چیزها با er/est و more/most بدون اشتباه رایج «more taller».',
    sections: [
      { heading_fa: 'صفات کوتاه', body_fa: 'صفات یک‌هجایی با er تفضیلی و با est عالی می‌شوند: tall → taller → the tallest. اگر صفت به یک مصوت و یک بی‌صدا ختم شود، حرف آخر تکرار می‌شود: big → bigger.', examples: [{ en: 'He is taller than me.', fa: 'او از من بلندقدتر است.' }, { en: 'This is the biggest room.', fa: 'این بزرگ‌ترین اتاق است.' }], tip_fa: 'صفاتی که به y ختم می‌شوند: happy → happier → the happiest.' },
      { heading_fa: 'صفات بلند', body_fa: 'صفات دو هجا و بیشتر با more و most مقایسه می‌شوند: expensive → more expensive → the most expensive.', examples: [{ en: 'This phone is more expensive.', fa: 'این گوشی گران‌تر است.' }, { en: 'It was the most interesting film.', fa: 'جالب‌ترین فیلم بود.' }], tip_fa: 'هرگز more و er را با هم به‌کار نبرید: more taller غلط است.' },
      { heading_fa: 'صفات بی‌قاعده و as...as', body_fa: 'good → better → the best و bad → worse → the worst بی‌قاعده‌اند. برای برابری از as ... as استفاده می‌شود.', examples: [{ en: 'My English is better than last year.', fa: 'انگلیسی‌ام از پارسال بهتر است.' }, { en: 'She is as tall as her brother.', fa: 'او هم‌قد برادرش است.' }], tip_fa: 'بعد از صفت تفضیلی از than و بعد از صفت عالی از the استفاده کنید.' },
    ],
    vocabulary: [
      { word: 'expensive', meaning_fa: 'گران', example_en: 'Cars are expensive here.', example_fa: 'ماشین اینجا گران است.', part_of_speech: 'adjective' },
      { word: 'comfortable', meaning_fa: 'راحت', example_en: 'This chair is comfortable.', example_fa: 'این صندلی راحت است.', part_of_speech: 'adjective' },
      { word: 'difficult', meaning_fa: 'دشوار', example_en: 'The test was difficult.', example_fa: 'آزمون دشوار بود.', part_of_speech: 'adjective' },
      { word: 'crowded', meaning_fa: 'شلوغ', example_en: 'The bus was crowded.', example_fa: 'اتوبوس شلوغ بود.', part_of_speech: 'adjective' },
      { word: 'quiet', meaning_fa: 'ساکت', example_en: 'This street is quiet.', example_fa: 'این خیابان ساکت است.', part_of_speech: 'adjective' },
      { word: 'similar', meaning_fa: 'شبیه', example_en: 'They are similar to each other.', example_fa: 'شبیه هم هستند.', part_of_speech: 'adjective' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'This book is ___ than that one.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['more good', 'better', 'gooder', 'best'], correct_answer: 1, explanation_fa: 'good بی‌قاعده است و تفضیلی آن better می‌شود.', error_tag: 'comparatives' },
      { kind: 'mcq', prompt: 'He is ___ student in the class.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['the smartest', 'smartest', 'more smart', 'the most smart'], correct_answer: 0, explanation_fa: 'صفت عالی با the می‌آید و smart کوتاه است پس est می‌گیرد.', error_tag: 'comparatives' },
      { kind: 'mcq', prompt: 'My car is ___ expensive than yours.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['more', 'most', 'much', 'very'], correct_answer: 0, explanation_fa: 'expensive صفت بلند است و با more مقایسه می‌شود.', error_tag: 'comparatives' },
      { kind: 'mcq', prompt: 'She is as tall ___ her sister.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['than', 'as', 'like', 'of'], correct_answer: 1, explanation_fa: 'ساختار برابری as ... as است.', error_tag: 'comparatives' },
      { kind: 'mcq', prompt: 'Today is ___ than yesterday.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['hotter', 'more hot', 'hottest', 'hot'], correct_answer: 0, explanation_fa: 'hot یک‌هجایی است و حرف آخر تکرار می‌شود: hotter.', error_tag: 'comparatives' },
      { kind: 'mcq', prompt: 'This was ___ day of my life.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['worse', 'the worst', 'the baddest', 'more bad'], correct_answer: 1, explanation_fa: 'bad بی‌قاعده است: bad → worse → the worst.', error_tag: 'comparatives' },
    ],
  },
  modals: {
    title: 'Modal Verbs',
    title_fa: 'افعال کمکی وجهی',
    summary_fa: 'can، should، must و would برای بیان توانایی، توصیه، اجبار و درخواست مؤدبانه.',
    sections: [
      { heading_fa: 'ساختار کلی', body_fa: 'بعد از تمام افعال وجهی، فعل اصلی به شکل ساده و بدون to می‌آید. این افعال با سوم‌شخص مفرد s نمی‌گیرند.', examples: [{ en: 'She can swim very well.', fa: 'او خیلی خوب شنا می‌کند.' }, { en: 'You should rest.', fa: 'باید استراحت کنی.' }], tip_fa: 'اشتباه رایج: She can to swim یا He cans — هر دو غلط‌اند.' },
      { heading_fa: 'توانایی و اجازه', body_fa: 'can برای توانایی و اجازه غیررسمی، could برای گذشته یا حالت مؤدبانه‌تر، و may برای اجازه رسمی به‌کار می‌رود.', examples: [{ en: 'Could you help me?', fa: 'می‌شود کمکم کنید؟' }, { en: 'May I come in?', fa: 'اجازه هست وارد شوم؟' }], tip_fa: 'could مؤدبانه‌تر از can است و در درخواست‌ها بهتر جواب می‌دهد.' },
      { heading_fa: 'اجبار و توصیه', body_fa: 'must اجبار قوی و درونی، have to اجبار بیرونی، و should توصیه است. نکته مهم: mustn\u2019t یعنی ممنوع، اما don\u2019t have to یعنی لازم نیست.', examples: [{ en: 'You must stop at a red light.', fa: 'باید پشت چراغ قرمز بایستید.' }, { en: 'You don\u2019t have to come.', fa: 'لازم نیست بیایی.' }], tip_fa: 'تفاوت mustn\u2019t و don\u2019t have to را با هم اشتباه نگیرید.' },
    ],
    vocabulary: [
      { word: 'allowed', meaning_fa: 'مجاز', example_en: 'Smoking is not allowed.', example_fa: 'سیگار کشیدن مجاز نیست.', part_of_speech: 'adjective' },
      { word: 'advice', meaning_fa: 'توصیه', example_en: 'Can you give me some advice?', example_fa: 'می‌توانی به من توصیه‌ای بکنی؟', part_of_speech: 'noun' },
      { word: 'necessary', meaning_fa: 'لازم', example_en: 'It is not necessary.', example_fa: 'لازم نیست.', part_of_speech: 'adjective' },
      { word: 'ability', meaning_fa: 'توانایی', example_en: 'She has the ability to learn fast.', example_fa: 'توانایی یادگیری سریع دارد.', part_of_speech: 'noun' },
      { word: 'permission', meaning_fa: 'اجازه', example_en: 'I need your permission.', example_fa: 'به اجازه شما نیاز دارم.', part_of_speech: 'noun' },
      { word: 'forbidden', meaning_fa: 'ممنوع', example_en: 'Parking here is forbidden.', example_fa: 'پارک کردن اینجا ممنوع است.', part_of_speech: 'adjective' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'She can ___ three languages.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['to speak', 'speak', 'speaks', 'speaking'], correct_answer: 1, explanation_fa: 'بعد از افعال وجهی فعل ساده و بدون to می‌آید.', error_tag: 'modals' },
      { kind: 'mcq', prompt: 'You ___ see a doctor about that cough.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['should', 'can', 'may', 'would'], correct_answer: 0, explanation_fa: 'برای توصیه از should استفاده می‌شود.', error_tag: 'modals' },
      { kind: 'mcq', prompt: '___ you please open the window?', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['Must', 'Could', 'Should', 'Will can'], correct_answer: 1, explanation_fa: 'Could مؤدبانه‌ترین شکل درخواست است.', error_tag: 'modals' },
      { kind: 'mcq', prompt: 'You ___ smoke in the hospital. It is forbidden.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['don\u2019t have to', 'mustn\u2019t', 'shouldn\u2019t have', 'couldn\u2019t'], correct_answer: 1, explanation_fa: 'mustn\u2019t یعنی ممنوع؛ don\u2019t have to یعنی لازم نیست.', error_tag: 'modals' },
      { kind: 'mcq', prompt: 'We ___ hurry, we have plenty of time.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['mustn\u2019t', 'don\u2019t have to', 'can\u2019t', 'shouldn\u2019t have'], correct_answer: 1, explanation_fa: 'وقتی کاری لازم نیست از don\u2019t have to استفاده می‌شود.', error_tag: 'modals' },
      { kind: 'mcq', prompt: 'When I was young, I ___ run very fast.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['can', 'could', 'must', 'should'], correct_answer: 1, explanation_fa: 'برای توانایی در گذشته از could استفاده می‌شود.', error_tag: 'modals' },
    ],
  },
  conditionals: {
    title: 'Conditional Sentences',
    title_fa: 'جملات شرطی',
    summary_fa: 'شرطی نوع اول، دوم و سوم — از احتمال واقعی تا حسرت گذشته.',
    sections: [
      { heading_fa: 'شرطی نوع اول: احتمال واقعی', body_fa: 'برای اتفاقی که واقعاً ممکن است بیفتد: If + حال ساده، will + فعل ساده. توجه کنید که بعد از if هرگز will نمی‌آید.', examples: [{ en: 'If it rains, we will stay home.', fa: 'اگر باران ببارد، خانه می‌مانیم.' }, { en: 'If you study, you will pass.', fa: 'اگر درس بخوانی، قبول می‌شوی.' }], tip_fa: 'اشتباه رایج فارسی‌زبانان: If it will rain — غلط است.' },
      { heading_fa: 'شرطی نوع دوم: خیالی', body_fa: 'برای موقعیت غیرواقعی در حال: If + گذشته ساده، would + فعل ساده. با فعل to be معمولاً were برای همه فاعل‌ها می‌آید.', examples: [{ en: 'If I had more time, I would travel.', fa: 'اگر وقت بیشتری داشتم، سفر می‌کردم.' }, { en: 'If I were you, I would accept.', fa: 'اگر جای تو بودم، قبول می‌کردم.' }], tip_fa: 'If I was نیز شنیده می‌شود اما If I were رسمی‌تر و درست‌تر است.' },
      { heading_fa: 'شرطی نوع سوم: حسرت گذشته', body_fa: 'برای چیزی که در گذشته اتفاق نیفتاد: If + had + قسمت سوم، would have + قسمت سوم.', examples: [{ en: 'If I had known, I would have come.', fa: 'اگر می‌دانستم، می‌آمدم.' }, { en: 'If she had studied, she would have passed.', fa: 'اگر درس خوانده بود، قبول می‌شد.' }], tip_fa: 'این ساختار همیشه درباره گذشته‌ای است که دیگر قابل تغییر نیست.' },
    ],
    vocabulary: [
      { word: 'unless', meaning_fa: 'مگر اینکه', example_en: 'I will not go unless you come.', example_fa: 'نمی‌روم مگر اینکه تو بیایی.', part_of_speech: 'conjunction' },
      { word: 'otherwise', meaning_fa: 'در غیر این صورت', example_en: 'Hurry, otherwise we will be late.', example_fa: 'عجله کن، وگرنه دیر می‌رسیم.', part_of_speech: 'adverb' },
      { word: 'possible', meaning_fa: 'ممکن', example_en: 'It is possible to finish today.', example_fa: 'امروز تمام کردنش ممکن است.', part_of_speech: 'adjective' },
      { word: 'imagine', meaning_fa: 'تصور کردن', example_en: 'Imagine you won the lottery.', example_fa: 'تصور کن در قرعه‌کشی برنده شدی.', part_of_speech: 'verb' },
      { word: 'regret', meaning_fa: 'پشیمانی', example_en: 'I regret not going.', example_fa: 'از نرفتن پشیمانم.', part_of_speech: 'verb' },
      { word: 'chance', meaning_fa: 'شانس، فرصت', example_en: 'There is a chance of rain.', example_fa: 'احتمال باران هست.', part_of_speech: 'noun' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'If it ___ tomorrow, we will cancel the trip.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['will rain', 'rains', 'rained', 'would rain'], correct_answer: 1, explanation_fa: 'در شرطی نوع اول بعد از if از حال ساده استفاده می‌شود.', error_tag: 'conditional_1' },
      { kind: 'mcq', prompt: 'If I ___ rich, I would buy a house.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['am', 'were', 'will be', 'have been'], correct_answer: 1, explanation_fa: 'شرطی نوع دوم با گذشته ساده و were ساخته می‌شود.', error_tag: 'conditional_2' },
      { kind: 'mcq', prompt: 'If she had left earlier, she ___ the train.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['would catch', 'would have caught', 'will catch', 'caught'], correct_answer: 1, explanation_fa: 'شرطی نوع سوم: would have + قسمت سوم فعل.', error_tag: 'conditional_3' },
      { kind: 'mcq', prompt: 'You will not learn ___ you practise.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['unless', 'if', 'when', 'although'], correct_answer: 0, explanation_fa: 'unless یعنی «مگر اینکه» و خودش معنی منفی دارد.', error_tag: 'conditional_1' },
      { kind: 'mcq', prompt: 'If I ___ about the meeting, I would have attended.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['knew', 'had known', 'know', 'would know'], correct_answer: 1, explanation_fa: 'برای گذشته غیرواقعی از had known استفاده می‌شود.', error_tag: 'conditional_3' },
      { kind: 'mcq', prompt: 'If you heat water to 100°C, it ___.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['would boil', 'boils', 'will have boiled', 'boiled'], correct_answer: 1, explanation_fa: 'برای حقیقت علمی از شرطی نوع صفر (حال ساده) استفاده می‌شود.', error_tag: 'conditional_1' },
    ],
  },
  plurals_countables: {
    title: 'Countable and Uncountable Nouns',
    title_fa: 'اسامی قابل شمارش و غیرقابل شمارش',
    summary_fa: 'تفاوت much و many، a few و a little، و اسم‌هایی که هرگز جمع بسته نمی‌شوند.',
    sections: [
      { heading_fa: 'دو دسته اسم', body_fa: 'اسم قابل شمارش را می‌توان شمرد و جمع بست: book/books. اسم غیرقابل شمارش جمع بسته نمی‌شود: water، information، advice، money، furniture.', examples: [{ en: 'I need some information.', fa: 'به مقداری اطلاعات نیاز دارم.' }, { en: 'She gave me good advice.', fa: 'او توصیه خوبی به من کرد.' }], tip_fa: 'اشتباه بسیار رایج: informations و advices — هر دو غلط‌اند.' },
      { heading_fa: 'much، many، a lot of', body_fa: 'many با قابل شمارش، much با غیرقابل شمارش، و a lot of با هر دو به‌کار می‌رود. در جملات مثبت معمولاً a lot of طبیعی‌تر است.', examples: [{ en: 'How many books do you have?', fa: 'چند کتاب داری؟' }, { en: 'How much time do we have?', fa: 'چقدر وقت داریم؟' }], tip_fa: 'در سؤال و منفی از much/many و در مثبت از a lot of استفاده کنید.' },
      { heading_fa: 'a few و a little', body_fa: 'a few با اسم قابل شمارش جمع و a little با غیرقابل شمارش می‌آید. برای شمردن اسم غیرقابل شمارش از واحد کمک می‌گیریم: a piece of advice، a glass of water.', examples: [{ en: 'I have a few friends here.', fa: 'اینجا چند دوست دارم.' }, { en: 'Add a little salt.', fa: 'کمی نمک اضافه کن.' }], tip_fa: 'a piece of news یعنی «یک خبر»؛ a news غلط است.' },
    ],
    vocabulary: [
      { word: 'information', meaning_fa: 'اطلاعات', example_en: 'This information is useful.', example_fa: 'این اطلاعات مفید است.', part_of_speech: 'noun' },
      { word: 'furniture', meaning_fa: 'مبلمان', example_en: 'The furniture is new.', example_fa: 'مبلمان نو است.', part_of_speech: 'noun' },
      { word: 'luggage', meaning_fa: 'چمدان و بار', example_en: 'My luggage is heavy.', example_fa: 'بارم سنگین است.', part_of_speech: 'noun' },
      { word: 'progress', meaning_fa: 'پیشرفت', example_en: 'You have made good progress.', example_fa: 'پیشرفت خوبی داشته‌ای.', part_of_speech: 'noun' },
      { word: 'equipment', meaning_fa: 'تجهیزات', example_en: 'The equipment is expensive.', example_fa: 'تجهیزات گران است.', part_of_speech: 'noun' },
      { word: 'several', meaning_fa: 'چندین', example_en: 'I visited several cities.', example_fa: 'چندین شهر را دیدم.', part_of_speech: 'determiner' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'How ___ money do you need?', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['many', 'much', 'few', 'a lot'], correct_answer: 1, explanation_fa: 'money غیرقابل شمارش است پس much می‌گیرد.', error_tag: 'quantifiers' },
      { kind: 'mcq', prompt: 'She gave me some useful ___.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['advices', 'advice', 'an advice', 'advise'], correct_answer: 1, explanation_fa: 'advice غیرقابل شمارش است و جمع بسته نمی‌شود.', error_tag: 'uncountable' },
      { kind: 'mcq', prompt: 'There are ___ people in the room.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['much', 'a little', 'a few', 'a piece of'], correct_answer: 2, explanation_fa: 'people قابل شمارش جمع است پس a few می‌گیرد.', error_tag: 'quantifiers' },
      { kind: 'mcq', prompt: 'I need ___ of information about this.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['a piece', 'a slice', 'a number', 'many'], correct_answer: 0, explanation_fa: 'برای شمردن information از a piece of استفاده می‌شود.', error_tag: 'uncountable' },
      { kind: 'mcq', prompt: 'How ___ students are in your class?', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['much', 'many', 'a little', 'amount of'], correct_answer: 1, explanation_fa: 'students قابل شمارش است پس many می‌گیرد.', error_tag: 'quantifiers' },
      { kind: 'mcq', prompt: 'We bought new ___ for the office.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['furnitures', 'furniture', 'a furniture', 'furnitures items'], correct_answer: 1, explanation_fa: 'furniture غیرقابل شمارش است.', error_tag: 'uncountable' },
    ],
  },
  gerund_infinitive: {
    title: 'Gerunds and Infinitives',
    title_fa: 'اسم مصدر و مصدر با to',
    summary_fa: 'کدام فعل‌ها ing می‌گیرند و کدام to — یکی از دشوارترین بخش‌ها برای فارسی‌زبانان.',
    sections: [
      { heading_fa: 'افعالی که ing می‌گیرند', body_fa: 'بعد از enjoy، avoid، finish، mind، suggest، practise و keep همیشه فعل ing می‌گیرد.', examples: [{ en: 'I enjoy reading books.', fa: 'از کتاب خواندن لذت می‌برم.' }, { en: 'Would you mind waiting?', fa: 'اشکالی ندارد صبر کنید؟' }], tip_fa: 'بعد از تمام حروف اضافه هم فعل ing می‌گیرد: good at swimming.' },
      { heading_fa: 'افعالی که to می‌گیرند', body_fa: 'بعد از want، decide، hope، plan، promise، need و agree مصدر با to می‌آید.', examples: [{ en: 'She decided to leave early.', fa: 'تصمیم گرفت زود برود.' }, { en: 'I want to improve my English.', fa: 'می‌خواهم انگلیسی‌ام را بهتر کنم.' }], tip_fa: 'برای بیان هدف همیشه از to استفاده کنید: I came here to learn.' },
      { heading_fa: 'هر دو، اما با معنی متفاوت', body_fa: 'بعضی افعال هر دو را می‌پذیرند ولی معنی عوض می‌شود: stop smoking یعنی ترک کردن، اما stop to smoke یعنی توقف برای سیگار کشیدن.', examples: [{ en: 'He stopped smoking last year.', fa: 'پارسال سیگار را ترک کرد.' }, { en: 'He stopped to smoke.', fa: 'ایستاد تا سیگار بکشد.' }], tip_fa: 'remember doing یعنی خاطره؛ remember to do یعنی فراموش نکردن.' },
    ],
    vocabulary: [
      { word: 'avoid', meaning_fa: 'اجتناب کردن', example_en: 'Avoid making the same mistake.', example_fa: 'از تکرار همان اشتباه اجتناب کن.', part_of_speech: 'verb' },
      { word: 'practise', meaning_fa: 'تمرین کردن', example_en: 'I practise speaking daily.', example_fa: 'هر روز مکالمه تمرین می‌کنم.', part_of_speech: 'verb' },
      { word: 'decide', meaning_fa: 'تصمیم گرفتن', example_en: 'They decided to move.', example_fa: 'تصمیم گرفتند نقل مکان کنند.', part_of_speech: 'verb' },
      { word: 'manage', meaning_fa: 'موفق شدن', example_en: 'She managed to finish on time.', example_fa: 'توانست به‌موقع تمام کند.', part_of_speech: 'verb' },
      { word: 'consider', meaning_fa: 'در نظر گرفتن', example_en: 'We are considering moving.', example_fa: 'به نقل مکان فکر می‌کنیم.', part_of_speech: 'verb' },
      { word: 'refuse', meaning_fa: 'امتناع کردن', example_en: 'He refused to answer.', example_fa: 'از پاسخ دادن امتناع کرد.', part_of_speech: 'verb' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'I enjoy ___ to music.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['to listen', 'listening', 'listen', 'listened'], correct_answer: 1, explanation_fa: 'بعد از enjoy فعل ing می‌گیرد.', error_tag: 'gerund_infinitive' },
      { kind: 'mcq', prompt: 'She decided ___ a new job.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['finding', 'to find', 'find', 'found'], correct_answer: 1, explanation_fa: 'بعد از decide مصدر با to می‌آید.', error_tag: 'gerund_infinitive' },
      { kind: 'mcq', prompt: 'He is good at ___ problems.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['solve', 'to solve', 'solving', 'solved'], correct_answer: 2, explanation_fa: 'بعد از حرف اضافه at فعل ing می‌گیرد.', error_tag: 'gerund_infinitive' },
      { kind: 'mcq', prompt: 'I came to this class ___ English.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['for learn', 'for learning', 'to learn', 'learning'], correct_answer: 2, explanation_fa: 'برای بیان هدف از to + فعل ساده استفاده می‌شود.', error_tag: 'infinitive_purpose' },
      { kind: 'mcq', prompt: 'Would you mind ___ the door?', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['to close', 'closing', 'close', 'closed'], correct_answer: 1, explanation_fa: 'بعد از mind فعل ing می‌گیرد.', error_tag: 'gerund_infinitive' },
      { kind: 'mcq', prompt: 'Remember ___ the lights before you leave.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['turning off', 'to turn off', 'turn off', 'turned off'], correct_answer: 1, explanation_fa: 'remember to do یعنی فراموش نکردن انجام کاری.', error_tag: 'gerund_infinitive' },
    ],
  },
  passive_voice: {
    title: 'The Passive Voice',
    title_fa: 'جملات مجهول',
    summary_fa: 'وقتی کارِ انجام‌شده مهم‌تر از انجام‌دهنده است — ساختاری پرکاربرد در متون رسمی.',
    sections: [
      { heading_fa: 'ساختار مجهول', body_fa: 'مجهول با be + قسمت سوم فعل ساخته می‌شود و زمان جمله را فعل be نشان می‌دهد: is written، was written، will be written.', examples: [{ en: 'The letter was written yesterday.', fa: 'نامه دیروز نوشته شد.' }, { en: 'English is spoken here.', fa: 'اینجا انگلیسی صحبت می‌شود.' }], tip_fa: 'فقط افعال دارای مفعول می‌توانند مجهول شوند.' },
      { heading_fa: 'چه زمانی مجهول؟', body_fa: 'وقتی فاعل نامعلوم یا بی‌اهمیت است، یا وقتی می‌خواهیم روی نتیجه تمرکز کنیم. در متون علمی و خبری بسیار رایج است.', examples: [{ en: 'My bike was stolen.', fa: 'دوچرخه‌ام دزدیده شد.' }, { en: 'The results were published.', fa: 'نتایج منتشر شد.' }], tip_fa: 'اگر فاعل مهم باشد با by می‌آید: written by Hafez.' },
      { heading_fa: 'زمان‌های مختلف', body_fa: 'حال ساده: is made. گذشته ساده: was made. حال کامل: has been made. آینده: will be made. مودال: must be made.', examples: [{ en: 'The road has been repaired.', fa: 'جاده تعمیر شده است.' }, { en: 'It must be finished today.', fa: 'باید امروز تمام شود.' }], tip_fa: 'اشتباه رایج: The window broke by him — درستش was broken by him است.' },
    ],
    vocabulary: [
      { word: 'produce', meaning_fa: 'تولید کردن', example_en: 'These cars are produced in Iran.', example_fa: 'این ماشین‌ها در ایران تولید می‌شوند.', part_of_speech: 'verb' },
      { word: 'discover', meaning_fa: 'کشف کردن', example_en: 'Penicillin was discovered in 1928.', example_fa: 'پنی‌سیلین در ۱۹۲۸ کشف شد.', part_of_speech: 'verb' },
      { word: 'deliver', meaning_fa: 'تحویل دادن', example_en: 'The package was delivered.', example_fa: 'بسته تحویل داده شد.', part_of_speech: 'verb' },
      { word: 'repair', meaning_fa: 'تعمیر کردن', example_en: 'My car is being repaired.', example_fa: 'ماشینم در حال تعمیر است.', part_of_speech: 'verb' },
      { word: 'announce', meaning_fa: 'اعلام کردن', example_en: 'The winner was announced.', example_fa: 'برنده اعلام شد.', part_of_speech: 'verb' },
      { word: 'invent', meaning_fa: 'اختراع کردن', example_en: 'The phone was invented in 1876.', example_fa: 'تلفن در ۱۸۷۶ اختراع شد.', part_of_speech: 'verb' },
    ],
    exercises: [
      { kind: 'mcq', prompt: 'The window ___ by the storm.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['broke', 'was broken', 'has broke', 'is breaking'], correct_answer: 1, explanation_fa: 'مجهول گذشته: was + قسمت سوم فعل.', error_tag: 'passive_voice' },
      { kind: 'mcq', prompt: 'English ___ in many countries.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['speaks', 'is spoken', 'is speaking', 'spoken'], correct_answer: 1, explanation_fa: 'مجهول حال ساده: is + قسمت سوم فعل.', error_tag: 'passive_voice' },
      { kind: 'mcq', prompt: 'The report ___ tomorrow.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['will publish', 'will be published', 'will publishing', 'is publish'], correct_answer: 1, explanation_fa: 'مجهول آینده: will be + قسمت سوم فعل.', error_tag: 'passive_voice' },
      { kind: 'mcq', prompt: 'This bridge ___ in 1990.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['built', 'was built', 'has built', 'is building'], correct_answer: 1, explanation_fa: 'زمان مشخص گذشته با مجهول was built می‌آید.', error_tag: 'passive_voice' },
      { kind: 'mcq', prompt: 'The homework must ___ before Friday.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['finish', 'be finished', 'finished', 'to finish'], correct_answer: 1, explanation_fa: 'بعد از فعل وجهی، مجهول به شکل be + قسمت سوم می‌آید.', error_tag: 'passive_voice' },
      { kind: 'mcq', prompt: 'The letter has ___ sent already.', prompt_fa: 'گزینه درست را انتخاب کنید.', options: ['been', 'be', 'being', 'was'], correct_answer: 0, explanation_fa: 'مجهول حال کامل: has been + قسمت سوم فعل.', error_tag: 'passive_voice' },
    ],
  },
};

const TOPIC_MAP: Record<SkillKind, string[]> = {
  grammar: ['past_simple', 'present_perfect', 'articles', 'prepositions',
            'comparatives', 'modals', 'conditionals', 'plurals_countables',
            'gerund_infinitive', 'passive_voice'],
  vocabulary: ['daily_conversation', 'articles', 'plurals_countables',
                'prepositions', 'comparatives'],
  listening: ['daily_conversation', 'modals', 'prepositions'],
  speaking: ['daily_conversation', 'modals', 'comparatives', 'conditionals'],
  reading: ['present_perfect', 'articles', 'passive_voice', 'conditionals'],
  writing: ['articles', 'past_simple', 'passive_voice', 'gerund_infinitive',
            'conditionals', 'plurals_countables'],
};

/**
 * Maps an error tag from mistakes_memory onto the lesson that actually
 * teaches it.
 *
 * Without this, a weakness like `nuance` or `spelling` found no template
 * and silently fell through to a random pick — which is why learners saw
 * the same two lessons over and over.
 */
const TAG_TO_TEMPLATE: Record<string, string> = {
  past_simple: 'past_simple',
  present_simple: 'past_simple',
  irregular_verb: 'past_simple',
  verb_to_be: 'past_simple',
  subject_verb_agreement: 'past_simple',

  present_perfect: 'present_perfect',
  since_for: 'present_perfect',
  future_perfect: 'present_perfect',

  article: 'articles',
  capitalization: 'articles',
  capital_i: 'articles',

  preposition: 'prepositions',
  infinitive_purpose: 'gerund_infinitive',
  gerund_infinitive: 'gerund_infinitive',

  comparatives: 'comparatives',
  ed_ing_adjectives: 'comparatives',

  modals: 'modals',
  verb_choice: 'modals',
  functional_language: 'daily_conversation',
  collocations: 'daily_conversation',
  phrasal_verbs: 'daily_conversation',
  daily_words: 'daily_conversation',
  antonyms: 'daily_conversation',

  conditional_1: 'conditionals',
  conditional_2: 'conditionals',
  conditional_3: 'conditionals',
  inverted_conditional: 'conditionals',
  unreal_past: 'conditionals',

  quantifiers: 'plurals_countables',
  uncountable: 'plurals_countables',

  passive_voice: 'passive_voice',
  reported_speech: 'passive_voice',

  word_order: 'gerund_infinitive',
  double_negative: 'modals',
  inversion: 'conditionals',

  spelling: 'daily_conversation',
  punctuation: 'articles',
  linkers: 'conditionals',
  advanced_vocab: 'daily_conversation',
  register: 'passive_voice',
  style: 'passive_voice',
  tone: 'daily_conversation',
  nuance: 'daily_conversation',
  detail_reading: 'present_perfect',
  inference: 'present_perfect',
  concession: 'conditionals',
  vowel_sounds: 'daily_conversation',
  there_be: 'plurals_countables',
};

/** The lesson template that teaches a given error tag, if any. */
export function templateForTag(tag: string): string | undefined {
  if (LESSON_TEMPLATES[tag]) return tag;
  const mapped = TAG_TO_TEMPLATE[tag];
  return mapped && LESSON_TEMPLATES[mapped] ? mapped : undefined;
}

export function allTemplateKeys(): string[] {
  return Object.keys(LESSON_TEMPLATES);
}

export function localLesson(
  skill: SkillKind,
  level: CefrLevel,
  hintTag?: string,
  /** template keys the learner already has, so we stop repeating them */
  exclude: string[] = []
) {
  // 1. an exact template, or the one that teaches this error tag
  let key = hintTag ? templateForTag(hintTag) : undefined;

  // 2. otherwise pick from the skill pool, avoiding what they already have
  if (!key) {
    const pool = TOPIC_MAP[skill] ?? allTemplateKeys();
    const fresh = pool.filter((k) => !exclude.includes(k));
    const candidates = fresh.length ? fresh : pool;
    key = candidates[Math.floor(Math.random() * candidates.length)];
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
