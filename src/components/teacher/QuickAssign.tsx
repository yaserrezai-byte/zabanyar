'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Card, SectionTitle, Spinner } from '@/components/ui';
import { SKILLS, SKILL_FA, SKILL_ICON, type SkillKind } from '@/types/db';

export interface AssignableStudent {
  id: string;
  full_name: string | null;
  email: string | null;
  current_level?: string | null;
}

export interface AssignableLesson {
  id: string;
  title: string;
  title_fa: string | null;
  skill: string;
  level: string;
}

const TEMPLATES = [
  {
    title: 'تمرین نوشتاری هفتگی',
    skill: 'writing' as SkillKind,
    instructions_fa: 'یک متن ۱۵۰ کلمه‌ای درباره موضوع دلخواه خود بنویسید و در بخش «تکالیف» ارسال کنید.',
  },
  {
    title: 'مرور گرامر',
    skill: 'grammar' as SkillKind,
    instructions_fa: 'درس تعیین‌شده را مطالعه کنید و تمام تمرین‌های آن را کامل کنید.',
  },
  {
    title: 'تمرین مکالمه با مربی',
    skill: 'speaking' as SkillKind,
    instructions_fa: 'حداقل ۱۰ پیام با مربی هوشمند گفت‌وگو کنید و تصحیح‌ها را مرور کنید.',
  },
  {
    title: 'مرور لغات',
    skill: 'vocabulary' as SkillKind,
    instructions_fa: 'تمام لغات سررسیدشده در بخش «مرور لغات» را کامل کنید.',
  },
];

export default function QuickAssign({
  students,
  lessons,
  compact = false,
}: {
  students: AssignableStudent[];
  lessons: AssignableLesson[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(
    compact && students.length === 1 ? [students[0].id] : []
  );
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [skill, setSkill] = useState<SkillKind>('writing');
  const [lessonId, setLessonId] = useState('');
  const [dueDays, setDueDays] = useState('7');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const allSelected = selected.length === students.length && students.length > 0;

  function applyTemplate(t: (typeof TEMPLATES)[number]) {
    setTitle(t.title);
    setSkill(t.skill);
    setInstructions(t.instructions_fa);
  }

  async function submit() {
    if (!selected.length || !title.trim()) return;
    setSaving(true);
    setError(null);
    setDone(null);

    let due: string | null = null;
    if (dueDays !== '') {
      const d = new Date();
      d.setDate(d.getDate() + Number(dueDays));
      due = d.toISOString();
    }

    try {
      const res = await fetch('/api/teacher/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_ids: selected,
          title: title.trim(),
          instructions_fa: instructions.trim() || undefined,
          skill,
          lesson_id: lessonId || null,
          due_at: due,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تخصیص تکلیف ناموفق بود');

      setDone(data.created);
      setTitle('');
      setInstructions('');
      setLessonId('');
      if (!compact) setSelected([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای نامشخص');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <SectionTitle
        title="📝 تخصیص تکلیف"
        subtitle={
          compact
            ? 'یک تکلیف جدید برای این دانش‌آموز ثبت کنید'
            : 'یک یا چند دانش‌آموز را انتخاب و تکلیف را ثبت کنید'
        }
      />

      {/* ---------- students ---------- */}
      {!compact && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">
              دانش‌آموزان{' '}
              <span className="num" style={{ color: 'var(--muted)' }}>
                ({selected.length} انتخاب‌شده)
              </span>
            </span>
            <button
              onClick={() => setSelected(allSelected ? [] : students.map((s) => s.id))}
              className="text-xs hover:underline"
              style={{ color: 'var(--color-primary-600)' }}
            >
              {allSelected ? 'لغو انتخاب همه' : 'انتخاب همه'}
            </button>
          </div>
          <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className="rounded-full border px-3 py-1.5 text-xs transition-all"
                style={{
                  borderColor: selected.includes(s.id) ? 'var(--color-primary-600)' : 'var(--border)',
                  background: selected.includes(s.id) ? 'var(--color-primary-600)' : 'transparent',
                  color: selected.includes(s.id) ? '#fff' : 'var(--fg)',
                }}
              >
                {s.full_name || s.email}
                {s.current_level && <span className="num ms-1 opacity-70"> · {s.current_level}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------- templates ---------- */}
      <div className="mb-4">
        <div className="mb-2 text-sm font-medium">الگوهای آماده</div>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.title}
              onClick={() => applyTemplate(t)}
              className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-primary-50"
              style={{ borderColor: 'var(--border)' }}
            >
              {SKILL_ICON[t.skill]} {t.title}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- form ---------- */}
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium">عنوان تکلیف *</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثلاً: تمرین زمان گذشته ساده"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">مهارت</label>
            <select
              className="input"
              value={skill}
              onChange={(e) => setSkill(e.target.value as SkillKind)}
            >
              {SKILLS.map((s) => (
                <option key={s} value={s}>{SKILL_ICON[s]} {SKILL_FA[s]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">مهلت</label>
            <select className="input" value={dueDays} onChange={(e) => setDueDays(e.target.value)}>
              <option value="1">۱ روز</option>
              <option value="3">۳ روز</option>
              <option value="7">۱ هفته</option>
              <option value="14">۲ هفته</option>
              <option value="">بدون مهلت</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">درس مرتبط</label>
            <select className="input" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
              <option value="">— بدون درس —</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {(l.title_fa || l.title).slice(0, 45)} ({l.level})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">توضیحات (اختیاری)</label>
          <textarea
            className="input min-h-20 resize-y leading-7"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="توضیح تکلیف را به فارسی بنویسید…"
          />
        </div>

        <button
          onClick={submit}
          disabled={saving || !selected.length || !title.trim()}
          className="btn btn-primary w-full py-2.5"
        >
          {saving ? (
            <Spinner size={15} />
          ) : !selected.length ? (
            'ابتدا دانش‌آموز را انتخاب کنید'
          ) : !title.trim() ? (
            'عنوان تکلیف را بنویسید'
          ) : (
            `📤 ثبت تکلیف برای ${selected.length} دانش‌آموز`
          )}
        </button>

        {error && <Alert kind="error">{error}</Alert>}
        {done != null && (
          <Alert kind="success">
            تکلیف با موفقیت برای <b className="num">{done}</b> دانش‌آموز ثبت شد.
          </Alert>
        )}
      </div>
    </Card>
  );
}
