import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import WritingWorkshop from '@/components/WritingWorkshop';
import { Card, SectionTitle } from '@/components/ui';
import type { Assignment, Submission } from '@/types/db';
import { SKILL_FA, SKILL_ICON, type SkillKind } from '@/types/db';
import Speak from '@/components/Speak';

export const metadata = { title: 'تکالیف | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function AssignmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: assignments }, { data: submissions }] = await Promise.all([
    supabase.from('assignments').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(20),
    supabase.from('submissions').select('*').eq('user_id', user.id)
      .not('answer_text', 'is', null)
      .order('created_at', { ascending: false }).limit(10),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold">✍️ کارگاه نوشتن و تکالیف</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          هر متنی که بنویسید در چند ثانیه تصحیح می‌شود — با نمره، متن اصلاح‌شده و توضیح فارسی هر اشتباه.
        </p>
      </div>

      <WritingWorkshop assignments={(assignments ?? []) as Assignment[]} />

      {assignments && assignments.length > 0 && (
        <Card>
          <SectionTitle title="تکالیف من" />
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{a.title}</div>
                  <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                    {SKILL_ICON[a.skill as SkillKind]} {SKILL_FA[a.skill as SkillKind]}
                  </div>
                </div>
                <span className={`badge ${
                  a.status === 'graded' ? 'bg-emerald-100 text-emerald-700'
                  : a.status === 'submitted' ? 'bg-sky-100 text-sky-700'
                  : 'bg-amber-100 text-amber-700'
                }`}>
                  {{ assigned: 'در انتظار', submitted: 'ارسال شده', graded: 'تصحیح شده', late: 'با تأخیر', skipped: 'رد شده' }[a.status as string]}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {submissions && submissions.length > 0 && (
        <Card>
          <SectionTitle title="نوشته‌های تصحیح‌شده اخیر" />
          <div className="space-y-3">
            {submissions.map((s) => {
              const sub = s as Submission;
              return (
                <details key={sub.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
                  <summary className="flex cursor-pointer items-center justify-between gap-2">
                    <span className="ltr truncate text-sm" dir="ltr">
                      {(sub.answer_text ?? '').slice(0, 60)}…
                    </span>
                    <span className={`badge num shrink-0 ${
                      (sub.score ?? 0) >= 80 ? 'bg-emerald-100 text-emerald-700'
                      : (sub.score ?? 0) >= 55 ? 'bg-amber-100 text-amber-700'
                      : 'bg-rose-100 text-rose-700'
                    }`}>
                      {Math.round(sub.score ?? 0)}
                    </span>
                  </summary>
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="leading-7">{sub.feedback_fa}</p>
                    {sub.teacher_feedback && (
                      <div className="rounded-lg border border-brand-200 bg-brand-50 p-2.5">
                        <div className="mb-1 text-xs font-bold text-brand-700">
                          👨‍🏫 بازخورد مدرس
                          {sub.teacher_score != null && (
                            <span className="num badge mr-2 bg-brand-600 text-white">
                              {Math.round(sub.teacher_score)}
                            </span>
                          )}
                        </div>
                        <p className="leading-7">{sub.teacher_feedback}</p>
                      </div>
                    )}
                    {typeof sub.ai_feedback === 'object' && sub.ai_feedback && 'corrected_text' in sub.ai_feedback && (
                      <div className="rounded-lg p-2.5" style={{ background: 'var(--bg)' }}>
                        <div className="mb-1 text-xs font-bold">متن اصلاح‌شده:</div>
                        <div className="flex items-start gap-1.5">
                          <p className="ltr leading-7" dir="ltr">
                            {String((sub.ai_feedback as Record<string, unknown>).corrected_text)}
                          </p>
                          <Speak text={String((sub.ai_feedback as Record<string, unknown>).corrected_text)} />
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
