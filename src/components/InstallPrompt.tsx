'use client';

import { useCallback, useEffect, useState } from 'react';

/** Chromium's non-standard install event. */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

const SESSION_KEY = 'zabanyar:install-prompt-shown';
const DISMISS_KEY = 'zabanyar:install-dismissed-at';
/** Once dismissed, stay quiet for two weeks. */
const DISMISS_DAYS = 14;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(navigator as Navigator & { standalone?: boolean }).standalone
  );
}

function recentlyDismissed(): boolean {
  try {
    const at = localStorage.getItem(DISMISS_KEY);
    if (!at) return false;
    return Date.now() - Number(at) < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/**
 * Non-intrusive install banner.
 *
 * - Appears at most once per browser session (sessionStorage).
 * - Stays hidden for two weeks after an explicit dismissal.
 * - Never shows when the app is already installed.
 * - Falls back to manual instructions on iOS, which has no
 *   beforeinstallprompt event.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [installing, setInstalling] = useState(false);

  const alreadyShownThisSession = () => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return false;
    }
  };

  const markShown = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* private mode */
    }
  };

  useEffect(() => {
    if (isStandalone() || alreadyShownThisSession() || recentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      // Let the user get their bearings before interrupting.
      window.setTimeout(() => {
        setVisible(true);
        markShown();
      }, 4000);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS never fires the event; offer manual instructions instead.
    let iosTimer: number | undefined;
    if (isIos()) {
      iosTimer = window.setTimeout(() => {
        setIosHint(true);
        setVisible(true);
        markShown();
      }, 6000);
    }

    const onInstalled = () => setVisible(false);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'dismissed') {
        try {
          localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* user closed the sheet */
    } finally {
      setDeferred(null);
      setVisible(false);
      setInstalling(false);
    }
  }, [deferred]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="نصب اپلیکیشن زبان‌یار"
      className="fade-in fixed inset-x-3 z-[60] mx-auto max-w-md sm:inset-x-auto sm:start-4"
      style={{ bottom: 'calc(var(--bottom-nav-h) + env(safe-area-inset-bottom) + 0.75rem)' }}
    >
      <div
        className="card flex items-start gap-3 p-4 shadow-lg"
        style={{ borderColor: 'var(--color-primary-300)' }}
      >
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #337dff, #193cb6)' }}
          aria-hidden
        >
          ز
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-bold">نصب زبان‌یار</div>

          {iosHint ? (
            <p className="mt-1 text-sm leading-7" style={{ color: 'var(--muted)' }}>
              برای نصب روی آیفون: دکمه اشتراک‌گذاری{' '}
              <span aria-hidden>􀈂</span> را بزنید و{' '}
              <b>«Add to Home Screen»</b> را انتخاب کنید.
            </p>
          ) : (
            <p className="mt-1 text-sm leading-7" style={{ color: 'var(--muted)' }}>
              برای دسترسی سریع‌تر و تجربه‌ای شبیه اپلیکیشن، زبان‌یار را روی دستگاه
              خود نصب کنید.
            </p>
          )}

          <div className="mt-3 flex gap-2">
            {!iosHint && (
              <button
                onClick={install}
                disabled={installing}
                className="btn btn-primary flex-1 py-2 text-sm"
              >
                {installing ? 'در حال نصب…' : '⬇️ نصب زبان‌یار'}
              </button>
            )}
            <button
              onClick={dismiss}
              className={`btn btn-ghost py-2 text-sm ${iosHint ? 'flex-1' : ''}`}
            >
              بعداً
            </button>
          </div>
        </div>

        <button
          onClick={dismiss}
          aria-label="بستن"
          className="shrink-0 rounded-lg px-1.5 text-lg leading-none"
          style={{ color: 'var(--muted)' }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
