import { createClient } from '@/lib/supabase/server';
import { Card, Empty, SectionTitle } from '@/components/ui';
import QuickAssign from '@/components/teacher/QuickAssign';
import { getRoster } from '@/lib/teacher';
import { SKILL_FA, SKILL_ICON, type SkillKind } from '@/types/db';

export const metadata = { title: 'تخصیص تکلیف | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function TeacherAssignmentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const roster = await getRoster(supabase);

  if (!roster.length) {
    return (
      <Empty
        icon="📝"
        title="دانش‌آموزی برای تخصیص تکلیف ندارید"
        description="ابتدا باید دانش‌آموزان به شما واگذار شوند."
        action={{ label: 'بازگشت به داشبورد', href: '/dashboard' }}
      />
    );
  }

  const ids = roster.map((s) => s.id);

  const [{ data: lessons }, { data: recent }] = await Promise.all([
    supabase
      .from('lessons')
      .select('id, title, title_fa, skill, level')
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('assignments')
      .select('id, title, skill, status, due_at, created_at, user_id')
      .in('user_id', ids)
      .eq('assigned_by', user!.id)
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  const nameOf = (id: string) =>
    roster.find((r) => r.id === id)?.full_name || 'دانش‌آموز';

  return (
    <div className="space-y-6 fade-in">
      <QuickAssign
        students={roster.map((r) => ({
          id: r.id,
          full_name: r.full_name,
          email: r.email,
          current_level: r.current_level,
        }))}
        lessons={lessons ?? []}
      />

      {recent && recent.length > 0 && (
        <Card>
          <SectionTitle title="تکالیفی که تخصیص داده‌اید" subtitle="۱۵ مورد اخیر" />
          <div className="space-y-2">
            {recent.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border p-3"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{a.title}</div>
                  <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                    👤 {nameOf(a.user_id)} · {SKILL_ICON[a.skill as SkillKind]}{' '}
                    {SKILL_FA[a.skill as SkillKind]}
                    {a.due_at && ` · مهلت: ${new Date(a.due_at).toLocaleDateString('fa-IR')}`}
                  </div>
                </div>
                <span
                  className={`badge shrink-0 ${
                    a.status === 'graded'
                      ? 'bg-emerald-100 text-emerald-700'
                      : a.status === 'submitted'
                        ? 'bg-sky-100 text-sky-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {{ assigned: 'در انتظار', submitted: 'ارسال شده', graded: 'تصحیح شده', late: 'با تأخیر', skipped: 'رد شده' }[a.status as string]}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
