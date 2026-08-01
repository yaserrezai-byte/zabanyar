'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Card, LevelBadge, Progress, Spinner } from '@/components/ui';
import { SKILL_FA, SKILL_ICON, type CefrLevel, type SkillKind } from '@/types/db';

interface Question {
  id: string;
  skill: SkillKind;
  level: CefrLevel;
  prompt: string;
  prompt_fa?: string;
  options: string[];
}

interface Result {
  score: number;
  level: CefrLevel;
  level_fa: string;
  breakdown: Record<string, number>;
  summary: string;
}

export default function PlacementTest() {
  const router = useRouter();
  const [stage, setStage] = useState<'intro' | 'quiz' | 'done'>('intro');
  const [testId, setTestId] = useState<string>('');
  const [question, setQuestion] = useState<Question | null>(null);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(14);
  const [chosen, setChosen] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; explanation?: string; correctIndex: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/placement/start', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTestId(data.test_id);
      setQuestion(data.question);
      setIndex(data.index);
      setTotal(data.total);
      setStage('quiz');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در شروع آزمون');
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (chosen === null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/placement/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_id: testId, chosen_index: chosen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedback({
        correct: data.correct,
        explanation: data.explanation_fa,
        correctIndex: data.correct_index,
      });

      // brief pause to show the explanation
      setTimeout(() => {
        if (data.done) {
          setResult(data.result);
          setStage('done');
        } else {
          setQuestion(data.question);
          setIndex(data.index);
        }
        setChosen(null);
        setFeedback(null);
        setLoading(false);
      }, 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ثبت پاسخ');
      setLoading(false);
    }
  }

  // ---------------- intro ----------------
  if (stage === 'intro') {
    return (
      <Card className="p-8 text-center fade-in">
        <div className="mb-3 text-5xl">🎯</div>
        <h1 className="text-xl font-bold">آزمون تعیین سطح تطبیقی</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-8" style={{ color: 'var(--muted)' }}>
          این آزمون با هر پاسخ شما تنظیم می‌شود: اگر درست جواب دهید سؤال بعدی سخت‌تر
          و اگر اشتباه کنید ساده‌تر می‌شود. در پایان، سطح شما از A1 تا C2 و امتیاز
          هر مهارت مشخص خواهد شد.
        </p>
        <div className="mx-auto mt-5 grid max-w-sm grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
            <div className="text-lg">📝</div>
            <div className="num mt-1 font-bold">۱۴</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>سؤال</div>
          </div>
          <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
            <div className="text-lg">⏱️</div>
            <div className="num mt-1 font-bold">۵</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>دقیقه</div>
          </div>
          <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
            <div className="text-lg">🎓</div>
            <div className="num mt-1 font-bold">۶</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>مهارت</div>
          </div>
        </div>
        {error && <div className="mt-4"><Alert kind="error">{error}</Alert></div>}
        <button onClick={start} disabled={loading} className="btn btn-primary mt-6 px-8 py-3">
          {loading ? <Spinner /> : 'شروع آزمون'}
        </button>
      </Card>
    );
  }

  // ---------------- result ----------------
  if (stage === 'done' && result) {
    return (
      <Card className="p-8 fade-in">
        <div className="text-center">
          <div className="mb-3 text-5xl">🎉</div>
          <h1 className="text-xl font-bold">آزمون کامل شد!</h1>
          <div className="mt-4 flex items-center justify-center gap-3">
            <div className="text-4xl font-bold num" style={{ color: 'var(--color-brand-600)' }}>
              {result.level}
            </div>
            <div className="text-right">
              <div className="font-medium">{result.level_fa}</div>
              <div className="num text-sm" style={{ color: 'var(--muted)' }}>
                امتیاز: {Math.round(result.score)} از ۱۰۰
              </div>
            </div>
          </div>
        </div>

        <p className="mt-5 rounded-xl p-4 text-sm leading-8" style={{ background: 'var(--bg)' }}>
          {result.summary}
        </p>

        {Object.keys(result.breakdown).length > 0 && (
          <div className="mt-5 space-y-3">
            <h3 className="text-sm font-bold">امتیاز مهارت‌ها</h3>
            {Object.entries(result.breakdown).map(([skill, score]) => (
              <div key={skill}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>
                    {SKILL_ICON[skill as SkillKind]} {SKILL_FA[skill as SkillKind]}
                  </span>
                  <span className="num" style={{ color: 'var(--muted)' }}>{Math.round(score)}</span>
                </div>
                <Progress value={score} />
              </div>
            ))}
          </div>
        )}

        <div className="mt-7 flex gap-3">
          <button
            onClick={() => { router.push('/dashboard'); router.refresh(); }}
            className="btn btn-primary flex-1 py-3"
          >
            رفتن به داشبورد ←
          </button>
          <Link href="/lessons" className="btn btn-ghost py-3">شروع یادگیری</Link>
        </div>
      </Card>
    );
  }

  // ---------------- quiz ----------------
  if (!question) return <Card className="h-64 skeleton" />;

  return (
    <div className="fade-in">
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span style={{ color: 'var(--muted)' }}>
            سؤال <b className="num">{index + 1}</b> از <span className="num">{total}</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="badge bg-brand-50 text-brand-700">
              {SKILL_ICON[question.skill]} {SKILL_FA[question.skill]}
            </span>
            <LevelBadge level={question.level} showFa={false} />
          </div>
        </div>
        <Progress value={index} max={total} />
      </div>

      <Card className="p-6">
        <p className="ltr mb-1 text-lg font-medium" dir="ltr">{question.prompt}</p>
        {question.prompt_fa && (
          <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>{question.prompt_fa}</p>
        )}

        <div className="mt-5 space-y-2.5">
          {question.options.map((opt, i) => {
            let borderColor = 'var(--border)';
            let background = 'transparent';

            if (feedback) {
              if (i === feedback.correctIndex) {
                borderColor = '#10b981';
                background = 'rgb(16 185 129 / .1)';
              } else if (i === chosen && !feedback.correct) {
                borderColor = '#f43f5e';
                background = 'rgb(244 63 94 / .1)';
              }
            } else if (chosen === i) {
              borderColor = 'var(--color-brand-600)';
              background = 'var(--color-brand-50)';
            }

            return (
              <button
                key={i}
                onClick={() => !feedback && !loading && setChosen(i)}
                disabled={!!feedback || loading}
                className="ltr w-full rounded-xl border-2 p-3.5 text-left transition-all disabled:cursor-default"
                style={{ borderColor, background }}
                dir="ltr"
              >
                <span className="num mr-2 font-bold opacity-50">
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className="mt-4">
            <Alert kind={feedback.correct ? 'success' : 'error'}>
              <b>{feedback.correct ? 'درست بود! ✅' : 'پاسخ درست نبود.'}</b>
              {feedback.explanation && <div className="mt-1 leading-7">{feedback.explanation}</div>}
            </Alert>
          </div>
        )}

        {error && <div className="mt-4"><Alert kind="error">{error}</Alert></div>}

        {!feedback && (
          <button
            onClick={submit}
            disabled={chosen === null || loading}
            className="btn btn-primary mt-6 w-full py-3"
          >
            {loading ? <Spinner /> : 'ثبت پاسخ'}
          </button>
        )}
      </Card>
    </div>
  );
}
