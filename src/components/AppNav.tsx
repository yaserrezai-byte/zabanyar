'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { Profile } from '@/types/db';
import { LEVEL_FA } from '@/types/db';

const LINKS = [
  { href: '/dashboard', label: 'داشبورد', icon: '🏠' },
  { href: '/lessons', label: 'درس‌ها', icon: '📚' },
  { href: '/tutor', label: 'مربی هوشمند', icon: '💬' },
  { href: '/group-conversation', label: 'گفت‌وگوی گروهی', icon: '👥' },
  { href: '/vocabulary', label: 'مرور لغات', icon: '🔁' },
  { href: '/pronunciation', label: 'تمرین تلفظ', icon: '🎤' },
  { href: '/assignments', label: 'تکالیف', icon: '✍️' },
  { href: '/progress', label: 'پیشرفت', icon: '📈' },
  { href: '/leaderboard', label: 'جدول امتیاز', icon: '🏆' },
];

export default function AppNav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [...LINKS];
  if (profile.role === 'teacher' || profile.role === 'admin') {
    links.push({ href: '/teacher', label: 'پنل مدرس', icon: '👨‍🏫' });
  }
  if (profile.role === 'admin') {
    links.push({ href: '/admin', label: 'مدیریت', icon: '🛡️' });
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-lg"
      style={{
        borderColor: 'var(--border)',
        background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
      }}
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-14 items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-bold">
              <span className="text-xl">🎓</span>
              <span className="hidden sm:inline">زبان‌یار</span>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-lg px-3 py-1.5 text-sm transition-colors"
                  style={
                    isActive(l.href)
                      ? { background: 'var(--color-brand-50)', color: 'var(--color-brand-700)', fontWeight: 500 }
                      : { color: 'var(--muted)' }
                  }
                >
                  <span className="ml-1">{l.icon}</span>
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {profile.current_level && (
              <span className="badge hidden bg-emerald-100 text-emerald-700 sm:inline-flex">
                <b className="num">{profile.current_level}</b>
                {LEVEL_FA[profile.current_level]}
              </span>
            )}
            {profile.streak_days > 0 && (
              <span className="badge bg-amber-100 text-amber-700">
                🔥 <b className="num">{profile.streak_days}</b>
              </span>
            )}

            <div className="relative">
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: 'var(--color-brand-600)' }}
                aria-label="منوی کاربر"
              >
                {(profile.full_name || profile.email || '؟').charAt(0).toUpperCase()}
              </button>

              {open && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                  <div
                    className="card absolute left-0 z-20 mt-2 w-56 p-2 text-sm shadow-lg"
                    style={{ background: 'var(--card)' }}
                  >
                    <div className="border-b px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                      <div className="font-medium">{profile.full_name || 'کاربر'}</div>
                      <div className="ltr truncate text-xs" style={{ color: 'var(--muted)' }}>
                        {profile.email}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                        نقش: {{ student: 'زبان‌آموز', teacher: 'مدرس', admin: 'مدیر' }[profile.role]}
                      </div>
                    </div>
                    <Link
                      href="/onboarding"
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2 hover:bg-brand-50"
                    >
                      ⚙️ تنظیمات یادگیری
                    </Link>
                    <Link
                      href="/placement"
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2 hover:bg-brand-50"
                    >
                      🎯 آزمون تعیین سطح
                    </Link>
                    <form action="/auth/signout" method="post">
                      <button
                        type="submit"
                        className="w-full rounded-lg px-3 py-2 text-right text-rose-600 hover:bg-rose-50"
                      >
                        🚪 خروج از حساب
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* mobile nav */}
        <nav className="flex gap-1 overflow-x-auto pb-2 lg:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs transition-colors"
              style={
                isActive(l.href)
                  ? { background: 'var(--color-brand-50)', color: 'var(--color-brand-700)', fontWeight: 500 }
                  : { color: 'var(--muted)' }
              }
            >
              <span className="ml-1">{l.icon}</span>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
