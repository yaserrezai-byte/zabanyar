import { redirect } from 'next/navigation';
import { getLanguageContext } from '@/lib/active-language';
import { LANGUAGES } from '@/lib/languages';
import { createClient } from '@/lib/supabase/server';
import { Card, Empty, LevelBadge, Progress, SectionTitle, Stat } from '@/components/ui';
import ActivityChart from '@/components/ActivityChart';
import BadgeShelf from '@/components/BadgeShelf';
import SkillRadar from '@/components/SkillRadar';
import { SKILL_FA, SKILL_ICON, type Profile, type SkillKind } from '@/types/db';
import { lastNDays } from '@/utils/dates';

export const metadata = { title: 'گزارش پیشرفت | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function ProgressPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { language, track } = await getLanguageContext(supabase, user.id);
  const langCfg = LANGUAGES[language];
  const days = lastNDays(30);
  const since = days[0];

  const [{ data: profile }, { data: skills }, { data: history }, { data: mistakes }, { count: vocabTotal }, { count: vocabMastered }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('skill_levels').select('*').eq('user_id', user.id).eq('language', language),
      supabase.from('learning_history').select('occurred_on, xp, duration_sec, accuracy, event_type')
        .eq('user_id', user.id).eq('language', language).gte('occurred_on', since).order('occurred_on'),
      supabase.from('mistakes_memory').select('*').eq('user_id', user.id).eq('language', language)
        .order('occurrences', { ascending: false }).limit(10),
      supabase.from('vocabulary_memory').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('language', language),
      supabase.from('vocabulary_memory').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('language', language).gte('mastery', 0.8),
    ]);

  const p = profile as Profile;
  const h = history ?? [];

  if (!h.length && !skills?.length) {
    return (
      <Empty
        icon="📈"
        title="هنوز داده‌ای برای گزارش نیست"
        description="با تکمیل آزمون تعیین سطح و انجام چند درس، گزارش پیشرفت شما اینجا ساخته می‌شود."
        action={{ label: 'شروع یادگیری', href: '/dashboard' }}
      />
    );
  }

  // aggregate by day
  const byDay = new Map<string, { xp: number; minutes: number }>();
  for (const d of days) byDay.set(d, { xp: 0, minutes: 0 });
  for (const e of h) {
    const cur = byDay.get(e.occurred_on);
    if (cur) {
      cur.xp += e.xp ?? 0;
      cur.minutes += Math.round((e.duration_sec ?? 0) / 60);
    }
  }
  const chartData = Array.from(byDay.entries()).map(([date, v]) => ({
    date: date.slice(5),
    ...v,
  }));

  const totalXp = h.reduce((s, e) => s + (e.xp ?? 0), 0);
  const totalMin = Math.round(h.reduce((s, e) => s + (e.duration_sec ?? 0), 0) / 60);
  const accuracies = h.filter((e) => e.accuracy != null).map((e) => Number(e.accuracy));
  const avgAcc = accuracies.length
    ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)
    : 0;
  const activeDays = chartData.filter((d) => d.minutes > 0).length;

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="t-h1">📈 گزارش پیشرفت {langCfg.nameFa}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
          ۳۰ روز اخیر · سطح فعلی:
          {track.current_level && <LevelBadge level={track.current_level as never} />}
          {p.target_level && <>← هدف: <LevelBadge level={p.target_level} showFa={false} /></>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="مجموع امتیاز" value={totalXp} icon="⭐" />
        <Stat label="دقیقه یادگیری" value={totalMin} icon="⏱️" />
        <Stat label="دقت میانگین" value={`${avgAcc}٪`} icon="🎯" />
        <Stat label="روزهای فعال" value={`${activeDays}/۳۰`} icon="📅" />
        <Stat label="لغات مسلط" value={`${vocabMastered ?? 0}/${vocabTotal ?? 0}`} icon="📖" />
      </div>

      <BadgeShelf />

      <Card>
        <SectionTitle title="فعالیت روزانه" subtitle="دقیقه یادگیری در ۳۰ روز گذشته" />
        <ActivityChart data={chartData} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="نقشه مهارت‌ها" />
          {skills?.length ? (
            <>
              <SkillRadar
                data={skills.map((s) => ({
                  skill: SKILL_FA[s.skill as SkillKind],
                  score: Number(s.score),
                }))}
              />
              <div className="mt-4 space-y-2.5">
                {skills.slice().sort((a, b) => Number(b.score) - Number(a.score)).map((s) => (
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
            <p className="text-sm" style={{ color: 'var(--muted)' }}>داده‌ای موجود نیست.</p>
          )}
        </Card>

        <Card>
          <SectionTitle title="🔍 الگوهای خطا" subtitle="اشتباهاتی که بیشتر تکرار می‌کنید" />
          {mistakes?.length ? (
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
                  <div className="mt-2">
                    <Progress value={m.severity * 100} height={5} color="var(--color-warning-700)" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-7" style={{ color: 'var(--muted)' }}>
              هنوز الگوی خطایی شناسایی نشده است. با نوشتن و مکالمه بیشتر، تحلیل دقیق‌تر می‌شود.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
