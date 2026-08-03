'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, BridgeRing, Card, LevelBadge, Progress, Spinner } from '@/components/ui';
import { SKILL_FA, SKILL_ICON, type CefrLevel, type SkillKind } from '@/types/db';
import { announceBadges } from '@/lib/badge-events';
import Speak from '@/components/Speak';

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
          announceBadges(data.new_badges);
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
            <BridgeRing
              value={result.score}
              max={100}
              size={92}
              stroke={8}
              ariaLabel={`سطح ${result.level}`}
            >
              <span className="num text-2xl font-bold" style={{ color: 'var(--color-primary-700)' }}>
                {result.level}
              </span>
            </BridgeRing>
            <div className="text-start">
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
            رفتن به داشبورد
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
            <span className="badge bg-primary-50 text-primary-800">
              {SKILL_ICON[question.skill]} {SKILL_FA[question.skill]}
            </span>
            <LevelBadge level={question.level} showFa={false} />
          </div>
        </div>
        <Progress value={index} max={total} />
      </div>

      <Card className="p-6">
        <div className="mb-1 flex items-start gap-2">
          <p className="ltr text-lg font-medium" dir="ltr">{question.prompt}</p>
          <Speak text={question.prompt} />
        </div>
        {question.prompt_fa && (
          <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>{question.prompt_fa}</p>
        )}

        <div className="mt-5 space-y-2.5">
          {question.options.map((opt, i) => {
            // Icon + screen-reader text alongside colour (WCAG 1.4.1).
            let borderColor = 'var(--border-strong)';
            let background = 'transparent';
            let mark: string | null = null;
            let markLabel = '';
            let markColor = '';
            let anim = '';

            if (feedback) {
              if (i === feedback.correctIndex) {
                borderColor = 'var(--color-success-700)';
                background = 'var(--color-success-50)';
                mark = '✓';
                markLabel = 'پاسخ درست';
                markColor = 'var(--color-success-800)';
                anim = i === chosen ? 'answer-correct' : '';
              } else if (i === chosen && !feedback.correct) {
                borderColor = 'var(--color-error-600)';
                background = 'var(--color-error-50)';
                mark = '✗';
                markLabel = 'پاسخ شما — نادرست';
                markColor = 'var(--color-error-700)';
                anim = 'answer-wrong';
              }
            } else if (chosen === i) {
              borderColor = 'var(--color-primary-600)';
              background = 'var(--color-primary-50)';
              mark = '●';
              markLabel = 'انتخاب شما';
              markColor = 'var(--color-primary-700)';
            }

            return (
              <button
                key={i}
                onClick={() => !feedback && !loading && setChosen(i)}
                disabled={!!feedback || loading}
                aria-pressed={!feedback && chosen === i}
                className={`ltr flex w-full items-center gap-2 rounded-xl border-2 p-3.5 text-left transition-all disabled:cursor-default ${anim}`}
                style={{ borderColor, background }}
                dir="ltr"
              >
                <span className="num shrink-0 font-bold opacity-60">
                  {String.fromCharCode(65 + i)}.
                </span>
                <span className="flex-1">{opt}</span>
                {mark && (
                  <span className="shrink-0 text-base font-bold" style={{ color: markColor }}>
                    <span aria-hidden="true">{mark}</span>
                    <span className="sr-only">{markLabel}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div className="mt-4" role="status" aria-live="polite">
            <Alert kind={feedback.correct ? 'success' : 'warning'}>
              <b>{feedback.correct ? 'درست بود!' : 'پاسخ درست نبود.'}</b>
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
