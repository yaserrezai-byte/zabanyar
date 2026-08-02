'use client';

import { useEffect, useState } from 'react';

/** Retry controls + live connectivity indicator for the offline page. */
export default function OfflineActions() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return (
    <div className="mt-5 space-y-3">
      <div
        className="flex items-center justify-center gap-2 text-sm"
        style={{ color: online ? '#059669' : 'var(--muted)' }}
      >
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: online ? '#10b981' : '#94a3b8' }}
        />
        {online ? 'اتصال برقرار شد' : 'در انتظار اتصال…'}
      </div>

      <button
        onClick={() => window.location.reload()}
        className="btn btn-primary w-full py-2.5"
      >
        🔄 تلاش دوباره
      </button>

      <a href="/dashboard" className="btn btn-ghost w-full py-2.5">
        بازگشت به داشبورد
      </a>
    </div>
  );
}
