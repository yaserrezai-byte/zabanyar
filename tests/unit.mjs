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
const game = await load('src/lib/gamification.ts');
const grp  = await load('src/lib/group-chat.ts');
const shuf = await load('src/lib/ai/shuffle.ts');

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

// ------------------------------------------------------------
console.log('\n10) Gamification — badge criteria');
{
  const base = { ...game.EMPTY_STATS };
  const S = (over) => ({ ...base, ...over });

  // ---- measure() maps every criteria type ----
  ok('measures total_xp', game.measure('total_xp', S({ totalXp: 450 })) === 450);
  ok('measures streak', game.measure('streak', S({ streakDays: 9 })) === 9);
  ok('measures vocab_reviewed', game.measure('vocab_reviewed', S({ vocabReviewed: 120 })) === 120);
  ok('measures vocab_mastered', game.measure('vocab_mastered', S({ vocabMastered: 51 })) === 51);
  ok('measures messages', game.measure('messages', S({ messages: 77 })) === 77);
  ok('measures lessons_completed', game.measure('lessons_completed', S({ lessonsCompleted: 4 })) === 4);
  ok('measures pronunciation_good', game.measure('pronunciation_good', S({ pronunciationGood: 21 })) === 21);
  ok('measures flawless_streak', game.measure('flawless_streak', S({ flawlessStreak: 12 })) === 12);
  ok('booleans surface as 1', game.measure('placement_done', S({ placementDone: true })) === 1);
  ok('booleans surface as 0', game.measure('placement_done', S({ placementDone: false })) === 0);
  ok('unknown type is 0, not NaN', game.measure('nonexistent_xyz', base) === 0);

  // ---- the four badges named in the brief ----
  const streak7 = { type: 'streak', threshold: 7 };
  ok('هفت‌روزه: not earned at 6 days', !game.isEarned(streak7, S({ streakDays: 6 })));
  ok('هفت‌روزه: earned at exactly 7', game.isEarned(streak7, S({ streakDays: 7 })));
  ok('هفت‌روزه: still earned at 30', game.isEarned(streak7, S({ streakDays: 30 })));

  const vocab1000 = { type: 'vocab_reviewed', threshold: 1000 };
  ok('هزار لغت: not earned at 999', !game.isEarned(vocab1000, S({ vocabReviewed: 999 })));
  ok('هزار لغت: earned at 1000', game.isEarned(vocab1000, S({ vocabReviewed: 1000 })));

  const flawless10 = { type: 'flawless_streak', threshold: 10 };
  ok('بدون خطا: not earned at 9', !game.isEarned(flawless10, S({ flawlessStreak: 9 })));
  ok('بدون خطا: earned at 10', game.isEarned(flawless10, S({ flawlessStreak: 10 })));

  const conv50 = { type: 'messages', threshold: 50 };
  ok('مکالمه‌گر: not earned at 49', !game.isEarned(conv50, S({ messages: 49 })));
  ok('مکالمه‌گر: earned at 50', game.isEarned(conv50, S({ messages: 50 })));

  // ---- threshold defaults to 1 for boolean badges ----
  ok('boolean badge needs no threshold',
     game.isEarned({ type: 'placement_done' }, S({ placementDone: true })));
  ok('boolean badge false when unmet',
     !game.isEarned({ type: 'placement_done' }, S({ placementDone: false })));

  // ---- empty stats earn nothing measurable ----
  ok('fresh learner earns no threshold badge',
     !game.isEarned(streak7, base) && !game.isEarned(vocab1000, base) && !game.isEarned(conv50, base));

  // ---- progress ratio ----
  ok('progress is 0.5 at half way',
     game.progressRatio(streak7, S({ streakDays: 3.5 })) === 0.5);
  ok('progress clamps at 1', game.progressRatio(streak7, S({ streakDays: 99 })) === 1);
  ok('progress is 0 with no activity', game.progressRatio(streak7, base) === 0);
  ok('progress never negative', game.progressRatio(streak7, S({ streakDays: -5 })) === 0);
}

// ------------------------------------------------------------
console.log('\n11) Gamification — flawless run detection');
{
  const F = game.longestFlawlessRun;
  const clean = (n) => Array.from({ length: n }, () => ({ errorCount: 0 }));
  const dirty = { errorCount: 3 };

  ok('empty history has no run', F([]) === 0);
  ok('all-clean run counts fully', F(clean(10)) === 10);
  ok('an error resets the run', F([...clean(4), dirty, ...clean(3)]) === 4);
  ok('longest run wins, not the last', F([...clean(3), dirty, ...clean(8)]) === 8);
  ok('leading error is ignored', F([dirty, ...clean(5)]) === 5);
  ok('trailing error does not erase the run', F([...clean(6), dirty]) === 6);
  ok('all dirty means zero', F([dirty, dirty, dirty]) === 0);
  ok('single clean submission is a run of 1', F([{ errorCount: 0 }]) === 1);
  // the badge boundary itself
  ok('9 clean then error does NOT reach the 10 badge',
     F([...clean(9), dirty]) < 10);
  ok('10 clean reaches the badge', F(clean(10)) >= 10);
}

// ------------------------------------------------------------
console.log('\n12) Gamification — streak computation');
{
  const C = game.computeStreak;
  const at = (iso) => new Date(iso + 'T12:00:00Z');
  const today = at('2026-08-02');

  ok('no activity means no streak', C([], today) === 0);
  ok('today alone is a 1-day streak', C(['2026-08-02'], today) === 1);
  ok('yesterday alone still counts', C(['2026-08-01'], today) === 1);
  ok('a two-day gap breaks the streak', C(['2026-07-30'], today) === 0);

  ok('three consecutive days',
     C(['2026-07-31', '2026-08-01', '2026-08-02'], today) === 3);
  ok('seven consecutive days earns the badge',
     C(['2026-07-27','2026-07-28','2026-07-29','2026-07-30','2026-07-31','2026-08-01','2026-08-02'], today) === 7);

  ok('a gap truncates to the recent run',
     C(['2026-07-20','2026-07-21','2026-08-01','2026-08-02'], today) === 2);
  ok('duplicate dates count once',
     C(['2026-08-02','2026-08-02','2026-08-01'], today) === 2);
  ok('unsorted input is handled',
     C(['2026-08-02','2026-07-31','2026-08-01'], today) === 3);
  ok('stale history yields zero, not a stale streak',
     C(['2026-06-01','2026-06-02','2026-06-03'], today) === 0);
}

// ------------------------------------------------------------
console.log('\n13) Group chat — content moderation');
{
  const M = grp.moderate;

  ok('clean English passes', M('Hello everyone, how are you?').allowed);
  ok('clean Persian passes', M('سلام به همه').allowed);
  ok('empty message rejected', !M('   ').allowed);
  ok('over-long message rejected', !M('a'.repeat(501)).allowed);

  ok('English profanity blocked', !M('what the fuck is this').allowed);
  ok('Persian profanity blocked', !M('برو بابا جنده').allowed);
  ok('  rejection reason is Persian',
     /[\u0600-\u06FF]/.test(M('you bitch').reason_fa || ''));

  // evasion
  ok('spaced-out profanity blocked', !M('f u c k you').allowed);
  ok('dotted profanity blocked', !M('s.h.i.t').allowed);
  ok('leetspeak profanity blocked', !M('sh1t').allowed);

  ok('character flooding blocked', !M('aaaaaaaaaaaaaaaa').allowed);
  ok('short repeats still allowed', M('haha so funny').allowed);

  // must not over-block legitimate words containing substrings
  ok('"classic" is not blocked', M('That was a classic mistake.').allowed);
  ok('"analysis" is not blocked', M('Let us do an analysis.').allowed);
  ok('"grass" is not blocked', M('The grass is green.').allowed);
}

// ------------------------------------------------------------
console.log('\n14) Group chat — AI guide cadence');
{
  const S = grp.shouldGuideSpeak;
  const base = {
    messagesSinceAi: 0, msSinceAi: Infinity,
    msSinceLastMessage: 0, activeParticipants: 2, totalMessages: 0,
  };

  ok('opens the room once two learners are present',
     S({ ...base }) === 'opening');
  // Regression: the route evaluates cadence AFTER storing the message,
  // so totalMessages is already 1 when the room really opens.
  ok('opens on the first stored message (real call order)',
     S({ ...base, messagesSinceAi: 1, totalMessages: 1 }) === 'opening');
  ok('does not open with only one learner',
     S({ ...base, activeParticipants: 1 }) === 'none');
  ok('does not re-open after it has spoken',
     S({ ...base, msSinceAi: 60_000, messagesSinceAi: 1, totalMessages: 1 }) === 'none');
  ok('does not treat a busy room as opening',
     S({ ...base, messagesSinceAi: 2, totalMessages: 8 }) !== 'opening');

  ok('stays quiet right after speaking',
     S({ ...base, msSinceAi: 5_000, messagesSinceAi: 9, totalMessages: 9 }) === 'none');

  ok('speaks after 4 turns in a 2-person room',
     S({ ...base, msSinceAi: 60_000, messagesSinceAi: 4, totalMessages: 4 }) === 'interval');
  ok('stays quiet at 3 turns',
     S({ ...base, msSinceAi: 60_000, messagesSinceAi: 3, totalMessages: 3 }) === 'none');
  ok('waits for 5 turns in a bigger room',
     S({ ...base, msSinceAi: 60_000, messagesSinceAi: 4, totalMessages: 4, activeParticipants: 4 }) === 'none');
  ok('  then speaks at 5',
     S({ ...base, msSinceAi: 60_000, messagesSinceAi: 5, totalMessages: 5, activeParticipants: 4 }) === 'interval');

  ok('revives a stalled room',
     S({ ...base, msSinceAi: 60_000, msSinceLastMessage: 50_000, messagesSinceAi: 1, totalMessages: 3 }) === 'stalled');
  ok('does not call a fresh room stalled',
     S({ ...base, msSinceAi: 60_000, msSinceLastMessage: 50_000, totalMessages: 0 }) !== 'stalled');
  ok('a brief pause is not a stall',
     S({ ...base, msSinceAi: 60_000, msSinceLastMessage: 20_000, messagesSinceAi: 1, totalMessages: 3 }) === 'none');

  // the guide must never dominate the room
  ok('never speaks twice inside 20s regardless of turns',
     S({ ...base, msSinceAi: 19_000, messagesSinceAi: 50, totalMessages: 50, msSinceLastMessage: 90_000 }) === 'none');
}

// ------------------------------------------------------------
console.log('\n15) Group chat — local fallback guide & scenarios');
{
  const scen = grp.scenarioById('coffee_shop');
  ok('scenario lookup works', scen?.id === 'coffee_shop');
  ok('unknown scenario is undefined', grp.scenarioById('nope_xyz') === undefined);

  for (const reason of ['opening', 'interval', 'stalled']) {
    const turn = grp.localGuideTurn(reason, scen, 3);
    ok(`local guide replies for "${reason}"`, turn.content.length > 0 && turn.source === 'local');
    ok(`  "${reason}" has Persian translation`, /[\u0600-\u06FF]/.test(turn.translation_fa));
    ok(`  "${reason}" content is English`, /[a-zA-Z]/.test(turn.content));
  }

  ok('local guide survives an unknown scenario',
     grp.localGuideTurn('interval', undefined, 1).content.length > 0);
  ok('different seeds give different nudges',
     grp.localGuideTurn('interval', scen, 0).content !==
     grp.localGuideTurn('interval', scen, 1).content);
  ok('same seed is deterministic',
     grp.localGuideTurn('interval', scen, 7).content ===
     grp.localGuideTurn('interval', scen, 7).content);

  // level gating
  const a1 = grp.scenariosForLevel('A1').map((s) => s.id);
  const c2 = grp.scenariosForLevel('C2').map((s) => s.id);
  ok('A1 sees only beginner scenarios', a1.includes('coffee_shop') && !a1.includes('debate'));
  ok('C2 sees every scenario', c2.length === grp.GROUP_SCENARIOS.length);
  ok('B1 unlocks the interview but not the debate', (() => {
    const b1 = grp.scenariosForLevel('B1').map((s) => s.id);
    return b1.includes('job_interview') && !b1.includes('debate');
  })());
  ok('null level falls back to A1', grp.scenariosForLevel(null).every((s) => s.minLevel === 'A1'));

  ok('every scenario has Persian metadata',
     grp.GROUP_SCENARIOS.every((s) =>
       /[\u0600-\u06FF]/.test(s.topic_fa) &&
       /[\u0600-\u06FF]/.test(s.description_fa) &&
       s.roles_fa.length >= 2));
  ok('every scenario has conversation starters',
     grp.GROUP_SCENARIOS.every((s) => s.starters.length >= 2));
  ok('scenario ids are unique',
     new Set(grp.GROUP_SCENARIOS.map((s) => s.id)).size === grp.GROUP_SCENARIOS.length);
  ok('cooldown is 2 seconds', grp.MESSAGE_COOLDOWN_MS === 2000);
}

// ------------------------------------------------------------
console.log('\n16) Lesson variety (regression: only 2 lessons ever appeared)');
{
  // Bug report: "در ساخت درس جدید فقط دو نمونه تکراری رو انجام میده".
  // Root causes were (a) only 4 templates, (b) most error tags had no
  // template so they fell through to a random pick, (c) no memory of
  // what the learner already had.

  ok('template catalogue has grown past 4', engine.allTemplateKeys().length >= 10,
     `${engine.allTemplateKeys().length}`);

  // (a) repeated generation must vary
  const used = [];
  const titles = [];
  for (let i = 0; i < 12; i++) {
    const l = engine.localLesson('grammar', 'B1', undefined, used);
    titles.push(l.title);
    if (!used.includes(l.topic)) used.push(l.topic);
  }
  ok('12 generations yield at least 8 distinct lessons',
     new Set(titles).size >= 8, `${new Set(titles).size}`);

  // (b) every error tag the app can record must resolve to a lesson
  const REAL_TAGS = [
    'past_simple','present_simple','present_perfect','future_perfect','verb_to_be',
    'subject_verb_agreement','article','preposition','word_order','spelling',
    'punctuation','capitalization','capital_i','comparatives','quantifiers',
    'uncountable','since_for','conditional_1','conditional_3','inverted_conditional',
    'passive_voice','reported_speech','gerund_infinitive','phrasal_verbs',
    'collocations','advanced_vocab','ed_ing_adjectives','linkers','inversion',
    'unreal_past','modals','verb_choice','register','style','tone','nuance',
    'functional_language','infinitive_purpose','there_be','antonyms','daily_words',
    'detail_reading','inference','concession','vowel_sounds','irregular_verb',
    'double_negative',
  ];
  const unmapped = REAL_TAGS.filter((t) => !engine.templateForTag(t));
  ok('every recorded error tag maps to a lesson', unmapped.length === 0,
     `unmapped: ${unmapped.join(', ')}`);

  // (c) the exclusion list is honoured
  const already = ['past_simple', 'present_perfect', 'articles'];
  const after = new Set();
  for (let i = 0; i < 40; i++) {
    after.add(engine.localLesson('grammar', 'B1', undefined, already).topic);
  }
  ok('already-seen lessons are not repeated',
     ![...after].some((k) => already.includes(k)), [...after].join(','));

  // and it degrades gracefully once everything is seen
  const exhausted = engine.localLesson('grammar', 'B1', undefined, engine.allTemplateKeys());
  ok('still returns a lesson when all are seen', !!exhausted?.title);

  // an explicit weakness must still win over variety
  ok('explicit tag still selects its own lesson',
     engine.localLesson('grammar', 'B1', 'past_simple').topic === 'past_simple');
  ok('mapped tag selects the teaching lesson',
     engine.localLesson('grammar', 'B1', 'quantifiers').topic === 'plurals_countables');

  // every skill must offer real choice
  for (const sk of ['grammar','vocabulary','listening','speaking','reading','writing']) {
    const seen = new Set();
    const u2 = [];
    for (let i = 0; i < 40; i++) {
      const l = engine.localLesson(sk, 'B1', undefined, u2);
      seen.add(l.title);
      if (!u2.includes(l.topic)) u2.push(l.topic);
    }
    ok(`${sk.padEnd(11)} offers 3+ distinct lessons`, seen.size >= 3, `${seen.size}`);
  }

  // every template must be complete, not a stub
  for (const key of engine.allTemplateKeys()) {
    const l = engine.localLesson('grammar', 'B1', key);
    ok(`template ${key.padEnd(20)} is complete`,
       l.sections.length >= 3 && l.vocabulary.length >= 6 && l.exercises.length >= 6 &&
       /[\u0600-\u06FF]/.test(l.title_fa) &&
       l.exercises.every((e) => e.correct_answer >= 0 && e.correct_answer < e.options.length),
       `${l.sections?.length}s/${l.vocabulary?.length}v/${l.exercises?.length}e`);
  }
}

// ------------------------------------------------------------
console.log('\n17) Pronunciation buttons are wired everywhere');
{
  // Guard: every screen where a learner meets English must offer a
  // pronunciation button. A regression here is silent in the UI, so
  // assert on the source.
  const fs = await import('node:fs');
  const pathMod = await import('node:path');
  const R = (f) => fs.readFileSync(pathMod.join(root, f), 'utf8');

  const WIRED = [
    ['src/components/VocabReview.tsx',            'مرور لغات'],
    ['src/components/TutorChat.tsx',              'مربی هوشمند'],
    ['src/components/GroupChat.tsx',              'گفت‌وگوی گروهی'],
    ['src/components/PlacementTest.tsx',          'آزمون تعیین سطح'],
    ['src/components/LessonExercises.tsx',        'تمرین‌های درس'],
    ['src/components/WritingWorkshop.tsx',        'کارگاه نوشتن'],
    ['src/components/PronunciationPractice.tsx',  'تمرین تلفظ'],
    ['src/components/PronunciationWorkshop.tsx',  'فهرست جملات'],
    ['src/components/GroupLobby.tsx',             'انتخاب سناریو'],
    ['src/components/teacher/SubmissionReview.tsx','بازبینی مدرس'],
    ['src/app/(app)/lessons/[id]/page.tsx',       'صفحه درس'],
    ['src/app/(app)/assignments/page.tsx',        'تکالیف'],
  ];

  for (const [file, label] of WIRED) {
    const src = R(file);
    ok(`${label.padEnd(20)} دکمه تلفظ دارد`,
       src.includes("from '@/components/Speak'") && /<Speak\b/.test(src),
       file);
  }

  // The shared component itself must behave safely.
  const speak = R('src/components/Speak.tsx');
  ok('فقط برای متن دارای حروف لاتین رندر می‌شود', speak.includes("/[a-zA-Z]/.test(text)"));
  ok('صدای انگلیسی را ترجیح می‌دهد', speak.includes('pickEnglishVoice'));
  ok('از انتخاب صدای فارسی جلوگیری می‌کند', speak.includes("startsWith('en')"));
  ok('لهجه آمریکایی را تشخیص می‌دهد', speak.includes('isAmerican'));
  ok('  en-US را هدف می‌گیرد', speak.includes("startsWith('en-us')"));
  ok('  پیش‌فرض utterance روی en-US است', speak.includes("'en-US'"));
  {
    // Strip comments first: the source *mentions* en-GB only to explain
    // what it avoids, and matching that text would be a false failure.
    const code = speak
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    ok('  صدای بریتانیایی را ترجیح نمی‌دهد',
       !/en-gb/i.test(code) && !/google uk/i.test(code));
  }
  ok('  صداهای شناخته‌شده آمریکایی را می‌شناسد',
     /google us english/i.test(speak) && /samantha/i.test(speak));
  ok('کلیک را از والد جدا می‌کند', speak.includes('stopPropagation'));
  ok('هنگام unmount صدا را قطع می‌کند', speak.includes('speechSynthesis.cancel()'));
  ok('برچسب دسترس‌پذیری فارسی دارد', speak.includes('شنیدن تلفظ'));
  ok('نبود پشتیبانی مرورگر را مدیریت می‌کند', speak.includes('if (!supported) return null'));
}

// ------------------------------------------------------------
console.log('18) Answer-position fairness');
{
  const { shuffleOptions, shuffleQuestion, shuffleExercise } = shuf;
  const { PLACEMENT_BANK, pickNextQuestion } = bank;

  // --- the shuffler itself ---
  {
    const opts = ['a', 'b', 'c', 'd'];
    let allOk = true;
    for (let i = 0; i < 400; i++) {
      const r = shuffleOptions(opts, 1);
      if (r.options.length !== 4) { allOk = false; break; }
      if (r.options[r.correctIndex] !== 'b') { allOk = false; break; }
      if ([...r.options].sort().join('') !== 'abcd') { allOk = false; break; }
    }
    ok('shuffleOptions keeps the correct answer pointing at the same text', allOk);
  }

  ok('shuffleOptions handles a single option', shuffleOptions(['x'], 0).correctIndex === 0);
  ok('shuffleOptions handles an out-of-range index',
     shuffleOptions(['a', 'b'], 9).correctIndex === 9);

  {
    // Options with positional meaning must not move.
    const opts = ['a', 'an', 'the', '—'];
    const r = shuffleOptions(opts, 3);
    ok('shuffleOptions leaves positional options ("—") in place',
       r.options.join('|') === opts.join('|') && r.correctIndex === 3);
  }

  // --- the raw bank is biased (documents why the shuffle exists) ---
  {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const q of PLACEMENT_BANK) counts[q.correct_index]++;
    const maxShare = Math.max(...counts) / PLACEMENT_BANK.length;
    ok('raw bank is known to be positionally biased (shuffle is required)',
       maxShare > 0.5, `${Math.round(maxShare * 100)}% at one index`);
  }

  // --- what the learner actually receives must be fair ---
  {
    const counts = [0, 0, 0, 0, 0, 0];
    let served = 0;
    for (let i = 0; i < 3000; i++) {
      const q = pickNextQuestion([], []);
      if (!q) continue;
      counts[q.correct_index]++;
      served++;
    }
    const four = PLACEMENT_BANK.filter((q) => q.options.length === 4).length;
    const share = counts.map((c) => c / served);
    const maxShare = Math.max(...share);
    ok('served placement questions spread the answer across positions',
       maxShare < 0.45, `max ${Math.round(maxShare * 100)}% (was 78% at B)`);
    ok('  option D is reachable', counts[3] > 0, `${counts[3]} of ${served}`);
    ok('  bank still has 4-option questions', four > 20, `${four}`);
  }

  // --- always-B no longer beats the test ---
  {
    let bWins = 0;
    const runs = 1200;
    for (let i = 0; i < runs; i++) {
      const q = pickNextQuestion([], []);
      if (q && q.correct_index === 1) bWins++;
    }
    ok('always answering B is no longer a winning strategy',
       bWins / runs < 0.4, `${Math.round((bWins / runs) * 100)}% win rate`);
  }

  // --- shuffled questions stay internally consistent ---
  {
    let consistent = true;
    for (const q of PLACEMENT_BANK) {
      const original = q.options[q.correct_index];
      for (let i = 0; i < 25; i++) {
        const sq = shuffleQuestion(q);
        if (sq.options[sq.correct_index] !== original) { consistent = false; break; }
        if (sq.options.length !== q.options.length) { consistent = false; break; }
      }
      if (!consistent) break;
    }
    ok('every bank question survives shuffling with its answer intact', consistent);
  }

  // --- lesson exercises use the same protection ---
  {
    const ex = { options: ['have', 'had', 'has', 'having'], correct_answer: 1 };
    let good = true;
    for (let i = 0; i < 200; i++) {
      const r = shuffleExercise(ex);
      if (r.options[r.correct_answer] !== 'had') { good = false; break; }
    }
    ok('shuffleExercise keeps lesson answers correct', good);
    ok('shuffleExercise tolerates a missing options list',
       shuffleExercise({ options: null, correct_answer: 0 }).correct_answer === 0);
  }

  // --- the generate route must actually call it ---
  {
    const fs = await import('node:fs');
    const pathMod = await import('node:path');
    const R = (f) => fs.readFileSync(pathMod.join(root, f), 'utf8');
    const route = R('src/app/api/lessons/generate/route.ts');
    ok('lesson generation shuffles exercise options', route.includes('shuffleExercise'));
    const bankSrc = R('src/lib/ai/placement-bank.ts');
    ok('placement bank shuffles on serve', bankSrc.includes('shuffleQuestion'));
  }
}

console.log(`\n${'='.repeat(50)}`);
console.log(`  ✅ passed: ${pass}    ❌ failed: ${fail}`);
console.log('='.repeat(50) + '\n');
process.exit(fail ? 1 : 0);
