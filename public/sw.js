/* ============================================================
 * زبان‌یار | Service Worker
 *
 * Hand-written rather than generated. next-pwa needs webpack (Next 16
 * builds with Turbopack) and @serwist/next injects a webpack config
 * that fails the default build, so a plain SW keeps the existing
 * Turbopack pipeline and CI untouched.
 *
 * SECURITY RULES — enforced in isCacheable() before any cache write:
 *   1. Nothing under /auth, /login, /signup is ever cached.
 *   2. No Supabase traffic is ever cached (tokens + per-user rows).
 *   3. No per-user API payload is ever cached. API responses are
 *      network-only with an offline JSON fallback; they never reach
 *      a Cache Storage bucket.
 *   4. Only the UI shell and static assets are cached.
 *   5. Any response carrying Set-Cookie / Authorization is rejected.
 * ============================================================ */

const VERSION = 'v1';
const SHELL_CACHE = `zabanyar-shell-${VERSION}`;
const STATIC_CACHE = `zabanyar-static-${VERSION}`;
const FONT_CACHE = `zabanyar-fonts-${VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, STATIC_CACHE, FONT_CACHE];

const OFFLINE_URL = '/offline';

/** Public shell routes safe to pre-cache: no user data is rendered. */
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/apple-touch-icon.png',
];

/* ------------------------------------------------------------
 * Never-cache rules
 * ---------------------------------------------------------- */

/** Auth surfaces and anything that could carry a session. */
const NEVER_CACHE_PATHS = [
  '/auth',
  '/login',
  '/signup',
  '/api/health',
];

/** Hosts we must never touch: Supabase holds tokens and per-user rows. */
function isSupabaseHost(url) {
  return (
    url.hostname.endsWith('.supabase.co') ||
    url.hostname.endsWith('.supabase.in')
  );
}

function isNeverCache(url) {
  if (isSupabaseHost(url)) return true;
  return NEVER_CACHE_PATHS.some(
    (p) => url.pathname === p || url.pathname.startsWith(p + '/')
  );
}

/** Static build output and our own icons/images. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:css|js|woff2?|ttf|otf|png|jpe?g|gif|webp|svg|ico)$/i.test(url.pathname)
  );
}

function isFontRequest(url) {
  return (
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'fonts.googleapis.com'
  );
}

/**
 * Final gate before writing to Cache Storage.
 * Rejects opaque/error responses and anything carrying credentials.
 */
function isCacheable(request, response) {
  const url = new URL(request.url);

  if (isNeverCache(url)) return false;
  if (url.pathname.startsWith('/api/')) return false; // per-user payloads
  if (!response || !response.ok) return false;
  if (response.type === 'opaque' || response.type === 'error') return false;
  if (response.headers.has('set-cookie')) return false;
  if (request.headers.has('authorization')) return false;
  if (response.headers.get('cache-control')?.includes('no-store')) return false;

  return true;
}

/* ------------------------------------------------------------
 * Install / activate
 * ---------------------------------------------------------- */

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, so one 404 cannot abort the whole install.
      await Promise.allSettled(
        PRECACHE_URLS.map((u) => cache.add(new Request(u, { cache: 'reload' })))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith('zabanyar-') && !KNOWN_CACHES.includes(n))
          .map((n) => caches.delete(n))
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((ks) =>
        Promise.all(ks.filter((k) => k.startsWith('zabanyar-')).map((k) => caches.delete(k)))
      )
    );
  }
});

/* ------------------------------------------------------------
 * Fetch strategies
 * ---------------------------------------------------------- */

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Leave auth + Supabase entirely alone — do not even intercept them,
  // so no token can transit this worker.
  if (isNeverCache(url)) return;

  // Cross-origin: only self-host fonts/CDN assets get cached.
  if (url.origin !== self.location.origin) {
    if (isFontRequest(url)) event.respondWith(fontStrategy(request));
    return;
  }

  // Page navigations -> network-first with shell/offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(navigationStrategy(event));
    return;
  }

  // Per-user APIs -> network-only + Persian offline JSON. Never cached.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(apiStrategy(request));
    return;
  }

  // Immutable build output + icons -> cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
});

/**
 * Navigations: try the network (so fresh, per-user HTML always wins),
 * fall back to a cached copy of the same page, then to /offline.
 *
 * Authenticated HTML is NOT written to the cache — see isCacheable().
 * Only public shell pages end up stored.
 */
async function navigationStrategy(event) {
  const { request } = event;
  const cache = await caches.open(SHELL_CACHE);

  try {
    const preload = await event.preloadResponse;
    const response = preload || (await fetch(request));

    if (isCacheable(request, response) && isPublicShell(new URL(request.url))) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;

    return new Response(
      '<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8">' +
        '<title>آفلاین</title><body style="font-family:Tahoma,sans-serif;text-align:center;padding:3rem">' +
        '<h1>اتصال اینترنت برقرار نیست</h1><p>لطفاً اتصال خود را بررسی کنید.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/** Pages with no per-user content, safe to keep in the shell cache. */
function isPublicShell(url) {
  return url.pathname === '/' || url.pathname === OFFLINE_URL;
}

/**
 * APIs: network-only. On failure return a Persian JSON envelope so the
 * client can show a proper message instead of a parse error.
 *
 * Deliberately never cached: /api/vocabulary/review, /api/tutor/message,
 * /api/grade, /api/coach and friends all return per-user data.
 */
async function apiStrategy(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(
      JSON.stringify({
        error: 'حالت آفلاین — اتصال اینترنت برقرار نیست.',
        detail:
          'این بخش برای کار کردن به اینترنت نیاز دارد. پس از برقراری اتصال دوباره تلاش کنید.',
        offline: true,
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

/** Immutable assets: serve from cache, revalidate in the background. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    event_revalidate(request, cache);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (isCacheable(request, response)) cache.put(request, response.clone());
    return response;
  } catch {
    return cached || Response.error();
  }
}

function event_revalidate(request, cache) {
  // Fire-and-forget refresh; failures are irrelevant offline.
  fetch(request)
    .then((res) => {
      if (isCacheable(request, res)) cache.put(request, res.clone());
    })
    .catch(() => {});
}

/** Webfonts: cache-first, they never change per user. */
async function fontStrategy(request) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    // Font CDNs may answer opaquely; store only clean CORS responses.
    if (response.ok && response.type !== 'opaque') {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || Response.error();
  }
}
