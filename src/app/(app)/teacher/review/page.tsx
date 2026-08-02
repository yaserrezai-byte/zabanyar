import { createClient } from '@/lib/supabase/server';
import { Card, Empty, SectionTitle, Stat } from '@/components/ui';
import SubmissionReview from '@/components/teacher/SubmissionReview';
import type { ReviewableSubmission } from '@/components/teacher/SubmissionReview';
import { getRoster } from '@/lib/teacher';

export const metadata = { title: 'بازبینی پاسخ‌ها | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function TeacherReviewPage() {
  const supabase = await createClient();
  const roster = await getRoster(supabase);

  if (!roster.length) {
    return (
      <Empty
        icon="✅"
        title="پاسخی برای بازبینی نیست"
        description="هنوز دانش‌آموزی به شما واگذار نشده است."
        action={{ label: 'بازگشت به داشبورد', href: '/dashboard' }}
      />
    );
  }

  const ids = roster.map((s) => s.id);

  const [{ data: pending }, { data: reviewed }] = await Promise.all([
    supabase
      .from('submissions')
      .select('id, user_id, answer_text, score, feedback_fa, teacher_feedback, teacher_score, teacher_feedback_at, created_at')
      .in('user_id', ids)
      .is('teacher_feedback', null)
      .not('answer_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('submissions')
      .select('id, user_id, answer_text, score, feedback_fa, teacher_feedback, teacher_score, teacher_feedback_at, created_at')
      .in('user_id', ids)
      .not('teacher_feedback', 'is', null)
      .order('teacher_feedback_at', { ascending: false })
      .limit(10),
  ]);

  const nameOf = (id: string) => roster.find((r) => r.id === id)?.full_name ?? null;

  return (
    <div className="space-y-6 fade-in">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="در انتظار بازبینی" value={pending?.length ?? 0} icon="⏳" />
        <Stat label="بازبینی‌شده اخیر" value={reviewed?.length ?? 0} icon="✅" />
      </div>

      <Card>
        <SectionTitle
          title="⏳ در انتظار بازبینی شما"
          subtitle="پاسخ‌هایی که هنوز بازخورد شخصی نگرفته‌اند"
        />
        {pending?.length ? (
          <div className="space-y-3">
            {pending.map((s) => (
              <SubmissionReview
                key={s.id}
                submission={s as ReviewableSubmission}
                studentName={nameOf(s.user_id)}
                showStudent
              />
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            🎉 همه پاسخ‌ها بازبینی شده‌اند.
          </p>
        )}
      </Card>

      {reviewed && reviewed.length > 0 && (
        <Card>
          <SectionTitle title="✅ بازبینی‌شده" subtitle="می‌توانید بازخورد را ویرایش کنید" />
          <div className="space-y-3">
            {reviewed.map((s) => (
              <SubmissionReview
                key={s.id}
                submission={s as ReviewableSubmission}
                studentName={nameOf(s.user_id)}
                showStudent
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
