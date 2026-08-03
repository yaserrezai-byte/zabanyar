import type { Metadata } from 'next';
import OfflineActions from '@/components/OfflineActions';

export const metadata: Metadata = {
  title: 'آفلاین | زبان‌یار',
  description: 'اتصال اینترنت برقرار نیست.',
};

/**
 * Shown by the service worker when a navigation fails and no cached
 * copy of the requested page exists. Deliberately static and free of
 * user data so it can live safely in the shell cache.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mb-3 text-5xl">📡</div>
        <h1 className="text-xl font-bold">اتصال اینترنت برقرار نیست</h1>
        <p className="mt-3 text-sm leading-8" style={{ color: 'var(--muted)' }}>
          به نظر می‌رسد دستگاه شما آفلاین است. برای استفاده از درس‌ها، مربی هوشمند
          و مرور لغات به اینترنت نیاز دارید.
        </p>

        <div
          className="mt-5 rounded-xl border p-4 text-start text-sm leading-8"
          style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
        >
          <div className="mb-1 font-bold">💡 چند نکته</div>
          <ul className="space-y-1" style={{ color: 'var(--muted)' }}>
            <li>• اتصال Wi-Fi یا داده تلفن همراه را بررسی کنید.</li>
            <li>• حالت پرواز خاموش باشد.</li>
            <li>• پس از برقراری اتصال، صفحه را دوباره بارگذاری کنید.</li>
          </ul>
        </div>

        <OfflineActions />
      </div>
    </main>
  );
}
