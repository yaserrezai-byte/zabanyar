// ============================================================
// زبان‌یار | PWA verification
//
// Checks the manifest, icons, headers, and — most importantly —
// that the service worker's caching rules honour the security
// constraints: no auth surfaces, no Supabase traffic and no
// per-user API payload may ever reach Cache Storage.
//
// Usage: node tests/pwa.mjs [baseUrl]
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
};

console.log(`\n📱 زبان‌یار — PWA tests against ${BASE}\n`);

// ------------------------------------------------------------
console.log('1) Manifest');
let manifest;
{
  const res = await fetch(`${BASE}/manifest.json`);
  ok('manifest is reachable without a session', res.status === 200, `status ${res.status}`);
  ok('served as manifest+json', (res.headers.get('content-type') || '').includes('manifest+json'));

  manifest = await res.json();

  ok('name is set', typeof manifest.name === 'string' && manifest.name.length > 0);
  ok('short_name is set and short', manifest.short_name?.length > 0 && manifest.short_name.length <= 12,
     manifest.short_name);
  ok('name is Persian', /[\u0600-\u06FF]/.test(manifest.name));
  ok('lang is fa', manifest.lang === 'fa');
  ok('dir is rtl', manifest.dir === 'rtl');
  ok('display is standalone', manifest.display === 'standalone');
  ok('start_url is set', typeof manifest.start_url === 'string');
  ok('scope covers the origin', manifest.scope === '/');
  ok('id is set (stable identity)', typeof manifest.id === 'string');

  // colours must match the Tailwind palette in globals.css
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');
  ok('theme_color matches --color-brand-600', manifest.theme_color === '#1d5cf5', manifest.theme_color);
  ok('  brand-600 really is #1d5cf5 in globals.css', css.includes('--color-brand-600: #1d5cf5'));
  ok('background_color matches --bg', manifest.background_color === '#f6f8fc', manifest.background_color);
  ok('  --bg really is #f6f8fc in globals.css', css.includes('--bg: #f6f8fc'));

  ok('has shortcuts', Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 1);
  ok('shortcut labels are Persian',
     (manifest.shortcuts ?? []).every((s) => /[\u0600-\u06FF]/.test(s.name)));
}

// ------------------------------------------------------------
console.log('\n2) Icons');
{
  const icons = manifest.icons ?? [];
  ok('declares at least 6 icons', icons.length >= 6, `${icons.length}`);

  const sizes = icons.map((i) => i.sizes);
  ok('includes 192x192 (Lighthouse requirement)', sizes.includes('192x192'));
  ok('includes 512x512 (Lighthouse requirement)', sizes.includes('512x512'));

  const maskable = icons.filter((i) => (i.purpose || '').includes('maskable'));
  ok('includes a maskable icon (Android adaptive)', maskable.length >= 1);
  ok('  maskable at 512x512', maskable.some((i) => i.sizes === '512x512'));

  // every declared icon must actually resolve
  for (const icon of icons) {
    const r = await fetch(`${BASE}${icon.src}`);
    const bytes = Number(r.headers.get('content-length') || 0);
    ok(`icon ${icon.src.padEnd(30)} → ${r.status}`, r.status === 200 && bytes > 0,
       `status ${r.status}, ${bytes}B`);
  }

  const apple = await fetch(`${BASE}/apple-touch-icon.png`);
  ok('apple-touch-icon.png exists', apple.status === 200);
}

// ------------------------------------------------------------
console.log('\n3) Service worker delivery');
let sw;
{
  const res = await fetch(`${BASE}/sw.js`);
  ok('sw.js reachable without a session', res.status === 200, `status ${res.status}`);
  ok('  not redirected to /login', !res.redirected);

  const cc = res.headers.get('cache-control') || '';
  ok('sw.js is not long-cached', cc.includes('max-age=0') || cc.includes('no-cache'), cc);
  ok('Service-Worker-Allowed is /', res.headers.get('service-worker-allowed') === '/');
  ok('served as javascript', (res.headers.get('content-type') || '').includes('javascript'));

  sw = await res.text();
  ok('sw.js is non-trivial', sw.length > 1000, `${sw.length} bytes`);
}

// ------------------------------------------------------------
console.log('\n4) Offline page');
{
  const res = await fetch(`${BASE}/offline`);
  ok('/offline reachable without a session', res.status === 200, `status ${res.status}`);
  const html = await res.text();
  ok('  is RTL', html.includes('dir="rtl"'));
  ok('  has Persian copy', html.includes('اتصال اینترنت برقرار نیست'));
  ok('  offers a retry action', html.includes('تلاش دوباره'));
}

// ------------------------------------------------------------
console.log('\n5) Security constraints in the service worker');
{
  // Rather than trust a grep, execute the SW's own predicates in a
  // sandbox with fake globals and assert their real behaviour.
  const sandboxSrc = `
    const self = {
      location: { origin: 'https://zabanyar-seven.vercel.app' },
      addEventListener() {}, skipWaiting() {}, clients: { claim() {} },
      registration: {},
    };
    const caches = { open: async () => ({}), keys: async () => [] };
    ${sw}
    export const __t = { isNeverCache, isCacheable, isStaticAsset, isSupabaseHost, isPublicShell };
  `;
  const mod = await import(
    `data:text/javascript;base64,${Buffer.from(sandboxSrc).toString('base64')}`
  );
  const { isNeverCache, isCacheable, isStaticAsset, isSupabaseHost } = mod.__t;

  const U = (u) => new URL(u);
  const origin = 'https://zabanyar-seven.vercel.app';

  // ---- auth surfaces ----
  for (const p of ['/auth/callback', '/auth/signout', '/login', '/signup']) {
    ok(`never caches ${p.padEnd(18)}`, isNeverCache(U(origin + p)));
  }

  // ---- Supabase ----
  ok('recognises a Supabase host', isSupabaseHost(U('https://frjxkeolvvpdgmcbipwd.supabase.co/rest/v1/profiles')));
  ok('never caches Supabase REST', isNeverCache(U('https://frjxkeolvvpdgmcbipwd.supabase.co/rest/v1/profiles')));
  ok('never caches Supabase auth/token',
     isNeverCache(U('https://frjxkeolvvpdgmcbipwd.supabase.co/auth/v1/token')));
  ok('never caches Supabase storage',
     isNeverCache(U('https://frjxkeolvvpdgmcbipwd.supabase.co/storage/v1/object/speech/x.webm')));

  // ---- per-user API payloads ----
  const goodRes = { ok: true, type: 'basic', headers: new Headers() };
  const perUser = [
    '/api/vocabulary/review',
    '/api/tutor/message',
    '/api/grade',
    '/api/coach',
    '/api/pronunciation/attempt',
    '/api/teacher/feedback',
    '/api/placement/answer',
  ];
  for (const p of perUser) {
    const req = new Request(origin + p);
    ok(`API not cacheable: ${p.padEnd(30)}`, isCacheable(req, goodRes) === false);
  }

  // ---- credential-bearing responses ----
  const withCookie = { ok: true, type: 'basic', headers: new Headers({ 'set-cookie': 'sb-token=x' }) };
  ok('rejects any response carrying Set-Cookie',
     isCacheable(new Request(origin + '/'), withCookie) === false);

  const authedReq = new Request(origin + '/', { headers: { authorization: 'Bearer abc' } });
  ok('rejects requests carrying Authorization', isCacheable(authedReq, goodRes) === false);

  const noStore = { ok: true, type: 'basic', headers: new Headers({ 'cache-control': 'no-store' }) };
  ok('respects no-store', isCacheable(new Request(origin + '/'), noStore) === false);

  const opaque = { ok: true, type: 'opaque', headers: new Headers() };
  ok('rejects opaque responses', isCacheable(new Request(origin + '/'), opaque) === false);

  const errorRes = { ok: false, type: 'basic', headers: new Headers() };
  ok('rejects error responses', isCacheable(new Request(origin + '/'), errorRes) === false);

  // ---- what SHOULD be cacheable ----
  ok('static chunk is cacheable',
     isCacheable(new Request(origin + '/_next/static/chunks/main.js'), goodRes) === true);
  ok('icon is cacheable',
     isCacheable(new Request(origin + '/icons/icon-192.png'), goodRes) === true);
  ok('offline page is cacheable',
     isCacheable(new Request(origin + '/offline'), goodRes) === true);

  // ---- static asset detection ----
  ok('detects _next/static', isStaticAsset(U(origin + '/_next/static/chunks/x.js')));
  ok('detects icons', isStaticAsset(U(origin + '/icons/icon-192.png')));
  ok('does not treat a page as a static asset', !isStaticAsset(U(origin + '/dashboard')));
  ok('does not treat an API as a static asset', !isStaticAsset(U(origin + '/api/coach')));
}

// ------------------------------------------------------------
console.log('\n6) Proxy does not intercept PWA files');
{
  // Regression guard: the original matcher redirected /sw.js to /login.
  const proxy = fs.readFileSync(path.join(root, 'src/proxy.ts'), 'utf8');
  const m = proxy.match(/'(\/\(\(\?!.*?\)\.\*\))'/s);
  ok('matcher found in proxy.ts', !!m);

  if (m) {
    const re = new RegExp('^' + m[1].replace(/\\\\/g, '\\') + '$');
    ok('/sw.js bypasses the proxy', !re.test('/sw.js'));
    ok('/manifest.json bypasses the proxy', !re.test('/manifest.json'));
    ok('/offline bypasses the proxy', !re.test('/offline'));
    ok('/dashboard still goes through the proxy', re.test('/dashboard'));
    ok('/api/coach still goes through the proxy', re.test('/api/coach'));
  }
}

// ------------------------------------------------------------
console.log('\n7) HTML integration');
{
  const html = await (await fetch(`${BASE}/`)).text();
  ok('links the manifest', /rel="manifest"/.test(html));
  ok('sets theme-color', /name="theme-color"/.test(html));
  ok('declares apple-touch-icon', /apple-touch-icon/.test(html));
  ok('enables apple web app mode', /apple-mobile-web-app-capable/.test(html));
  ok('sets apple status bar style', /apple-mobile-web-app-status-bar-style/.test(html));
  ok('sets the apple app title', /apple-mobile-web-app-title/.test(html));
  ok('viewport-fit=cover for notches', /viewport-fit=cover/.test(html));
  ok('document is still RTL', html.includes('dir="rtl"'));
  ok('document lang is still fa', html.includes('lang="fa"'));
}

console.log(`\n${'='.repeat(52)}`);
console.log(`  ✅ passed: ${pass}    ❌ failed: ${fail}`);
console.log('='.repeat(52) + '\n');
process.exit(fail ? 1 : 0);
