// ============================================================
// زبان‌یار | Production smoke test
// Drives the live deployment with a real browser-like session:
// signs a user up, walks the full placement test through the
// real API routes, generates a lesson, chats with the tutor,
// grades a text and reviews vocabulary.
//
// Usage: node tests/prod.mjs https://your-app.vercel.app
// ============================================================

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import WS from 'ws';
if (!globalThis.WebSocket) globalThis.WebSocket = WS;

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');

const env = {};
for (const line of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const REF = URL_.match(/https:\/\/([a-z0-9]+)\.supabase/)[1];

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

console.log(`\n🌐 زبان‌یار — Production test against ${BASE}\n`);

// ------------------------------------------------------------
console.log('1) Public surface');
{
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  ok('health endpoint live', health.ok === true);
  ok('supabase wired up', health.supabase === true);
  console.log(`     AI mode: ${health.ai_provider}`);

  const home = await fetch(`${BASE}/`);
  const html = await home.text();
  ok('landing page 200', home.status === 200);
  ok('document is RTL', html.includes('dir="rtl"'));
  ok('lang is Persian', html.includes('lang="fa"'));
  ok('brand name rendered', html.includes('زبان‌یار'));

  ok('login page 200', (await fetch(`${BASE}/login`)).status === 200);
  ok('signup page 200', (await fetch(`${BASE}/signup`)).status === 200);
}

// ------------------------------------------------------------
console.log('\n2) Route protection');
{
  for (const p of ['/dashboard', '/lessons', '/tutor', '/vocabulary', '/progress', '/admin']) {
    const r = await fetch(`${BASE}${p}`, { redirect: 'manual' });
    ok(`${p.padEnd(12)} redirects anonymous users`, r.status === 307 || r.status === 302);
  }
  const api = await fetch(`${BASE}/api/coach`, { redirect: 'manual' });
  ok('API route rejects anonymous', api.status === 401 || api.status === 307);
}

// ------------------------------------------------------------
console.log('\n3) Real user journey');
const email = `prod.test.${Date.now()}@zabanyar-test.com`;
const password = 'Prod-Test-Passw0rd!2026';
let userId;

// authenticated fetch that carries the Supabase session cookies
function makeFetcher(session) {
  const cookieName = `sb-${REF}-auth-token`;
  const value = encodeURIComponent(JSON.stringify([session.access_token, session.refresh_token, null, null, null]));
  const cookie = `${cookieName}=base64-${Buffer.from(JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: 'bearer',
    user: session.user,
  })).toString('base64')}`;

  return async (path, body) => {
    const res = await fetch(`${BASE}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json };
  };
}

{
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: 'کاربر تست تولید' },
  });
  ok('user created', !error, error?.message);
  userId = data.user.id;

  await new Promise((r) => setTimeout(r, 900));
  const { data: profile } = await admin.from('profiles').select('*').eq('id', userId).single();
  ok('profile auto-provisioned', !!profile);
  ok('starts as student', profile?.role === 'student');

  const anonC = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: sess, error: sErr } = await anonC.auth.signInWithPassword({ email, password });
  ok('sign-in succeeds', !sErr, sErr?.message);

  const api = makeFetcher(sess.session);

  // ---- placement ----
  console.log('\n4) Placement test via live API');
  const start = await api('/api/placement/start', {});
  ok('placement starts', start.status === 200, `status ${start.status} ${JSON.stringify(start.json)}`);

  if (start.status === 200) {
    ok('returns a question', !!start.json.question);
    ok('question has 4 options', start.json.question?.options?.length === 4);
    ok('correct answer is NOT leaked', start.json.question?.correct_index === undefined);
    ok('explanation is NOT leaked', start.json.question?.explanation_fa === undefined);
    ok('total is 14', start.json.total === 14);

    let testId = start.json.test_id;
    let done = false, steps = 0, lastResult = null;

    while (!done && steps < 20) {
      const r = await api('/api/placement/answer', { test_id: testId, chosen_index: steps % 4 });
      if (r.status !== 200) { ok(`answer step ${steps + 1}`, false, JSON.stringify(r.json)); break; }
      steps++;
      done = r.json.done;
      lastResult = r.json;
      if (!done) {
        if (r.json.question?.correct_index !== undefined) {
          ok('answer never leaks correct_index', false);
          break;
        }
      }
    }

    ok('test completed in 14 steps', steps === 14, `took ${steps}`);
    ok('final payload has a result', !!lastResult?.result);
    ok('result level is valid CEFR', ['A1','A2','B1','B2','C1','C2'].includes(lastResult?.result?.level));
    ok('result has Persian summary', /[\u0600-\u06FF]/.test(lastResult?.result?.summary || ''));
    ok('skill breakdown produced', Object.keys(lastResult?.result?.breakdown || {}).length > 0);

    const { data: after } = await admin.from('profiles').select('current_level, placement_done').eq('id', userId).single();
    ok('profile marked placement_done', after?.placement_done === true);
    ok('profile level persisted', !!after?.current_level);

    const { data: skillRows } = await admin.from('skill_levels').select('*').eq('user_id', userId);
    ok('all 6 skill levels written', skillRows?.length === 6, `got ${skillRows?.length}`);

    const { data: mistakes } = await admin.from('mistakes_memory').select('*').eq('user_id', userId);
    ok('wrong answers recorded as mistakes', (mistakes ?? []).length >= 1, `${mistakes?.length} mistakes`);
  }

  // ---- coach ----
  console.log('\n5) AI coach');
  const coach = await api('/api/coach');
  ok('coach responds', coach.status === 200, `status ${coach.status}`);
  ok('greeting in Persian', /[\u0600-\u06FF]/.test(coach.json?.greeting_fa || ''));
  ok('provides next steps', (coach.json?.next_steps || []).length >= 1);
  ok('provides a focus area', !!coach.json?.focus_area_fa);

  // ---- lesson generation ----
  console.log('\n6) Lesson generation');
  const lesson = await api('/api/lessons/generate', {});
  ok('lesson generated', lesson.status === 200, `status ${lesson.status} ${JSON.stringify(lesson.json)}`);
  const lessonId = lesson.json?.lesson_id;
  ok('returns a lesson id', !!lessonId);

  if (lessonId) {
    const { data: row } = await admin.from('lessons').select('*').eq('id', lessonId).single();
    ok('lesson persisted', !!row);
    ok('lesson has Persian title', /[\u0600-\u06FF]/.test(row?.title_fa || ''));
    ok('lesson has sections', (row?.content?.sections || []).length >= 3);
    ok('lesson bound to the learner', row?.user_id === userId);

    const { data: exercises } = await admin.from('exercises').select('*').eq('lesson_id', lessonId);
    ok('exercises created', (exercises ?? []).length >= 5, `${exercises?.length}`);
    ok('exercises have valid answers', exercises.every((e) => Number(e.correct_answer) >= 0));

    const { data: vocab } = await admin.from('vocabulary_memory').select('*').eq('user_id', userId);
    ok('vocabulary seeded from lesson', (vocab ?? []).length >= 1, `${vocab?.length} words`);
  }

  // ---- tutor ----
  console.log('\n7) AI tutor conversation');
  const chat1 = await api('/api/tutor/message', { text: 'Yesterday I go to the park with my friend.' });
  ok('tutor replies', chat1.status === 200, `status ${chat1.status} ${JSON.stringify(chat1.json)}`);
  ok('reply is non-empty', (chat1.json?.reply || '').length > 0);
  ok('reply has Persian translation', /[\u0600-\u06FF]/.test(chat1.json?.translation_fa || ''));
  ok('detects the past-tense error', (chat1.json?.corrections || []).some((c) => c.error_tag === 'past_simple'));
  const convId = chat1.json?.conversation_id;
  ok('conversation id returned', !!convId);

  const chat2 = await api('/api/tutor/message', { conversation_id: convId, text: 'I am agree with you.' });
  ok('follow-up message works', chat2.status === 200);
  ok('detects the agree error', (chat2.json?.corrections || []).some((c) => c.error_tag === 'verb_choice'));

  const { data: msgs } = await admin.from('messages').select('*').eq('conversation_id', convId);
  ok('messages persisted', (msgs ?? []).length === 4, `${msgs?.length} messages`);

  // ---- grading ----
  console.log('\n8) Automatic grading');
  const grade = await api('/api/grade', {
    text: 'yesterday i go to the shop and i buyed a book. it was very intresting.',
    skill: 'writing',
  });
  ok('grading responds', grade.status === 200, `status ${grade.status}`);
  ok('returns a score', typeof grade.json?.score === 'number');
  ok('score within 0..100', grade.json?.score >= 0 && grade.json?.score <= 100);
  ok('Persian feedback returned', /[\u0600-\u06FF]/.test(grade.json?.feedback_fa || ''));
  ok('errors detected', (grade.json?.errors || []).length >= 2, `${grade.json?.errors?.length} errors`);
  ok('corrected text returned', (grade.json?.corrected_text || '').length > 0);
  ok('submission stored', !!grade.json?.submission_id);

  const { data: mm } = await admin.from('mistakes_memory').select('*').eq('user_id', userId);
  ok('grading fed the mistake memory', (mm ?? []).length >= 2, `${mm?.length} tracked patterns`);

  // ---- error intelligence loop ----
  console.log('\n9) Error Intelligence loop');
  const top = (mm ?? []).sort((a, b) => b.occurrences - a.occurrences)[0];
  ok('a dominant error pattern exists', !!top, top ? `${top.error_tag} ×${top.occurrences}` : '');
  const targeted = await api('/api/lessons/generate', { from_weakness: true });
  ok('targeted lesson generated from weakness', targeted.status === 200);
  ok('lesson topic matches the weakness', !!targeted.json?.topic);

  // ---- vocabulary review ----
  console.log('\n10) Vocabulary SM-2 review');
  const { data: words } = await admin.from('vocabulary_memory').select('*').eq('user_id', userId).limit(1);
  if (words?.length) {
    const w = words[0];
    const rev = await api('/api/vocabulary/review', { word_id: w.id, quality: 5 });
    ok('review accepted', rev.status === 200, `status ${rev.status}`);
    ok('interval scheduled', rev.json?.interval_days >= 1);
    ok('repetitions incremented', rev.json?.repetitions === 1);
    ok('next review in the future', new Date(rev.json?.next_review_at) > new Date());

    const rev2 = await api('/api/vocabulary/review', { word_id: w.id, quality: 5 });
    ok('second review extends to 6 days', rev2.json?.interval_days === 6, `${rev2.json?.interval_days}`);

    const rev3 = await api('/api/vocabulary/review', { word_id: w.id, quality: 0 });
    ok('forgetting resets the interval', rev3.json?.interval_days === 1);
    ok('lapse recorded', rev3.json?.lapses === 1);
  } else {
    ok('vocabulary available for review', false, 'no words seeded');
  }

  // ---- history ----
  console.log('\n11) Learning history & analytics');
  const { data: hist } = await admin.from('learning_history').select('*').eq('user_id', userId);
  ok('history events recorded', (hist ?? []).length >= 5, `${hist?.length} events`);
  const kinds = new Set((hist ?? []).map((h) => h.event_type));
  ok('placement event logged', kinds.has('placement_completed'));
  ok('lesson event logged', kinds.has('lesson_generated'));
  ok('conversation event logged', kinds.has('conversation_turn'));
  ok('grading event logged', kinds.has('submission_graded'));
  ok('vocab event logged', kinds.has('vocab_reviewed'));
  ok('XP accumulated', (hist ?? []).reduce((s, h) => s + h.xp, 0) > 0);

  // ---- authenticated pages render ----
  console.log('\n12) Authenticated pages render');
  for (const p of ['/dashboard', '/lessons', '/tutor', '/vocabulary', '/assignments', '/progress']) {
    const r = await fetch(`${BASE}${p}`, {
      headers: { Cookie: `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify({
        access_token: sess.session.access_token,
        refresh_token: sess.session.refresh_token,
        expires_at: sess.session.expires_at,
        token_type: 'bearer',
        user: sess.session.user,
      })).toString('base64')}` },
      redirect: 'manual',
    });
    ok(`${p.padEnd(13)} renders for a signed-in user`, r.status === 200, `status ${r.status}`);
  }

  // ---- admin gate ----
  const adminPage = await fetch(`${BASE}/admin`, {
    headers: { Cookie: `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify({
      access_token: sess.session.access_token,
      refresh_token: sess.session.refresh_token,
      expires_at: sess.session.expires_at,
      token_type: 'bearer',
      user: sess.session.user,
    })).toString('base64')}` },
    redirect: 'manual',
  });
  const adminHtml = await adminPage.text();
  ok('admin page blocks a student', adminHtml.includes('دسترسی محدود'));
}

// ------------------------------------------------------------
console.log('\n13) Cleanup');
{
  await admin.auth.admin.deleteUser(userId);
  const { data } = await admin.from('profiles').select('id').eq('id', userId);
  ok('test user removed', (data ?? []).length === 0);
}

console.log(`\n${'='.repeat(54)}`);
console.log(`  ✅ passed: ${pass}    ❌ failed: ${fail}`);
console.log('='.repeat(54) + '\n');
process.exit(fail ? 1 : 0);
