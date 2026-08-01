'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CefrLevel, SkillKind } from '@/types/db';
import { Spinner } from '@/components/ui';

export default function GenerateLessonButton({
  label = 'ساخت درس جدید',
  topic,
  skill,
  level,
  small = false,
}: {
  label?: string;
  topic?: string;
  skill?: SkillKind;
  level?: CefrLevel;
  small?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/lessons/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, skill, level }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطا در ساخت درس');
      router.push(`/lessons/${data.lesson_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای نامشخص');
      setLoading(false);
    }
  }

  return (
    <div className={small ? '' : 'inline-block'}>
      <button
        onClick={go}
        disabled={loading}
        className={`btn btn-primary ${small ? 'w-full py-1.5 text-xs' : ''}`}
      >
        {loading ? <><Spinner size={14} /> در حال ساخت…</> : label}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
