import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, Empty, LevelBadge, Progress, SectionTitle, Stat } from '@/components/ui';
import { getRosterWithStats, summarise } from '@/lib/teacher';
import type { CefrLevel } from '@/types/db';

export const metadata = { title: 'پنل مدرس | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function TeacherOverviewPage() {
  const supabase = await createClient();
  const students = await getRosterWithStats(supabase);
  const s = summarise(students);

  if (!students.length) {
    return (
      <Empty
        icon="👥"
        title="هنوز دانش‌آموزی به شما واگذار نشده است"
        description="مدیر سامانه باید دانش‌آموزان را به شما اختصاص دهد. پس از آن، پیشرفت آن‌ها اینجا نمایش داده می‌شود."
        action={{ label: 'بازگشت به داشبورد', href: '/dashboard' }}
      />
    );
  }

  const needAttention = students
    .filter((x) => x.activeDays7 === 0 || x.pendingReview > 0 || !x.placement_done)
    .slice(0, 6);

  const mostActive = [...students].sort((a, b) => b.xp7 - a.xp7).slice(0, 5);

  return (
    <div className="space-y-6 fade-in">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="دانش‌آموزان" value={s.total} icon="👥" />
        <Stat label="فعال (۷ روز)" value={s.active7} icon="🔥" hint={`${s.inactive} غیرفعال`} />
        <Stat label="میانگین دقت" value={s.avgAccuracy != null ? `${s.avgAccuracy}٪` : '—'} icon="🎯" />
        <Stat label="دقیقه این هفته" value={s.totalMinutes7} icon="⏱️" />
        <Stat label="در انتظار بازبینی" value={s.totalPending} icon="✅" />
      </div>

      {/* level distribution */}
      {s.byLevel.length > 0 && (
        <Card>
          <SectionTitle title="توزیع سطح دانش‌آموزان" subtitle="بر اساس نتیجه آزمون تعیین سطح" />
          <div className="space-y-2.5">
            {s.byLevel.map((b) => (
              <div key={b.level}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <LevelBadge level={b.level as CefrLevel} />
                  <span className="num" style={{ color: 'var(--muted)' }}>{b.count} نفر</span>
                </div>
                <Progress value={b.count} max={s.total} />
              </div>
            ))}
            {s.unlevelled > 0 && (
              <p className="pt-1 text-xs" style={{ color: 'var(--muted)' }}>
                {s.unlevelled} دانش‌آموز هنوز آزمون تعیین سطح نداده‌اند.
              </p>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* needs attention */}
        <Card>
          <SectionTitle
            title="🔔 نیازمند توجه"
            subtitle="غیرفعال، بدون تعیین سطح، یا منتظر بازبینی"
          />
          {needAttention.length ? (
            <div className="space-y-2">
              {needAttention.map((st) => (
                <Link
                  key={st.id}
                  href={`/teacher/students/${st.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-brand-50"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{st.full_name || 'بدون نام'}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs">
                      {!st.placement_done && (
                        <span className="badge bg-amber-100 text-amber-700">تعیین سطح نشده</span>
                      )}
                      {st.activeDays7 === 0 && (
                        <span className="badge bg-rose-100 text-rose-700">۷ روز غیرفعال</span>
                      )}
                      {st.pendingReview > 0 && (
                        <span className="badge num bg-sky-100 text-sky-700">
                          {st.pendingReview} پاسخ بازبینی‌نشده
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ color: 'var(--muted)' }}>←</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              همه دانش‌آموزان فعال‌اند و پاسخ بازبینی‌نشده‌ای وجود ندارد. 🎉
            </p>
          )}
        </Card>

        {/* most active */}
        <Card>
          <SectionTitle title="🏆 فعال‌ترین‌های هفته" subtitle="بر اساس امتیاز ۷ روز اخیر" />
          {mostActive.some((m) => m.xp7 > 0) ? (
            <div className="space-y-2">
              {mostActive.map((st, i) => (
                <Link
                  key={st.id}
                  href={`/teacher/students/${st.id}`}
                  className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-brand-50"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span className="num w-5 text-sm font-bold" style={{ color: 'var(--muted)' }}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{st.full_name || 'بدون نام'}</div>
                    <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                      <span className="num">{st.minutes7}</span> دقیقه ·{' '}
                      <span className="num">{st.activeDays7}</span> روز فعال
                    </div>
                  </div>
                  <span className="badge num bg-emerald-100 text-emerald-700">{st.xp7} XP</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              در ۷ روز گذشته فعالیتی ثبت نشده است.
            </p>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/teacher/students" className="btn btn-ghost">👥 همه دانش‌آموزان</Link>
        <Link href="/teacher/assignments" className="btn btn-primary">📝 تخصیص تکلیف</Link>
        {s.totalPending > 0 && (
          <Link href="/teacher/review" className="btn btn-accent">
            ✅ بازبینی {s.totalPending} پاسخ
          </Link>
        )}
      </div>
    </div>
  );
}
