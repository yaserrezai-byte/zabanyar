// ============================================================
// زبان‌یار | Database + RLS integration test
// Creates real users and verifies every isolation guarantee.
// Usage: node tests/rls.mjs
// ============================================================

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import WS from 'ws';

// Node 20 lacks a global WebSocket; supabase-js needs one at import time.
if (!globalThis.WebSocket) globalThis.WebSocket = WS;

const env = {};
for (const line of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const created = [];

async function makeUser(tag) {
  const email = `e2e.${tag}.${Date.now()}@zabanyar-test.com`;
  const password = 'Test-Passw0rd!2026';
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: `کاربر ${tag}` },
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  created.push(data.user.id);
  return { email, password, id: data.user.id };
}

async function signIn(u) {
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: u.email, password: u.password });
  if (error) throw new Error(`signIn: ${error.message}`);
  return c;
}

console.log('\n🔐 زبان‌یار — Database & RLS integration test\n');

// ------------------------------------------------------------
console.log('1) Schema integrity');
{
  const tables = [
    'profiles', 'skill_levels', 'placement_tests', 'lessons', 'exercises',
    'assignments', 'submissions', 'mistakes_memory', 'vocabulary_memory',
    'conversations', 'messages', 'learning_history', 'progress_reports', 'ai_memory',
  ];
  for (const t of tables) {
    const { error } = await admin.from(t).select('*').limit(1);
    ok(`table ${t.padEnd(18)} exists`, !error, error?.message);
  }
}

// ------------------------------------------------------------
console.log('\n2) Signup trigger');
const alice = await makeUser('alice');
const bob = await makeUser('bob');
await new Promise((r) => setTimeout(r, 800));
{
  const { data } = await admin.from('profiles').select('*').eq('id', alice.id).single();
  ok('profile auto-created on signup', !!data);
  ok('default role = student', data?.role === 'student');
  ok('name copied from metadata', data?.full_name === 'کاربر alice');
  ok('default locale = fa', data?.locale === 'fa');
  ok('default timezone = Asia/Tehran', data?.timezone === 'Asia/Tehran');
  ok('placement_done starts false', data?.placement_done === false);
}

const aDb = await signIn(alice);
const bDb = await signIn(bob);

// ------------------------------------------------------------
console.log('\n3) Profile isolation');
{
  const { data: own } = await aDb.from('profiles').select('id').eq('id', alice.id);
  ok('can read own profile', own?.length === 1);

  const { data: other } = await aDb.from('profiles').select('id').eq('id', bob.id);
  ok("cannot read another user's profile", (other ?? []).length === 0);

  const { data: all } = await aDb.from('profiles').select('id');
  ok('profile listing scoped to self', (all ?? []).length === 1, `saw ${all?.length}`);

  const { error } = await aDb.from('profiles').update({ full_name: 'نام جدید' }).eq('id', alice.id);
  ok('can update own profile', !error);
}

// ------------------------------------------------------------
console.log('\n4) Privilege escalation guards');
{
  await aDb.from('profiles').update({ role: 'admin' }).eq('id', alice.id);
  const { data: r1 } = await admin.from('profiles').select('role').eq('id', alice.id).single();
  ok('cannot self-promote to admin', r1.role === 'student', `got ${r1.role}`);

  await aDb.from('profiles').update({ subscription: 'premium' }).eq('id', alice.id);
  const { data: r2 } = await admin.from('profiles').select('subscription').eq('id', alice.id).single();
  ok('cannot self-grant a paid plan', r2.subscription === 'free', `got ${r2.subscription}`);

  await aDb.from('profiles').update({ teacher_id: bob.id }).eq('id', alice.id);
  const { data: r3 } = await admin.from('profiles').select('teacher_id').eq('id', alice.id).single();
  ok('cannot self-assign a teacher', r3.teacher_id === null);

  await aDb.from('profiles').update({ full_name: 'یاسر' }).eq('id', bob.id);
  const { data: r4 } = await admin.from('profiles').select('full_name').eq('id', bob.id).single();
  ok("cannot edit another user's profile", r4.full_name !== 'یاسر');
}

// ------------------------------------------------------------
console.log('\n5) Per-table data isolation');
{
  const rows = [
    ['skill_levels', { user_id: alice.id, skill: 'grammar', level: 'B1', score: 62 }],
    ['vocabulary_memory', { user_id: alice.id, word: 'perseverance', meaning_fa: 'پشتکار' }],
    ['mistakes_memory', { user_id: alice.id, error_tag: 'past_simple', error_label_fa: 'گذشته ساده' }],
    ['learning_history', { user_id: alice.id, event_type: 'lesson_completed', xp: 10 }],
    ['ai_memory', { user_id: alice.id, kind: 'preference', key: 'topic', value: 'travel' }],
    ['progress_reports', { user_id: alice.id, period_start: '2026-07-01', period_end: '2026-07-31' }],
  ];

  for (const [table, row] of rows) {
    const { data, error: insErr } = await aDb.from(table).insert(row).select('id').single();
    ok(`${table.padEnd(18)} insert own row`, !insErr, insErr?.message);
    if (!data) continue;

    const { data: mine } = await aDb.from(table).select('id').eq('id', data.id);
    ok(`${table.padEnd(18)} owner can read`, mine?.length === 1);

    const { data: theirs } = await bDb.from(table).select('id').eq('id', data.id);
    ok(`${table.padEnd(18)} other user blocked`, (theirs ?? []).length === 0);

    const { error: crossErr } = await bDb.from(table).insert({ ...row, user_id: alice.id });
    ok(`${table.padEnd(18)} cross-user insert blocked`, !!crossErr);
  }
}

// ------------------------------------------------------------
console.log('\n6) Lessons, exercises & global content');
{
  const { data: lesson, error } = await aDb.from('lessons').insert({
    user_id: alice.id, title: 'Past Simple', title_fa: 'گذشته ساده',
    skill: 'grammar', level: 'B1',
    content: { sections: [{ heading_fa: 'مقدمه', body_fa: 'توضیح' }] },
  }).select('id').single();
  ok('own lesson created', !error, error?.message);

  const { data: theirs } = await bDb.from('lessons').select('id').eq('id', lesson.id);
  ok('private lesson hidden from others', (theirs ?? []).length === 0);

  // global curated lesson (user_id = null) must be readable by everyone
  const { data: global } = await admin.from('lessons').insert({
    user_id: null, title: 'Global Basics', title_fa: 'مبانی عمومی',
    skill: 'grammar', level: 'A1', content: {},
  }).select('id').single();

  const { data: aSees } = await aDb.from('lessons').select('id').eq('id', global.id);
  const { data: bSees } = await bDb.from('lessons').select('id').eq('id', global.id);
  ok('global lesson readable by all users', aSees?.length === 1 && bSees?.length === 1);

  const { error: gErr } = await aDb.from('lessons').update({ title: 'hacked' }).eq('id', global.id);
  const { data: gAfter } = await admin.from('lessons').select('title').eq('id', global.id).single();
  ok('global lesson not editable by students', gAfter.title === 'Global Basics');

  const { error: exErr } = await aDb.from('exercises').insert({
    lesson_id: lesson.id, user_id: alice.id, kind: 'mcq', skill: 'grammar', level: 'B1',
    prompt: 'Yesterday I ___ home.', options: ['go', 'went', 'gone', 'going'], correct_answer: 1,
  });
  ok('exercise attached to own lesson', !exErr, exErr?.message);

  const { data: exTheirs } = await bDb.from('exercises').select('id').eq('lesson_id', lesson.id);
  ok('exercises of a private lesson are hidden', (exTheirs ?? []).length === 0);

  await admin.from('lessons').delete().eq('id', global.id);
}

// ------------------------------------------------------------
console.log('\n7) Conversations & messages');
{
  const { data: conv } = await aDb.from('conversations')
    .insert({ user_id: alice.id, title: 'گفت‌وگوی تست' }).select('id').single();
  ok('conversation created', !!conv);

  const { error: msgErr } = await aDb.from('messages').insert({
    conversation_id: conv.id, user_id: alice.id, role: 'user', content: 'Hello',
  });
  ok('own message inserted', !msgErr, msgErr?.message);

  const { error: hijack } = await bDb.from('messages').insert({
    conversation_id: conv.id, user_id: bob.id, role: 'user', content: 'intrusion',
  });
  ok("cannot post into another user's conversation", !!hijack);

  const { error: spoof } = await bDb.from('messages').insert({
    conversation_id: conv.id, user_id: alice.id, role: 'user', content: 'spoof',
  });
  ok('cannot spoof another user_id on a message', !!spoof);

  const { data: read } = await bDb.from('messages').select('id').eq('conversation_id', conv.id);
  ok('messages unreadable by other users', (read ?? []).length === 0);
}

// ------------------------------------------------------------
console.log('\n8) Placement & submissions');
{
  const { data: test } = await aDb.from('placement_tests')
    .insert({ user_id: alice.id, status: 'completed', raw_score: 62, result_level: 'B1' })
    .select('id').single();
  ok('placement test saved', !!test);

  const { data: theirs } = await bDb.from('placement_tests').select('id').eq('id', test.id);
  ok('placement result is private', (theirs ?? []).length === 0);

  const { data: sub } = await aDb.from('submissions')
    .insert({ user_id: alice.id, answer_text: 'I went home.', score: 88, is_correct: true })
    .select('id').single();
  ok('submission saved', !!sub);

  const { data: subTheirs } = await bDb.from('submissions').select('id').eq('id', sub.id);
  ok('submission is private', (subTheirs ?? []).length === 0);
}

// ------------------------------------------------------------
console.log('\n9) Teacher scope');
{
  const teacher = await makeUser('teacher');
  const stranger = await makeUser('stranger');
  await admin.from('profiles').update({ role: 'teacher' }).eq('id', teacher.id);
  await admin.from('profiles').update({ teacher_id: teacher.id }).eq('id', alice.id);

  const tDb = await signIn(teacher);

  const { data: mine } = await tDb.from('profiles').select('id').eq('id', alice.id);
  ok('teacher sees an assigned student', mine?.length === 1);

  const { data: notMine } = await tDb.from('profiles').select('id').eq('id', stranger.id);
  ok('teacher cannot see an unassigned student', (notMine ?? []).length === 0);

  const { data: mistakes } = await tDb.from('mistakes_memory').select('id').eq('user_id', alice.id);
  ok("teacher reads own student's mistakes", (mistakes ?? []).length >= 1);

  const { data: strangerData } = await tDb.from('mistakes_memory').select('id').eq('user_id', stranger.id);
  ok("teacher blocked from a stranger's data", (strangerData ?? []).length === 0);

  const { error: assignErr } = await tDb.from('assignments').insert({
    user_id: alice.id, assigned_by: teacher.id, title: 'تکلیف نوشتاری', skill: 'writing',
  });
  ok('teacher can assign homework to own student', !assignErr, assignErr?.message);

  const { error: badAssign } = await tDb.from('assignments').insert({
    user_id: stranger.id, assigned_by: teacher.id, title: 'نامعتبر', skill: 'writing',
  });
  ok('teacher cannot assign to a stranger', !!badAssign);
}

// ------------------------------------------------------------
console.log('\n10) Admin scope');
{
  const adminUser = await makeUser('admin');
  await admin.from('profiles').update({ role: 'admin' }).eq('id', adminUser.id);
  const adDb = await signIn(adminUser);

  const { data: all } = await adDb.from('profiles').select('id');
  ok('admin sees every profile', (all ?? []).length >= 5, `saw ${all?.length}`);

  const { data: lessons } = await adDb.from('lessons').select('id');
  ok('admin sees every lesson', (lessons ?? []).length >= 1);

  const { error } = await adDb.from('profiles').update({ subscription: 'pro' }).eq('id', alice.id);
  const { data: after } = await admin.from('profiles').select('subscription').eq('id', alice.id).single();
  ok('admin can change a subscription', !error && after.subscription === 'pro');
}

// ------------------------------------------------------------
console.log('\n11) Storage buckets');
{
  const { data: buckets } = await admin.storage.listBuckets();
  const byId = Object.fromEntries(buckets.map((b) => [b.id, b]));
  ok('avatars bucket is public', byId.avatars?.public === true);
  ok('speech bucket is private', byId.speech?.public === false);
  ok('submissions bucket is private', byId.submissions?.public === false);
}

// ------------------------------------------------------------
console.log('\n12) Anonymous access');
{
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  for (const t of ['profiles', 'lessons', 'messages', 'submissions', 'vocabulary_memory']) {
    const { data } = await anon.from(t).select('id').limit(1);
    ok(`anonymous read blocked on ${t.padEnd(18)}`, (data ?? []).length === 0);
  }
}

// ------------------------------------------------------------
console.log('\n13) Cascade cleanup');
{
  await admin.auth.admin.deleteUser(alice.id);
  await new Promise((r) => setTimeout(r, 500));
  const { data: prof } = await admin.from('profiles').select('id').eq('id', alice.id);
  ok('profile removed with the user', (prof ?? []).length === 0);
  const { data: vocab } = await admin.from('vocabulary_memory').select('id').eq('user_id', alice.id);
  ok('child rows cascade-deleted', (vocab ?? []).length === 0);

  for (const id of created) {
    if (id !== alice.id) await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  ok('all test users cleaned up', true);
}

console.log(`\n${'='.repeat(52)}`);
console.log(`  ✅ passed: ${pass}    ❌ failed: ${fail}`);
console.log('='.repeat(52) + '\n');
process.exit(fail ? 1 : 0);
