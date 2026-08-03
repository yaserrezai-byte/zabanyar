'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Card, Progress, Spinner } from '@/components/ui';
import type { Assignment, SkillKind } from '@/types/db';
import { announceBadges } from '@/lib/badge-events';
import Speak from '@/components/Speak';

const PROMPTS = [
  { fa: 'روز خود را توصیف کنید', en: 'Describe your day today. What did you do?' },
  { fa: 'درباره یک سفر به‌یادماندنی', en: 'Write about a memorable trip you have taken.' },
  { fa: 'یک ایمیل رسمی بنویسید', en: 'Write a formal email asking for a meeting with your manager.' },
  { fa: 'نظرتان درباره شبکه‌های اجتماعی', en: 'Do you think social media is good or bad for society? Why?' },
  { fa: 'معرفی خودتان', en: 'Introduce yourself: your job, hobbies, and goals.' },
];

interface GradeResult {
  score: number;
  is_correct: boolean;
  feedback_fa: string;
  strengths_fa: string[];
  improvements_fa: string[];
  corrected_text: string;
  errors: { wrong: string; right: string; note_fa: string; error_tag?: string }[];
  source: 'ai' | 'local';
}

export default function WritingWorkshop({ assignments }: { assignments: Assignment[] }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [skill, setSkill] = useState<SkillKind>('writing');
  const [assignmentId, setAssignmentId] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = assignments.filter((a) => a.status === 'assigned');
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  async function grade() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          skill,
          question: question || undefined,
          assignment_id: assignmentId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      announceBadges(data.new_badges);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در تصحیح');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        {/* prompts */}
        <div className="mb-4">
          <div className="mb-2 text-sm font-medium">موضوع پیشنهادی (اختیاری)</div>
          <div className="flex flex-wrap gap-2">
            {PROMPTS.map((p) => (
              <button
                key={p.fa}
                onClick={() => setQuestion(p.en)}
                className="rounded-full border px-3 py-1.5 text-xs transition-colors"
                style={{
                  borderColor: question === p.en ? 'var(--color-primary-600)' : 'var(--border)',
                  background: question === p.en ? 'var(--color-primary-50)' : 'transparent',
                }}
              >
                {p.fa}
              </button>
            ))}
          </div>
          {question && (
            <p className="ltr mt-2 rounded-lg p-2.5 text-sm" style={{ background: 'var(--bg)' }} dir="ltr">
              {question}
            </p>
          )}
        </div>

        {pending.length > 0 && (
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium">مرتبط با تکلیف</label>
            <select
              className="input"
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
            >
              <option value="">— بدون تکلیف —</option>
              {pending.map((a) => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium">متن انگلیسی شما</label>
            <span className="num text-xs" style={{ color: 'var(--muted)' }}>{words} کلمه</span>
          </div>
          <textarea
            className="input ltr min-h-40 resize-y leading-8"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your text in English here…"
            dir="ltr"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input w-auto"
            value={skill}
            onChange={(e) => setSkill(e.target.value as SkillKind)}
          >
            <option value="writing">✍️ نوشتن</option>
            <option value="grammar">📐 گرامر</option>
            <option value="vocabulary">📚 واژگان</option>
            <option value="speaking">🗣️ گفتاری</option>
          </select>
          <button onClick={grade} disabled={loading || !text.trim()} className="btn btn-primary flex-1">
            {loading ? <><Spinner size={15} /> در حال تصحیح…</> : '🔍 تصحیح و نمره‌دهی'}
          </button>
        </div>

        {error && <div className="mt-3"><Alert kind="error">{error}</Alert></div>}
      </Card>

      {result && (
        <Card className="fade-in">
          <div className="mb-4 flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white num"
              style={{
                background:
                  result.score >= 80 ? 'var(--color-success-700)' : result.score >= 55 ? 'var(--color-warning-700)' : 'var(--color-error-600)',
              }}
            >
              {Math.round(result.score)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="leading-8">{result.feedback_fa}</p>
              <div className="mt-2">
                <Progress
                  value={result.score}
                  color={result.score >= 80 ? 'var(--color-success-700)' : result.score >= 55 ? 'var(--color-warning-700)' : 'var(--color-error-600)'}
                />
              </div>
            </div>
          </div>

          {result.corrected_text && result.corrected_text !== text && (
            <div className="mb-4 rounded-xl p-3" style={{ background: 'var(--bg)' }}>
              <div className="mb-1.5 text-sm font-bold">✅ متن اصلاح‌شده</div>
              <div className="flex items-start gap-1.5">
                <p className="ltr leading-8" dir="ltr">{result.corrected_text}</p>
                <Speak text={result.corrected_text} />
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-sm font-bold">🔍 اشتباهات ({result.errors.length})</div>
              <div className="space-y-2">
                {result.errors.map((e, i) => (
                  <div key={i} className="rounded-xl border border-error-100 bg-error-50 p-3 text-sm">
                    <div className="text-error-700">
                      <span className="ltr inline-block line-through opacity-60" dir="ltr">{e.wrong}</span>
                      {' → '}
                      <span className="ltr inline-block font-bold" dir="ltr">{e.right}</span>
                      <Speak text={e.right} size="xs" />
                    </div>
                    <div className="mt-1 text-xs leading-7 text-error-700">{e.note_fa}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {result.strengths_fa?.length > 0 && (
              <div className="rounded-xl border border-success-100 bg-success-50 p-3">
                <div className="mb-1.5 text-sm font-bold text-success-800">💪 نقاط قوت</div>
                <ul className="space-y-1 text-sm text-success-800">
                  {result.strengths_fa.map((s, i) => <li key={i}>• {s}</li>)}
                </ul>
              </div>
            )}
            {result.improvements_fa?.length > 0 && (
              <div className="rounded-xl border border-info-100 bg-info-50 p-3">
                <div className="mb-1.5 text-sm font-bold text-info-800">📈 برای بهبود</div>
                <ul className="space-y-1 text-sm text-info-800">
                  {result.improvements_fa.map((s, i) => <li key={i}>• {s}</li>)}
                </ul>
              </div>
            )}
          </div>

          <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
            این اشتباهات به حافظه هوشمند اضافه شدند و در ساخت درس بعدی شما لحاظ می‌شوند.
          </p>
        </Card>
      )}
    </div>
  );
}
