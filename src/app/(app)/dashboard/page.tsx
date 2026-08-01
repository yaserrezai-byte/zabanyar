import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, Empty, LevelBadge, Progress, SectionTitle, Stat } from '@/components/ui';
import CoachPanel from '@/components/CoachPanel';
import SkillRadar from '@/components/SkillRadar';
import GenerateLessonButton from '@/components/GenerateLessonButton';
import { SKILL_FA, SKILL_ICON, type Profile, type SkillKind } from '@/types/db';

export const metadata = { title: 'داشبورد | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, skillsRes, lessonsRes, dueRes, historyRes, mistakesRes, assignRes] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('skill_levels').select('*').eq('user_id', user.id),
      supabase.from('lessons').select('id, title_fa, title, skill, level, est_minutes, created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(4),
      supabase.from('vocabulary_memory').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).lte('next_review_at', new Date().toISOString()),
      supabase.from('learning_history').select('xp, duration_sec, occurred_on')
        .eq('user_id', user.id)
        .gte('occurred_on', new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)),
      supabase.from('mistakes_memory').select('error_tag, error_label_fa, occurrences, skill')
        .eq('user_id', user.id).eq('resolved', false)
        .order('occurrences', { ascending: false }).limit(5),
      supabase.from('assignments').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'assigned'),
    ]);

  const profile = profileRes.data as Profile;

  if (!profile.placement_done) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <Empty
          icon="🎯"
          title="بیایید با آزمون تعیین سطح شروع کنیم"
          description="در حدود ۵ دقیقه و با ۱۴ سؤال تطبیقی، سطح واقعی شما در شش مهارت مشخص می‌شود. بعد از آن، برنامه یادگیری اختصاصی شما ساخته می‌شود."
          action={{ label: 'شروع آزمون تعیین سطح', href: '/placement' }}
        />
      </div>
    );
  }

  const skills = skillsRes.data ?? [];
  const history = historyRes.data ?? [];
  const totalXp = history.reduce((s, h) => s + (h.xp ?? 0), 0);
  const totalMin = Math.round(history.reduce((s, h) => s + (h.duration_sec ?? 0), 0) / 60);
  const dueCount = dueRes.count ?? 0;
  const assignCount = assignRes.count ?? 0;
  const todayMin = Math.round(
    history
      .filter((h) => h.occurred_on === new Date().toISOString().slice(0, 10))
      .reduce((s, h) => s + (h.duration_sec ?? 0), 0) / 60
  );

  return (
    <div className="space-y-6 fade-in">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            سلام {profile.full_name || 'زبان‌آموز'} 👋
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            سطح فعلی شما:
            {profile.current_level && <LevelBadge level={profile.current_level} />}
          </p>
        </div>
        <GenerateLessonButton label="✨ ساخت درس جدید" />
      </div>

      {/* daily goal */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">هدف امروز</span>
          <span className="num text-sm" style={{ color: 'var(--muted)' }}>
            {todayMin} / {profile.daily_goal_min} دقیقه
          </span>
        </div>
        <Progress
          value={todayMin}
          max={profile.daily_goal_min}
          color={todayMin >= profile.daily_goal_min ? 'var(--color-accent-500)' : 'var(--color-brand-600)'}
          height={10}
        />
        {todayMin >= profile.daily_goal_min && (
          <p className="mt-2 text-sm text-emerald-600">🎉 آفرین! هدف امروز را کامل کردید.</p>
        )}
      </Card>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="امتیاز هفته" value={totalXp} icon="⭐" hint="مجموع XP ۷ روز اخیر" />
        <Stat label="دقیقه این هفته" value={totalMin} icon="⏱️" />
        <Stat label="روزهای پیاپی" value={profile.streak_days} icon="🔥" />
        <Stat label="لغت آماده مرور" value={dueCount} icon="🔁" />
      </div>

      {/* coach */}
      <CoachPanel />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* skills */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <SectionTitle title="نقشه مهارت‌های شما" subtitle="امتیاز هر مهارت از ۱۰۰" />
            {skills.length ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <SkillRadar
                  data={skills.map((s) => ({
                    skill: SKILL_FA[s.skill as SkillKind],
                    score: Number(s.score),
                  }))}
                />
                <div className="space-y-3">
                  {skills
                    .slice()
                    .sort((a, b) => Number(b.score) - Number(a.score))
                    .map((s) => (
                      <div key={s.id}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span>
                            {SKILL_ICON[s.skill as SkillKind]} {SKILL_FA[s.skill as SkillKind]}
                          </span>
                          <span className="num" style={{ color: 'var(--muted)' }}>
                            {Math.round(Number(s.score))} · {s.level}
                          </span>
                        </div>
                        <Progress value={Number(s.score)} />
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                هنوز داده‌ای ثبت نشده است.
              </p>
            )}
          </Card>

          {/* recent lessons */}
          <Card>
            <SectionTitle
              title="آخرین درس‌های شما"
              action={<Link href="/lessons" className="text-sm hover:underline" style={{ color: 'var(--color-brand-600)' }}>همه درس‌ها ←</Link>}
            />
            {lessonsRes.data?.length ? (
              <div className="space-y-2">
                {lessonsRes.data.map((l) => (
                  <Link
                    key={l.id}
                    href={`/lessons/${l.id}`}
                    className="flex items-center justify-between rounded-xl border p-3 transition-colors hover:bg-brand-50"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{l.title_fa || l.title}</div>
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                        {SKILL_ICON[l.skill as SkillKind]} {SKILL_FA[l.skill as SkillKind]} ·{' '}
                        <span className="num">{l.level}</span> · {l.est_minutes} دقیقه
                      </div>
                    </div>
                    <span style={{ color: 'var(--muted)' }}>←</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                هنوز درسی نساخته‌اید. روی «ساخت درس جدید» بزنید.
              </p>
            )}
          </Card>
        </div>

        {/* side */}
        <div className="space-y-6">
          <Card>
            <SectionTitle title="دسترسی سریع" />
            <div className="space-y-2">
              {[
                { href: '/tutor', icon: '💬', label: 'گفت‌وگو با مربی', badge: null },
                { href: '/vocabulary', icon: '🔁', label: 'مرور لغات', badge: dueCount || null },
                { href: '/assignments', icon: '✍️', label: 'تکالیف', badge: assignCount || null },
                { href: '/progress', icon: '📈', label: 'گزارش پیشرفت', badge: null },
              ].map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="flex items-center justify-between rounded-xl border p-3 text-sm transition-colors hover:bg-brand-50"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span>{q.icon} {q.label}</span>
                  {q.badge ? (
                    <span className="badge num bg-rose-100 text-rose-700">{q.badge}</span>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>←</span>
                  )}
                </Link>
              ))}
            </div>
          </Card>

          {/* error intelligence */}
          <Card>
            <SectionTitle title="🔍 تحلیل اشتباهات" subtitle="الگوهای تکرارشونده شما" />
            {mistakesRes.data?.length ? (
              <div className="space-y-2.5">
                {mistakesRes.data.map((m) => (
                  <div key={m.error_tag} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{m.error_label_fa || m.error_tag}</span>
                      <span className="badge num bg-amber-100 text-amber-700">{m.occurrences}×</span>
                    </div>
                    <div className="mt-2">
                      <GenerateLessonButton
                        label="درس اختصاصی بساز"
                        topic={m.error_tag}
                        skill={m.skill as SkillKind}
                        small
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                هنوز الگوی خطایی شناسایی نشده است. با تمرین بیشتر، تحلیل دقیق‌تر می‌شود.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
