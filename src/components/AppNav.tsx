'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Profile } from '@/types/db';
import { LEVEL_FA } from '@/types/db';

type NavLink = { href: string; label: string; shortLabel?: string; icon: string };

/**
 * IA: the five things a learner does daily sit in the bottom bar
 * (thumb-reachable). Everything episodic — social, analytics, admin —
 * lives behind «بیشتر». Order follows the learning loop:
 * see plan → study → drill words → practise speaking.
 */
const PRIMARY: NavLink[] = [
  { href: '/dashboard', label: 'داشبورد', icon: '🏠' },
  { href: '/lessons', label: 'درس‌ها', icon: '📚' },
  { href: '/vocabulary', label: 'مرور لغات', shortLabel: 'لغات', icon: '🔁' },
  { href: '/tutor', label: 'مربی هوشمند', shortLabel: 'مربی', icon: '💬' },
];

const SECONDARY: NavLink[] = [
  { href: '/assignments', label: 'تکالیف', icon: '✍️' },
  { href: '/pronunciation', label: 'تمرین تلفظ', icon: '🎤' },
  { href: '/group-conversation', label: 'گفت‌وگوی گروهی', icon: '👥' },
  { href: '/progress', label: 'پیشرفت', icon: '📈' },
  { href: '/leaderboard', label: 'جدول امتیاز', icon: '🏆' },
];

const ROLE_FA: Record<string, string> = {
  student: 'زبان‌آموز',
  teacher: 'مدرس',
  admin: 'مدیر',
};

export default function AppNav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const [userOpen, setUserOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // The path the menus were last opened on. Navigating away closes them
  // without a state-syncing effect.
  const [openedOn, setOpenedOn] = useState(pathname);
  const userRef = useRef<HTMLDivElement>(null);

  const sameRoute = openedOn === pathname;
  const showUser = userOpen && sameRoute;
  const showMore = moreOpen && sameRoute;

  const toggleUser = () => {
    setOpenedOn(pathname);
    setMoreOpen(false);
    setUserOpen((v) => !(v && sameRoute));
  };
  const toggleMore = () => {
    setOpenedOn(pathname);
    setUserOpen(false);
    setMoreOpen((v) => !(v && sameRoute));
  };
  const closeAll = () => {
    setUserOpen(false);
    setMoreOpen(false);
  };

  const secondary = [...SECONDARY];
  if (profile.role === 'teacher' || profile.role === 'admin') {
    secondary.push({ href: '/teacher', label: 'پنل مدرس', icon: '👨‍🏫' });
  }
  if (profile.role === 'admin') {
    secondary.push({ href: '/admin', label: 'مدیریت', icon: '🛡️' });
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const moreActive = secondary.some((l) => isActive(l.href));

  // close overlays on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const activeStyle = {
    background: 'var(--color-primary-50)',
    color: 'var(--color-primary-800)',
    fontWeight: 500,
  } as const;

  return (
    <>
      {/* ============ top bar ============ */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-lg"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in srgb, var(--bg) 90%, transparent)',
        }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-bold">
              <span className="text-xl" aria-hidden="true">
                🎓
              </span>
              <span>زبان‌یار</span>
            </Link>

            {/* desktop nav — primary inline, the rest behind «بیشتر» */}
            <nav className="hidden items-center gap-1 lg:flex" aria-label="ناوبری اصلی">
              {PRIMARY.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={isActive(l.href) ? 'page' : undefined}
                  className="rounded-lg px-3 py-1.5 text-sm transition-colors"
                  style={isActive(l.href) ? activeStyle : { color: 'var(--muted)' }}
                >
                  <span className="me-1" aria-hidden="true">
                    {l.icon}
                  </span>
                  {l.label}
                </Link>
              ))}

              <div className="relative">
                <button
                  onClick={toggleMore}
                  aria-expanded={showMore}
                  aria-haspopup="menu"
                  className="rounded-lg px-3 py-1.5 text-sm transition-colors"
                  style={moreActive || showMore ? activeStyle : { color: 'var(--muted)' }}
                >
                  <span className="me-1" aria-hidden="true">
                    ⋯
                  </span>
                  بیشتر
                </button>
                {showMore && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={closeAll} />
                    <div
                      role="menu"
                      className="card card-raised absolute z-20 mt-2 w-56 p-2 text-sm"
                      style={{ insetInlineStart: 0 }}
                    >
                      {secondary.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          role="menuitem"
                          aria-current={isActive(l.href) ? 'page' : undefined}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-primary-50"
                          style={isActive(l.href) ? activeStyle : undefined}
                        >
                          <span aria-hidden="true">{l.icon}</span>
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {profile.current_level && (
              <span className="badge hidden bg-primary-50 text-primary-800 sm:inline-flex">
                <b className="num">{profile.current_level}</b>
                {LEVEL_FA[profile.current_level]}
              </span>
            )}
            {profile.streak_days > 0 && (
              <span
                className="badge bg-accent-50 text-accent-800"
                title={`${profile.streak_days} روز پیاپی`}
              >
                <span aria-hidden="true">🔥</span>
                <b className="num">{profile.streak_days}</b>
                <span className="sr-only">روز پیاپی</span>
              </span>
            )}

            <div className="relative" ref={userRef}>
              <button
                onClick={toggleUser}
                className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: 'var(--color-primary-700)' }}
                aria-label="منوی کاربر"
                aria-expanded={showUser}
                aria-haspopup="menu"
              >
                {(profile.full_name || profile.email || '؟').charAt(0).toUpperCase()}
              </button>

              {showUser && (
                <>
                  <div className="fixed inset-0 z-10" onClick={closeAll} />
                  <div
                    role="menu"
                    className="card card-raised absolute z-20 mt-2 w-60 p-2 text-sm"
                    style={{ insetInlineEnd: 0 }}
                  >
                    <div className="border-b px-3 py-2" style={{ borderColor: 'var(--border)' }}>
                      <div className="font-medium">{profile.full_name || 'کاربر'}</div>
                      <div className="ltr truncate text-xs" style={{ color: 'var(--muted)' }}>
                        {profile.email}
                      </div>
                      <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                        نقش: {ROLE_FA[profile.role] ?? profile.role}
                      </div>
                    </div>
                    <Link
                      href="/onboarding"
                      role="menuitem"
                      className="block rounded-lg px-3 py-2.5 hover:bg-primary-50"
                    >
                      ⚙️ تنظیمات یادگیری
                    </Link>
                    <Link
                      href="/placement"
                      role="menuitem"
                      className="block rounded-lg px-3 py-2.5 hover:bg-primary-50"
                    >
                      🎯 آزمون تعیین سطح
                    </Link>
                    <form action="/auth/signout" method="post">
                      <button
                        type="submit"
                        role="menuitem"
                        className="w-full rounded-lg px-3 py-2.5 text-start hover:bg-error-50"
                        style={{ color: 'var(--color-error-700)' }}
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
      </header>

      {/* ============ mobile bottom nav ============ */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t lg:hidden"
        aria-label="ناوبری اصلی"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in srgb, var(--card) 96%, transparent)',
          backdropFilter: 'blur(12px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -1px 12px rgb(20 26 36 / .06)',
        }}
      >
        <div className="mx-auto flex max-w-lg items-stretch">
          {PRIMARY.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className="flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[.68rem] transition-colors"
                style={{ color: active ? 'var(--color-primary-700)' : 'var(--muted)' }}
              >
                <span className="relative text-xl leading-none" aria-hidden="true">
                  {l.icon}
                  {active && (
                    <span
                      className="absolute -bottom-1 start-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                      style={{ background: 'var(--color-primary-600)' }}
                    />
                  )}
                </span>
                <span style={{ fontWeight: active ? 700 : 400 }}>{l.shortLabel ?? l.label}</span>
              </Link>
            );
          })}

          <button
            onClick={toggleMore}
            aria-expanded={showMore}
            aria-haspopup="menu"
            className="flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[.68rem] transition-colors"
            style={{ color: moreActive || showMore ? 'var(--color-primary-700)' : 'var(--muted)' }}
          >
            <span className="text-xl leading-none" aria-hidden="true">
              ⋯
            </span>
            <span style={{ fontWeight: moreActive ? 700 : 400 }}>بیشتر</span>
          </button>
        </div>
      </nav>

      {/* ============ mobile «more» sheet ============ */}
      {showMore && (
        <div className="fixed inset-0 z-[55] lg:hidden">
          <div
            className="absolute inset-0"
            style={{ background: 'rgb(20 26 36 / .35)' }}
            onClick={closeAll}
          />
          <div
            role="menu"
            aria-label="ناوبری بیشتر"
            className="fade-in absolute inset-x-0 bottom-0 rounded-t-3xl p-4"
            style={{
              background: 'var(--card)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div
              className="mx-auto mb-4 h-1 w-10 rounded-full"
              style={{ background: 'var(--border-strong)' }}
            />
            <div className="grid grid-cols-3 gap-2">
              {secondary.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  role="menuitem"
                  aria-current={isActive(l.href) ? 'page' : undefined}
                  className="flex min-h-[5rem] flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center text-xs"
                  style={
                    isActive(l.href)
                      ? { borderColor: 'var(--color-primary-600)', ...activeStyle }
                      : { borderColor: 'var(--border)' }
                  }
                >
                  <span className="text-2xl" aria-hidden="true">
                    {l.icon}
                  </span>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
