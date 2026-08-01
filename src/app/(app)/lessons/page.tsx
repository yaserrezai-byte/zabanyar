import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Empty, LevelBadge } from '@/components/ui';
import GenerateLessonButton from '@/components/GenerateLessonButton';
import { SKILL_FA, SKILL_ICON, type SkillKind } from '@/types/db';

export const metadata = { title: 'درس‌ها | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function LessonsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title, title_fa, summary_fa, skill, level, est_minutes, topic, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">📚 درس‌های من</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            هر درس بر اساس سطح و نقاط ضعف شما ساخته می‌شود.
          </p>
        </div>
        <GenerateLessonButton label="✨ ساخت درس جدید" />
      </div>

      {lessons?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((l) => (
            <Link key={l.id} href={`/lessons/${l.id}`}>
              <Card className="h-full transition-transform hover:-translate-y-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="badge bg-brand-50 text-brand-700">
                    {SKILL_ICON[l.skill as SkillKind]} {SKILL_FA[l.skill as SkillKind]}
                  </span>
                  <LevelBadge level={l.level} showFa={false} />
                </div>
                <h3 className="font-bold leading-7">{l.title_fa || l.title}</h3>
                {l.summary_fa && (
                  <p className="mt-2 line-clamp-3 text-sm leading-7" style={{ color: 'var(--muted)' }}>
                    {l.summary_fa}
                  </p>
                )}
                <div className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
                  ⏱ {l.est_minutes} دقیقه
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          icon="📚"
          title="هنوز درسی ندارید"
          description="روی دکمه «ساخت درس جدید» بزنید تا اولین درس شخصی‌سازی‌شده شما ساخته شود."
        />
      )}
    </div>
  );
}
