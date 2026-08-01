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
  ];

  for (const c of cases) {
    const r = engine.localGrade(c.text, 'writing');
    const tags = r.errors.map((e) => e.error_tag);
    ok(`detects ${c.tag.padEnd(24)} in "${c.text.slice(0, 30)}"`, tags.includes(c.tag), `got [${tags.join(', ')}]`);
  }

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

console.log(`\n${'='.repeat(50)}`);
console.log(`  ✅ passed: ${pass}    ❌ failed: ${fail}`);
console.log('='.repeat(50) + '\n');
process.exit(fail ? 1 : 0);
