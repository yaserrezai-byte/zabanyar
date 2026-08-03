'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/teacher', label: 'نمای کلی', icon: '📊', exact: true },
  { href: '/teacher/students', label: 'دانش‌آموزان', icon: '👥' },
  { href: '/teacher/assignments', label: 'تخصیص تکلیف', icon: '📝' },
  { href: '/teacher/review', label: 'بازبینی پاسخ‌ها', icon: '✅' },
];

export default function TeacherTabs({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const active = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">👨‍🏫 پنل مدرس</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {isAdmin
            ? 'شما به‌عنوان مدیر همه دانش‌آموزان را می‌بینید.'
            : 'فقط دانش‌آموزانی که به شما واگذار شده‌اند نمایش داده می‌شوند.'}
        </p>
      </div>

      <nav className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-lg px-3 py-1.5 text-sm transition-colors"
            style={
              active(t.href, t.exact)
                ? { background: 'var(--color-primary-50)', color: 'var(--color-primary-700)', fontWeight: 500 }
                : { color: 'var(--muted)' }
            }
          >
            <span className="me-1" aria-hidden="true">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
