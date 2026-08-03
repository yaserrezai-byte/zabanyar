import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, LevelBadge, Progress, SectionTitle, Stat } from '@/components/ui';
import SkillRadar from '@/components/SkillRadar';
import SubmissionReview from '@/components/teacher/SubmissionReview';
import QuickAssign from '@/components/teacher/QuickAssign';
import { getStudentDetail } from '@/lib/teacher';
import { SKILL_FA, SKILL_ICON, type CefrLevel, type SkillKind } from '@/types/db';

export const dynamic = 'force-dynamic';

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const detail = await getStudentDetail(supabase, id);

  // RLS returns nothing for students outside this teacher's roster.
  if (!detail) notFound();

  const { profile, skills, mistakes, submissions, history, assignments } = detail;

  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title, title_fa, skill, level')
    .or(`user_id.eq.${id},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(30);

  const totalXp = history.reduce((t, h) => t + (h.xp ?? 0), 0);
  const totalMin = Math.round(history.reduce((t, h) => t + (h.duration_sec ?? 0), 0) / 60);
  const accs = history.filter((h) => h.accuracy != null).map((h) => Number(h.accuracy));
  const avgAcc = accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null;
  const activeDays = new Set(history.map((h) => h.occurred_on)).size;

  return (
    <div className="space-y-6 fade-in">
      <Link href="/teacher/students" className="text-sm hover:underline" style={{ color: 'var(--color-primary-600)' }}>
        → بازگشت به فهرست دانش‌آموزان
      </Link>

      {/* ---------- header ---------- */}
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ background: 'var(--color-primary-600)' }}
          >
            {(profile.full_name || profile.email || '؟').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">{profile.full_name || 'بدون نام'}</h2>
            <p className="ltr text-sm" style={{ color: 'var(--muted)' }} dir="ltr">{profile.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {profile.current_level && <LevelBadge level={profile.current_level as CefrLevel} />}
              {profile.target_level && (
                <span className="badge bg-primary-50 text-primary-800">
                  هدف: <b className="num">{profile.target_level}</b>
                </span>
              )}
              {profile.streak_days > 0 && (
                <span className="badge num bg-warning-50 text-warning-800">🔥 {profile.streak_days}</span>
              )}
              {!profile.placement_done && (
                <span className="badge bg-error-50 text-error-700">تعیین سطح نشده</span>
              )}
            </div>
            {profile.interests?.length > 0 && (
              <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                علاقه‌مندی‌ها: {profile.interests.join('، ')}
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="امتیاز ۳۰ روز" value={totalXp} icon="⭐" />
        <Stat label="دقیقه یادگیری" value={totalMin} icon="⏱️" />
        <Stat label="میانگین دقت" value={avgAcc != null ? `${avgAcc}٪` : '—'} icon="🎯" />
        <Stat label="روزهای فعال" value={`${activeDays}/۳۰`} icon="📅" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- skills ---------- */}
        <Card>
          <SectionTitle title="نقشه مهارت‌ها" subtitle="امتیاز هر مهارت از ۱۰۰" />
          {skills.length ? (
            <>
              <SkillRadar
                data={skills.map((s) => ({
                  skill: SKILL_FA[s.skill as SkillKind],
                  score: Number(s.score),
                }))}
              />
              <div className="mt-4 space-y-2.5">
                {[...skills].sort((a, b) => Number(b.score) - Number(a.score)).map((s) => (
                  <div key={s.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{SKILL_ICON[s.skill as SkillKind]} {SKILL_FA[s.skill as SkillKind]}</span>
                      <span className="num" style={{ color: 'var(--muted)' }}>
                        {Math.round(Number(s.score))} · {s.level}
                      </span>
                    </div>
                    <Progress value={Number(s.score)} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              هنوز آزمون تعیین سطح انجام نشده است.
            </p>
          )}
        </Card>

        {/* ---------- mistakes ---------- */}
        <Card>
          <SectionTitle title="🔍 تحلیل خطاها" subtitle="الگوهای تکرارشونده این دانش‌آموز" />
          {mistakes.length ? (
            <div className="space-y-2.5">
              {mistakes.map((m) => (
                <div key={m.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{m.error_label_fa || m.error_tag}</span>
                    <span className={`badge num ${m.resolved ? 'bg-success-50 text-success-800' : 'bg-warning-50 text-warning-800'}`}>
                      {m.occurrences}×
                    </span>
                  </div>
                  {m.example_wrong && m.example_correct && (
                    <div className="ltr mt-1.5 text-xs" style={{ color: 'var(--muted)' }} dir="ltr">
                      <span className="line-through">{m.example_wrong}</span> → <b>{m.example_correct}</b>
                    </div>
                  )}
                  {m.description_fa && (
                    <p className="mt-1 text-xs leading-6" style={{ color: 'var(--muted)' }}>
                      {m.description_fa}
                    </p>
                  )}
                  <div className="mt-2">
                    <Progress value={Number(m.severity) * 100} height={5} color="var(--color-warning-700)" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-7" style={{ color: 'var(--muted)' }}>
              هنوز الگوی خطایی ثبت نشده است.
            </p>
          )}
        </Card>
      </div>

      {/* ---------- assign ---------- */}
      <QuickAssign
        students={[{ id: profile.id, full_name: profile.full_name, email: profile.email }]}
        lessons={lessons ?? []}
        compact
      />

      {/* ---------- assignments ---------- */}
      {assignments.length > 0 && (
        <Card>
          <SectionTitle title="تکالیف این دانش‌آموز" />
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{a.title}</div>
                  <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                    {SKILL_ICON[a.skill as SkillKind]} {SKILL_FA[a.skill as SkillKind]}
                    {a.due_at && ` · مهلت: ${new Date(a.due_at).toLocaleDateString('fa-IR')}`}
                  </div>
                </div>
                <span className={`badge shrink-0 ${
                  a.status === 'graded' ? 'bg-success-50 text-success-800'
                  : a.status === 'submitted' ? 'bg-info-50 text-info-800'
                  : 'bg-warning-50 text-warning-800'
                }`}>
                  {{ assigned: 'در انتظار', submitted: 'ارسال شده', graded: 'تصحیح شده', late: 'با تأخیر', skipped: 'رد شده' }[a.status as string]}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ---------- submissions ---------- */}
      <Card>
        <SectionTitle
          title="پاسخ‌های اخیر"
          subtitle="می‌توانید علاوه بر بازخورد خودکار، بازخورد شخصی بنویسید"
        />
        {submissions.length ? (
          <div className="space-y-3">
            {submissions.map((s) => (
              <SubmissionReview key={s.id} submission={s} studentName={profile.full_name} />
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            هنوز پاسخ نوشتاری ثبت نشده است.
          </p>
        )}
      </Card>
    </div>
  );
}
