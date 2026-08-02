// ============================================================
// زبان‌یار | Unit tests for the local AI engine
// Bundled through esbuild so the TS sources are tested directly.
// Usage: node tests/unit.mjs
// ============================================================

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function load(entry) {
  const res = await build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    external: ['@supabase/*', 'next/*', 'react', 'react-dom'],
    tsconfig: path.join(root, 'tsconfig.json'),
    alias: { '@': path.join(root, 'src') },
  });
  const code = res.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

console.log('\n🧪 زبان‌یار — Unit tests\n');

const engine = await load('src/lib/ai/local-engine.ts');
const bank = await load('src/lib/ai/placement-bank.ts');
const pron = await load('src/lib/ai/pronunciation-engine.ts');

// ------------------------------------------------------------
console.log('1) Grammar rule engine');
{
  const cases = [
    { text: 'yesterday i go to school', tag: 'past_simple' },
    { text: 'She go to work every day.', tag: 'subject_verb_agreement' },
    { text: 'I have lived here since five years.', tag: 'since_for' },
    { text: 'He is a honest man.', tag: 'article' },
    { text: "I didn't went there.", tag: 'past_simple' },
    { text: 'I am agree with you.', tag: 'verb_choice' },
    { text: 'It depend of the weather.', tag: 'preposition' },
    { text: 'He is more taller than me.', tag: 'comparatives' },
    { text: 'I need many informations.', tag: 'uncountable' },
    { text: 'Please explain me this.', tag: 'word_order' },
    { text: 'I recieve the letter.', tag: 'spelling' },
    { text: 'They is happy.', tag: 'verb_to_be' },
    { text: 'I buyed a book yesterday.', tag: 'irregular_verb' },
    { text: 'She readed the letter.', tag: 'irregular_verb' },
    { text: 'It was very intresting.', tag: 'spelling' },
    { text: "I didn't saw nobody there.", tag: 'double_negative' },
    { text: 'He goed to the market.', tag: 'irregular_verb' },
  ];

  for (const c of cases) {
    const r = engine.localGrade(c.text, 'writing');
    const tags = r.errors.map((e) => e.error_tag);
    ok(`detects ${c.tag.padEnd(24)} in "${c.text.slice(0, 30)}"`, tags.includes(c.tag), `got [${tags.join(', ')}]`);
  }

  // corrections must actually fix the text
  const fixIrr = engine.localGrade('I buyed a book.', 'writing');
  ok('irregular verb is corrected to "bought"', fixIrr.corrected_text.includes('bought'), fixIrr.corrected_text);
  const fixSp = engine.localGrade('It was intresting.', 'writing');
  ok('misspelling is corrected', fixSp.corrected_text.includes('interesting'), fixSp.corrected_text);

  // overlapping rules must compose, not overwrite one another
  const chained = engine.localGrade("I didn't saw nobody.", 'writing');
  ok('chained fixes compose correctly', chained.corrected_text.includes("didn't see anybody"), chained.corrected_text);
  const multi = engine.localGrade('yesterday i buyed a intresting book.', 'writing');
  ok('multiple fixes all land in the output',
     multi.corrected_text.includes('bought') && multi.corrected_text.includes('interesting') && multi.corrected_text.startsWith('Yesterday'),
     multi.corrected_text);

  const clean = engine.localGrade('I went to the park yesterday and met my friend.', 'writing');
  ok('clean sentence scores high', clean.score >= 85, `score ${clean.score}`);
  ok('clean sentence marked correct', clean.is_correct === true);

  const messy = engine.localGrade('yesterday i go to school and i didnt saw nobody', 'writing');
  ok('messy sentence scores lower', messy.score < clean.score, `${messy.score} vs ${clean.score}`);
  ok('messy sentence returns corrections', messy.errors.length >= 2, `${messy.errors.length} errors`);
  ok('corrected text differs from input', messy.corrected_text !== 'yesterday i go to school and i didnt saw nobody');
  ok('feedback is in Persian', /[\u0600-\u06FF]/.test(messy.feedback_fa));
  ok('every error has a Persian note', messy.errors.every((e) => /[\u0600-\u06FF]/.test(e.note_fa)));
  ok('score is bounded 0..100', messy.score >= 0 && messy.score <= 100);
}

// ------------------------------------------------------------
console.log('\n2) SM-2 spaced repetition');
{
  let s = { ease_factor: 2.5, interval_days: 0, repetitions: 0, lapses: 0 };
  s = engine.sm2(s, 5); ok('1st good review → 1 day', s.interval_days === 1, `${s.interval_days}`);
  s = engine.sm2(s, 5); ok('2nd good review → 6 days', s.interval_days === 6, `${s.interval_days}`);
  const third = engine.sm2(s, 5);
  ok('3rd review multiplies by ease', third.interval_days > 6, `${third.interval_days}`);
  ok('repetitions increment', third.repetitions === 3);
  ok('mastery increases', third.mastery > 0);
  ok('next_review_at is in the future', new Date(third.next_review_at) > new Date());

  const lapsed = engine.sm2(third, 0);
  ok('forgetting resets interval to 1', lapsed.interval_days === 1);
  ok('forgetting increments lapses', lapsed.lapses === 1);
  ok('forgetting resets repetitions', lapsed.repetitions === 0);

  let hard = { ease_factor: 2.5, interval_days: 10, repetitions: 5, lapses: 0 };
  for (let i = 0; i < 10; i++) hard = engine.sm2(hard, 3);
  ok('ease factor floors at 1.3', hard.ease_factor >= 1.3, `${hard.ease_factor}`);

  let easy = { ease_factor: 2.5, interval_days: 1, repetitions: 1, lapses: 0 };
  for (let i = 0; i < 10; i++) easy = engine.sm2(easy, 5);
  ok('ease factor caps at 2.8', easy.ease_factor <= 2.8, `${easy.ease_factor}`);
  ok('mastery caps at 1', easy.mastery <= 1, `${easy.mastery}`);
}

// ------------------------------------------------------------
console.log('\n3) Placement scoring');
{
  ok('0 score → A1', engine.scoreToLevel(0) === 'A1');
  ok('30 score → A2', engine.scoreToLevel(30) === 'A2');
  ok('50 score → B1', engine.scoreToLevel(50) === 'B1');
  ok('70 score → B2', engine.scoreToLevel(70) === 'B2');
  ok('85 score → C1', engine.scoreToLevel(85) === 'C1');
  ok('95 score → C2', engine.scoreToLevel(95) === 'C2');

  const allWrong = engine.computePlacement([
    { level: 'A1', correct: false, skill: 'grammar' },
    { level: 'A2', correct: false, skill: 'grammar' },
  ]);
  ok('all wrong → score 0, level A1', allWrong.score === 0 && allWrong.level === 'A1');

  const allRight = engine.computePlacement([
    { level: 'C1', correct: true, skill: 'grammar' },
    { level: 'C2', correct: true, skill: 'vocabulary' },
  ]);
  ok('all right → score 100, level C2', allRight.score === 100 && allRight.level === 'C2');

  // weighting: a hard correct beats an easy correct
  const hardWin = engine.computePlacement([
    { level: 'C2', correct: true, skill: 'grammar' },
    { level: 'A1', correct: false, skill: 'grammar' },
  ]);
  const easyWin = engine.computePlacement([
    { level: 'A1', correct: true, skill: 'grammar' },
    { level: 'C2', correct: false, skill: 'grammar' },
  ]);
  ok('harder questions carry more weight', hardWin.score > easyWin.score, `${hardWin.score} vs ${easyWin.score}`);

  const mixed = engine.computePlacement([
    { level: 'B1', correct: true, skill: 'grammar' },
    { level: 'B1', correct: false, skill: 'reading' },
  ]);
  ok('per-skill breakdown produced', 'grammar' in mixed.breakdown && 'reading' in mixed.breakdown);
  ok('perfect skill → 100', mixed.breakdown.grammar === 100);
  ok('failed skill → 0', mixed.breakdown.reading === 0);
  ok('empty input is safe', engine.computePlacement([]).level === 'A1');
}

// ------------------------------------------------------------
console.log('\n4) Adaptive question selection');
{
  ok('bank has enough items', bank.PLACEMENT_BANK.length >= 30, `${bank.PLACEMENT_BANK.length}`);
  ok('test length is 14', bank.PLACEMENT_LENGTH === 14);

  const ids = bank.PLACEMENT_BANK.map((q) => q.id);
  ok('all question ids are unique', new Set(ids).size === ids.length);
  ok('every question has 4 options', bank.PLACEMENT_BANK.every((q) => q.options.length === 4));
  ok('every correct_index is valid', bank.PLACEMENT_BANK.every((q) => q.correct_index >= 0 && q.correct_index < q.options.length));
  ok('every question has a Persian explanation', bank.PLACEMENT_BANK.every((q) => /[\u0600-\u06FF]/.test(q.explanation_fa || '')));
  ok('all six CEFR levels are covered', new Set(bank.PLACEMENT_BANK.map((q) => q.level)).size === 6);

  // adaptivity: consistent success should escalate difficulty
  const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  let asked = [], answered = [];
  for (let i = 0; i < 8; i++) {
    const q = bank.pickNextQuestion(answered, asked);
    if (!q) break;
    asked.push(q.id);
    answered.push({ level: q.level, correct: true });
  }
  const finalLevel = order.indexOf(answered[answered.length - 1].level);
  ok('always-correct path escalates difficulty', finalLevel >= 3, `ended at ${answered[answered.length - 1].level}`);

  asked = []; answered = [];
  for (let i = 0; i < 8; i++) {
    const q = bank.pickNextQuestion(answered, asked);
    if (!q) break;
    asked.push(q.id);
    answered.push({ level: q.level, correct: false });
  }
  const lowLevel = order.indexOf(answered[answered.length - 1].level);
  ok('always-wrong path lowers difficulty', lowLevel <= 1, `ended at ${answered[answered.length - 1].level}`);

  // no repeats across a full test
  asked = []; answered = [];
  for (let i = 0; i < 14; i++) {
    const q = bank.pickNextQuestion(answered, asked);
    if (!q) break;
    asked.push(q.id);
    answered.push({ level: q.level, correct: Math.random() > 0.4 });
  }
  ok('full test yields 14 questions', asked.length === 14, `${asked.length}`);
  ok('no duplicates in a full test', new Set(asked).size === asked.length);
}

// ------------------------------------------------------------
console.log('\n5) Lesson generator');
{
  const skills = ['grammar', 'vocabulary', 'listening', 'speaking', 'reading', 'writing'];
  for (const s of skills) {
    const l = engine.localLesson(s, 'B1');
    ok(`generates a lesson for ${s.padEnd(11)}`, !!l && l.sections.length >= 3 && l.exercises.length >= 5);
  }

  const l = engine.localLesson('grammar', 'B1', 'past_simple');
  ok('honours the requested topic', l.topic === 'past_simple');
  ok('title is Persian', /[\u0600-\u06FF]/.test(l.title_fa));
  ok('sections carry Persian bodies', l.sections.every((s) => /[\u0600-\u06FF]/.test(s.body_fa)));
  ok('vocabulary has Persian meanings', l.vocabulary.every((v) => /[\u0600-\u06FF]/.test(v.meaning_fa)));
  ok('exercises have valid answers', l.exercises.every((e) => e.correct_answer >= 0 && e.correct_answer < e.options.length));
  ok('exercises have Persian explanations', l.exercises.every((e) => /[\u0600-\u06FF]/.test(e.explanation_fa)));
  ok('unknown topic falls back safely', !!engine.localLesson('grammar', 'A1', 'nonexistent_topic_xyz'));
}

// ------------------------------------------------------------
console.log('\n6) Conversation engine');
{
  const r = engine.localReply('Yesterday I go to the park.', { interests: ['سفر'], level: 'A2' });
  ok('returns an English reply', r.reply.length > 0 && /[a-zA-Z]/.test(r.reply));
  ok('returns a Persian translation', /[\u0600-\u06FF]/.test(r.translation_fa));
  ok('detects the grammar mistake', r.corrections.some((c) => c.error_tag === 'past_simple'));
  ok('uses the learner interest', r.reply.includes('سفر') || r.translation_fa.includes('سفر'));
  ok('reply is deterministic for same input', engine.localReply('Hello there.', {}).reply === engine.localReply('Hello there.', {}).reply);
  ok('clean input yields no corrections', engine.localReply('I went to the park yesterday.', {}).corrections.length === 0);
}

// ------------------------------------------------------------
console.log('\n7) Learning coach');
{
  const c = engine.localCoach({
    fullName: 'یاسر',
    level: 'B1',
    weakestSkill: 'writing',
    streak: 5,
    weaknesses: [{ tag: 'past_simple', label: 'زمان گذشته ساده', occurrences: 7 }],
  });
  ok('greeting includes the learner name', c.greeting_fa.includes('یاسر'));
  ok('analysis mentions the level', c.analysis_fa.includes('B1'));
  ok('analysis mentions the streak', c.analysis_fa.includes('5'));
  ok('focus targets the top weakness', c.focus_area_fa === 'زمان گذشته ساده');
  ok('returns 3 next steps', c.next_steps.length === 3);
  ok('steps carry duration', c.next_steps.every((s) => s.minutes > 0));
  ok('motivation is Persian', /[\u0600-\u06FF]/.test(c.motivation_fa));

  const empty = engine.localCoach({});
  ok('handles an empty profile', !!empty.greeting_fa && empty.next_steps.length === 3);
}

// ------------------------------------------------------------
console.log('\n8) Level helpers');
{
  ok('levelIndex A1 = 0', engine.levelIndex('A1') === 0);
  ok('levelIndex C2 = 5', engine.levelIndex('C2') === 5);
  ok('nextLevel B1 → B2', engine.nextLevel('B1') === 'B2');
  ok('nextLevel C2 stays C2', engine.nextLevel('C2') === 'C2');
}

// ------------------------------------------------------------
console.log('\n9) Pronunciation scoring engine');
{
  // ---- phonetic normalisation ----
  ok('phoneticKey collapses spelling variants',
     pron.phoneticKey('colour') === pron.phoneticKey('color'),
     `${pron.phoneticKey('colour')} vs ${pron.phoneticKey('color')}`);
  ok('phoneticKey folds ph → f',
     pron.phoneticKey('phone') === pron.phoneticKey('fone'));
  ok('phoneticKey ignores case and punctuation',
     pron.phoneticKey('Hello!') === pron.phoneticKey('hello'));
  ok('phoneticKey handles an empty string', pron.phoneticKey('!!!') === '');

  // ---- levenshtein / similarity ----
  ok('levenshtein of identical strings is 0', pron.levenshtein('abc', 'abc') === 0);
  ok('levenshtein counts a single substitution', pron.levenshtein('cat', 'cot') === 1);
  ok('levenshtein handles empty input', pron.levenshtein('', 'abc') === 3);
  ok('similarity is 1 for identical strings', pron.similarity('word', 'word') === 1);
  ok('similarity is 0..1 bounded',
     (() => { const v = pron.similarity('abc', 'xyz'); return v >= 0 && v <= 1; })());

  // ---- perfect utterance ----
  const perfect = pron.scoreTranscript('Good morning', 'Good morning');
  ok('identical transcript scores 100', perfect.accuracy_score === 100, `${perfect.accuracy_score}`);
  ok('every word marked correct', perfect.words.every((w) => w.status === 'correct'));
  ok('coverage is complete', perfect.coverage === 1);
  ok('marked confident', perfect.confident === true);
  ok('feedback is Persian', /[\u0600-\u06FF]/.test(perfect.feedback_fa));

  // ---- case and punctuation must not be penalised ----
  const casing = pron.scoreTranscript('Good morning, how are you?', 'good morning how are you');
  ok('case/punctuation differences do not penalise', casing.accuracy_score === 100, `${casing.accuracy_score}`);

  // ---- completely wrong ----
  const wrong = pron.scoreTranscript('Good morning', 'purple elephant');
  ok('unrelated speech scores low', wrong.accuracy_score < 40, `${wrong.accuracy_score}`);
  ok('problem words are reported', wrong.problem_words.length > 0);

  // ---- partial utterance ----
  const partial = pron.scoreTranscript('I have three books and two pens', 'I have three books');
  ok('missing words are detected', partial.words.some((w) => w.status === 'missing'));
  ok('coverage drops below 1', partial.coverage < 1, `${partial.coverage}`);
  ok('partial beats unrelated', partial.accuracy_score > wrong.accuracy_score);
  ok('partial is below perfect', partial.accuracy_score < 100);

  // ---- extra words penalised ----
  const extra = pron.scoreTranscript('Good morning', 'Good morning umm well okay so');
  ok('extra words are flagged', extra.words.some((w) => w.status === 'extra'));
  ok('extra words reduce the score', extra.accuracy_score < perfect.accuracy_score,
     `${extra.accuracy_score} vs ${perfect.accuracy_score}`);

  // ---- near-miss pronunciation stays generous ----
  const near = pron.scoreTranscript('I think this is right', 'I sink dis is right');
  ok('accented near-miss still scores partially', near.accuracy_score > 40, `${near.accuracy_score}`);
  ok('accented near-miss is not perfect', near.accuracy_score < 100);

  // ---- Persian-speaker hints ----
  const thCase = pron.scoreTranscript('think', 'sink');
  ok('th hint surfaces for Persian speakers',
     thCase.words.some((w) => (w.hint_fa || '').includes('th')),
     JSON.stringify(thCase.words.map((w) => w.hint_fa)));

  // ---- word order matters ----
  const jumbled = pron.scoreTranscript('the cat sat on the mat', 'mat the on sat cat the');
  ok('scrambled word order is penalised', jumbled.accuracy_score < 90, `${jumbled.accuracy_score}`);

  // ---- structural guarantees ----
  ok('score never exceeds 100', perfect.accuracy_score <= 100);
  ok('score never goes below 0', wrong.accuracy_score >= 0);
  ok('empty target is handled safely', pron.scoreTranscript('', 'hello').accuracy_score === 0);
  ok('empty transcript is handled safely',
     (() => { const r = pron.scoreTranscript('hello world', ''); return r.accuracy_score === 0 && r.words.length > 0; })());
  ok('all words carry a numeric score', perfect.words.every((w) => typeof w.score === 'number'));
  ok('strengths and improvements are always present',
     perfect.strengths_fa.length > 0 && perfect.improvements_fa.length > 0);
  ok('improvements are Persian',
     wrong.improvements_fa.every((s) => /[\u0600-\u06FF]/.test(s)));

  // ---- duration-only fallback ----
  const tooShort = pron.scoreFromDuration('I have three books and two pens', 200);
  ok('very short recording is flagged as not confident', tooShort.confident === false);
  ok('very short recording scores low', tooShort.accuracy_score <= 40, `${tooShort.accuracy_score}`);
  ok('short-recording feedback is Persian', /[\u0600-\u06FF]/.test(tooShort.feedback_fa));

  const plausible = pron.scoreFromDuration('I have three books', 1600);
  ok('plausible duration scores higher than too-short',
     plausible.accuracy_score > tooShort.accuracy_score);
  ok('duration fallback never claims confidence', plausible.confident === false);
  ok('duration fallback returns no transcript', plausible.transcript === '');

  const tooLong = pron.scoreFromDuration('Hello', 40000);
  ok('over-long recording is penalised', tooLong.accuracy_score < plausible.accuracy_score,
     `${tooLong.accuracy_score} vs ${plausible.accuracy_score}`);

  // ---- sentence bank ----
  ok('sentence bank is populated', pron.SENTENCE_BANK.length >= 20, `${pron.SENTENCE_BANK.length}`);
  ok('all sentence ids are unique',
     new Set(pron.SENTENCE_BANK.map((s) => s.id)).size === pron.SENTENCE_BANK.length);
  ok('every sentence has a Persian translation',
     pron.SENTENCE_BANK.every((s) => /[\u0600-\u06FF]/.test(s.translation_fa)));
  ok('every sentence has a Persian focus label',
     pron.SENTENCE_BANK.every((s) => /[\u0600-\u06FF]/.test(s.focus_fa)));
  ok('every sentence has English text',
     pron.SENTENCE_BANK.every((s) => /[a-zA-Z]/.test(s.text)));
  ok('all six CEFR levels are covered',
     new Set(pron.SENTENCE_BANK.map((s) => s.level)).size === 6);

  for (const lv of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    const list = pron.sentencesForLevel(lv);
    ok(`sentencesForLevel(${lv}) returns options`, list.length >= 3, `${list.length}`);
  }
  ok('sentencesForLevel(null) is safe', pron.sentencesForLevel(null).length >= 3);
}

console.log(`\n${'='.repeat(50)}`);
console.log(`  ✅ passed: ${pass}    ❌ failed: ${fail}`);
console.log('='.repeat(50) + '\n');
process.exit(fail ? 1 : 0);
