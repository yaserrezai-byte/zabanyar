import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  BridgeRing,
  Card,
  Empty,
  LevelBadge,
  Progress,
  SectionTitle,
  Stat,
} from '@/components/ui';
import CoachPanel from '@/components/CoachPanel';
import SkillRadar from '@/components/SkillRadar';
import GenerateLessonButton from '@/components/GenerateLessonButton';
import { SKILL_FA, SKILL_ICON, type Profile, type SkillKind } from '@/types/db';
import { getLanguageContext } from '@/lib/active-language';
import { LANGUAGES } from '@/lib/languages';
import { daysAgo, nowIso, today } from '@/utils/dates';

export const metadata = { title: 'داشبورد | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Everything on this page is scoped to the active language.
  const { language, track } = await getLanguageContext(supabase, user.id);
  const langCfg = LANGUAGES[language];

  const [profileRes, skillsRes, lessonsRes, dueRes, historyRes, mistakesRes, assignRes] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('skill_levels').select('*').eq('user_id', user.id).eq('language', language),
      supabase.from('lessons').select('id, title_fa, title, skill, level, est_minutes, created_at')
        .eq('user_id', user.id).eq('language', language).order('created_at', { ascending: false }).limit(4),
      supabase.from('vocabulary_memory').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('language', language).lte('next_review_at', nowIso()),
      supabase.from('learning_history').select('xp, duration_sec, occurred_on')
        .eq('user_id', user.id)
        .eq('language', language)
        .gte('occurred_on', daysAgo(7)),
      supabase.from('mistakes_memory').select('error_tag, error_label_fa, occurrences, skill')
        .eq('user_id', user.id).eq('language', language).eq('resolved', false)
        .order('occurrences', { ascending: false }).limit(5),
      supabase.from('assignments').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('language', language).eq('status', 'assigned'),
    ]);

  const profile = profileRes.data as Profile;

  if (!track.placement_done) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <Empty
          icon="🎯"
          title={`بیایید ${langCfg.nameFa} را با آزمون تعیین سطح شروع کنیم`}
          description={`در حدود ۵ دقیقه و با ۱۴ سؤال تطبیقی، سطح واقعی شما در ${langCfg.nameFa} مشخص می‌شود. بعد از آن، برنامه یادگیری اختصاصی شما ساخته می‌شود.`}
          action={{ label: 'شروع آزمون تعیین سطح', href: '/placement' }}
          secondaryAction={{ label: 'تغییر زبان', href: '/languages' }}
        />
      </div>
    );
  }

  const skills = skillsRes.data ?? [];
  const history = historyRes.data ?? [];
  const lessons = lessonsRes.data ?? [];
  const totalXp = history.reduce((s, h) => s + (h.xp ?? 0), 0);
  const totalMin = Math.round(history.reduce((s, h) => s + (h.duration_sec ?? 0), 0) / 60);
  const dueCount = dueRes.count ?? 0;
  const assignCount = assignRes.count ?? 0;
  const todayMin = Math.round(
    history
      .filter((h) => h.occurred_on === today())
      .reduce((s, h) => s + (h.duration_sec ?? 0), 0) / 60
  );

  const activeLevel = (track.current_level ?? profile.current_level) as
    | Parameters<typeof LevelBadge>[0]['level']
    | null;
  const goal = profile.daily_goal_min || 15;
  const goalDone = todayMin >= goal;
  const remaining = Math.max(0, goal - todayMin);

  /**
   * One task, not four. The hero answers "what do I do right now?"
   * Priority: finish today's goal → clear due words → clear assignments → resume lesson.
   */
  const nextTask = goalDone
    ? dueCount > 0
      ? { href: '/vocabulary', cta: 'مرور لغات', why: `${dueCount} لغت آماده مرور است` }
      : { href: '/lessons', cta: 'یک درس دیگر', why: 'هدف امروز تمام شد — می‌توانی جلوتر بروی' }
    : dueCount > 0
      ? { href: '/vocabulary', cta: 'شروع مرور لغات', why: `${dueCount} لغت آماده مرور است` }
      : assignCount > 0
        ? { href: '/assignments', cta: 'انجام تکلیف', why: `${assignCount} تکلیف در انتظار توست` }
        : lessons.length
          ? { href: `/lessons/${lessons[0].id}`, cta: 'ادامه آخرین درس', why: lessons[0].title_fa || lessons[0].title }
          : { href: '/lessons', cta: 'شروع اولین درس', why: 'هنوز درسی شروع نکرده‌ای' };

  const firstName = (profile.full_name || 'زبان‌آموز').split(' ')[0];

  return (
    <div className="fade-in space-y-6">
      {/* ---------- header ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-h1">سلام {firstName} 👋</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <span aria-hidden="true">{langCfg.flag}</span>
            {langCfg.nameFa} · سطح فعلی شما:
            {activeLevel && <LevelBadge level={activeLevel} />}
          </p>
        </div>
        <GenerateLessonButton label="✨ ساخت درس جدید" />
      </div>

      {/* ---------- hero: today's task (the one dominant element) ---------- */}
      <section className="card-hero p-5 sm:p-6" aria-labelledby="today-heading">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <BridgeRing
            value={todayMin}
            max={goal}
            size={112}
            stroke={10}
            color="#ffffff"
            track="rgb(255 255 255 / .25)"
            ariaLabel={`${todayMin} دقیقه از ${goal} دقیقه هدف امروز`}
          >
            <span className="num text-2xl font-bold">{todayMin}</span>
            <span className="num text-[.7rem] opacity-80">از {goal} دقیقه</span>
          </BridgeRing>

          <div className="min-w-0 flex-1 text-center sm:text-start">
            <h2 id="today-heading" className="t-h2">
              {goalDone ? '🎉 هدف امروز کامل شد' : 'کار امروز'}
            </h2>
            <p className="mt-1.5 text-sm leading-7 opacity-95">
              {goalDone
                ? `${todayMin} دقیقه تمرین کردی. اگر انرژی داری، ادامه بده.`
                : `${remaining} دقیقه تا هدف امروز مانده. ${nextTask.why}.`}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <Link
                href={nextTask.href}
                className="btn"
                style={{ background: '#fff', color: 'var(--color-primary-800)' }}
              >
                {nextTask.cta}
              </Link>
              {track.streak_days > 0 && (
                <span className="badge bg-white/15 text-white">
                  <span aria-hidden="true">🔥</span>
                  <b className="num">{track.streak_days}</b> روز پیاپی
                </span>
              )}
            </div>
          </div>

          {/* week-at-a-glance — fills the hero on wide screens */}
          <dl className="hidden shrink-0 gap-6 border-s ps-6 lg:grid lg:grid-cols-2"
              style={{ borderColor: 'rgb(255 255 255 / .22)' }}>
            {[
              { k: 'امتیاز هفته', v: totalXp },
              { k: 'دقیقه هفته', v: totalMin },
              { k: 'لغت آماده مرور', v: dueCount },
              { k: 'تکلیف باز', v: assignCount },
            ].map((s) => (
              <div key={s.k}>
                <dt className="text-xs opacity-80">{s.k}</dt>
                <dd className="num mt-0.5 text-xl font-bold">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- secondary stats ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="امتیاز هفته" value={totalXp} icon="⭐" hint="مجموع XP ۷ روز اخیر" />
        <Stat label="دقیقه این هفته" value={totalMin} icon="⏱️" />
        <Stat label="روزهای پیاپی" value={track.streak_days} icon="🔥" />
        <Stat label="لغت آماده مرور" value={dueCount} icon="🔁" />
      </div>

      {/* ---------- coach ---------- */}
      <CoachPanel />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* skills */}
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
                            <span aria-hidden="true">{SKILL_ICON[s.skill as SkillKind]}</span>{' '}
                            {SKILL_FA[s.skill as SkillKind]}
                          </span>
                          <span className="num" style={{ color: 'var(--muted)' }}>
                            {Math.round(Number(s.score))} · {s.level}
                          </span>
                        </div>
                        <Progress
                          value={Number(s.score)}
                          label={`${SKILL_FA[s.skill as SkillKind]}: ${Math.round(Number(s.score))} از ۱۰۰`}
                        />
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <Empty
                icon="🧭"
                title="نقشه مهارت‌ها هنوز ساخته نشده"
                description="بعد از اولین درس یا آزمون، امتیاز شش مهارت شما اینجا رسم می‌شود."
                action={{ label: 'شروع یک درس', href: '/lessons' }}
              />
            )}
          </Card>

          {/* recent lessons */}
          <Card>
            <SectionTitle
              title="آخرین درس‌های شما"
              action={
                <Link
                  href="/lessons"
                  className="text-sm hover:underline"
                  style={{ color: 'var(--color-primary-700)' }}
                >
                  همه درس‌ها
                </Link>
              }
            />
            {lessons.length ? (
              <div className="space-y-2">
                {lessons.map((l) => (
                  <Link
                    key={l.id}
                    href={`/lessons/${l.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-primary-50"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{l.title_fa || l.title}</div>
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                        <span aria-hidden="true">{SKILL_ICON[l.skill as SkillKind]}</span>{' '}
                        {SKILL_FA[l.skill as SkillKind]} · <span className="num">{l.level}</span> ·{' '}
                        <span className="num">{l.est_minutes}</span> دقیقه
                      </div>
                    </div>
                    <span aria-hidden="true" className="shrink-0" style={{ color: 'var(--muted)' }}>
                      ‹
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                icon="📚"
                title="هنوز درسی نساخته‌ای"
                description="درس‌ها بر اساس سطح و نقاط ضعف شما ساخته می‌شوند. اولین درس را همین حالا بساز."
                action={{ label: 'ساخت اولین درس', href: '/lessons' }}
              />
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
                  className="flex items-center justify-between rounded-xl border p-3 text-sm transition-colors hover:bg-primary-50"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span>
                    <span aria-hidden="true">{q.icon}</span> {q.label}
                  </span>
                  {q.badge ? (
                    <span className="badge num bg-accent-50 text-accent-800">{q.badge}</span>
                  ) : (
                    <span aria-hidden="true" style={{ color: 'var(--muted)' }}>
                      ‹
                    </span>
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
                  <div
                    key={m.error_tag}
                    className="rounded-xl border p-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{m.error_label_fa || m.error_tag}</span>
                      <span className="badge num bg-warning-50 text-warning-800">
                        {m.occurrences}×
                      </span>
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
              <p className="text-sm leading-7" style={{ color: 'var(--muted)' }}>
                هنوز الگوی خطایی شناسایی نشده است. با تمرین بیشتر، تحلیل دقیق‌تر می‌شود.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
