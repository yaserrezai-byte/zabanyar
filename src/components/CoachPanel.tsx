'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, ErrorState, SkeletonText } from '@/components/ui';
import { SKILL_ICON, type SkillKind } from '@/types/db';

interface Coach {
  greeting_fa: string;
  analysis_fa: string;
  focus_area_fa: string;
  next_steps: { title_fa: string; why_fa: string; minutes: number; skill: string }[];
  motivation_fa: string;
  source: 'ai' | 'local';
}

const SKILL_LINK: Record<string, string> = {
  grammar: '/lessons',
  vocabulary: '/vocabulary',
  listening: '/lessons',
  speaking: '/tutor',
  reading: '/lessons',
  writing: '/assignments',
};

export default function CoachPanel() {
  const [data, setData] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch('/api/coach')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.error) setFailed(true);
        else setData(d);
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [attempt]);

  function retry() {
    setLoading(true);
    setFailed(false);
    setAttempt((a) => a + 1);
  }

  if (loading) {
    return (
      <Card aria-busy="true" aria-label="در حال آماده‌سازی تحلیل مربی">
        <div className="flex items-start gap-3">
          <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="skeleton mb-3 h-5 w-40" />
            <SkeletonText lines={2} />
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-20" />
              ))}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (failed && !data) {
    return (
      <ErrorState
        title="تحلیل مربی هوشمند بارگذاری نشد"
        description="اتصال اینترنت را بررسی کن و دوباره تلاش کن. بقیه داشبورد در دسترس است."
        onRetry={retry}
      />
    );
  }

  if (!data) return null;

  return (
    <Card
      className="border-s-4"
      style={{ borderInlineStartColor: 'var(--color-primary-600)' }}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden="true">🧠</span>
        <div className="min-w-0 flex-1">
          <h2 className="t-h2">{data.greeting_fa}</h2>
          <p className="mt-1.5 text-sm leading-7" style={{ color: 'var(--muted)' }}>
            {data.analysis_fa}
          </p>

          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-1.5 text-sm text-primary-800">
            <span aria-hidden="true">🎯</span> تمرکز امروز: <b>{data.focus_area_fa}</b>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            {data.next_steps?.slice(0, 3).map((s, i) => (
              <Link
                key={i}
                href={SKILL_LINK[s.skill] ?? '/lessons'}
                className="rounded-xl border p-3 transition-colors hover:bg-primary-50"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span aria-hidden="true">{SKILL_ICON[s.skill as SkillKind] ?? '📌'}</span>
                  <span className="truncate">{s.title_fa}</span>
                </div>
                <p className="mt-1 text-xs leading-6" style={{ color: 'var(--muted)' }}>
                  {s.why_fa}
                </p>
                <span className="num mt-1.5 inline-block text-xs" style={{ color: 'var(--muted)' }}>
                  ⏱ {s.minutes} دقیقه
                </span>
              </Link>
            ))}
          </div>

          <p className="mt-4 text-sm font-medium" style={{ color: 'var(--color-primary-800)' }}>
            {data.motivation_fa}
          </p>

          {data.source === 'local' && (
            <p className="mt-2 text-[11px]" style={{ color: 'var(--muted)' }}>
              حالت موتور محلی — برای تحلیل عمیق‌تر، کلید سرویس هوش مصنوعی را در تنظیمات محیطی اضافه کنید.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
