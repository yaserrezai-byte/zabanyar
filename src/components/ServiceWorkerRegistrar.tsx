'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js on mount.
 *
 * Registration is skipped in development so a stale worker never serves
 * old chunks while iterating. When a new worker takes control we reload
 * once so the user is never left on a half-updated shell.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        // Activate an updated worker straight away.
        reg.addEventListener('updatefound', () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener('statechange', () => {
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              next.postMessage('SKIP_WAITING');
            }
          });
        });

        // Check for a new build when the tab regains focus.
        const onVisible = () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
      } catch (err) {
        console.error('[pwa] service worker registration failed:', err);
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    const cleanup = register();

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      void cleanup.then((fn) => fn?.());
    };
  }, []);

  return null;
}
