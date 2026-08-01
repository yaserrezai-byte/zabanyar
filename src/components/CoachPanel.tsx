'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui';
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

  useEffect(() => {
    let alive = true;
    fetch('/api/coach')
      .then((r) => r.json())
      .then((d) => alive && !d.error && setData(d))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <div className="space-y-3">
          <div className="skeleton h-5 w-40" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-3/4" />
        </div>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card
      className="border-0 text-white"
      style={{ background: 'linear-gradient(135deg, var(--color-brand-600), var(--color-brand-800))' }}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">🧠</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">{data.greeting_fa}</h2>
          <p className="mt-1.5 text-sm leading-7 opacity-95">{data.analysis_fa}</p>

          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 text-sm">
            🎯 تمرکز امروز: <b>{data.focus_area_fa}</b>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            {data.next_steps?.slice(0, 3).map((s, i) => (
              <Link
                key={i}
                href={SKILL_LINK[s.skill] ?? '/lessons'}
                className="rounded-xl bg-white/12 p-3 transition-colors hover:bg-white/20"
              >
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span>{SKILL_ICON[s.skill as SkillKind] ?? '📌'}</span>
                  <span className="truncate">{s.title_fa}</span>
                </div>
                <p className="mt-1 text-xs leading-6 opacity-85">{s.why_fa}</p>
                <span className="mt-1.5 inline-block text-xs opacity-75">
                  ⏱ {s.minutes} دقیقه
                </span>
              </Link>
            ))}
          </div>

          <p className="mt-4 text-sm font-medium opacity-95">{data.motivation_fa}</p>

          {data.source === 'local' && (
            <p className="mt-2 text-[11px] opacity-60">
              حالت موتور محلی — برای تحلیل عمیق‌تر، کلید سرویس هوش مصنوعی را در تنظیمات محیطی اضافه کنید.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
