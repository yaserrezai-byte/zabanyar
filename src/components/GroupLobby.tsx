'use client';

import { useState } from 'react';
import { Alert, Card, LevelBadge, SectionTitle, Spinner } from '@/components/ui';
import GroupChat, { type Participant } from '@/components/GroupChat';
import { scenarioById, type GroupScenario } from '@/lib/group-chat';
import type { CefrLevel } from '@/types/db';
import Speak from '@/components/Speak';

export default function GroupLobby({
  level,
  scenarios,
  openRooms,
  allScenarioCount,
}: {
  level: CefrLevel;
  scenarios: GroupScenario[];
  openRooms: Record<string, number>;
  allScenarioCount: number;
}) {
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{
    id: string;
    scenario: GroupScenario;
    me: string;
    participants: Participant[];
  } | null>(null);

  async function join(scenario: GroupScenario) {
    setJoining(scenario.id);
    setError(null);
    try {
      const res = await fetch('/api/group/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenario.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ورود ناموفق بود');

      setSession({
        id: data.session_id,
        scenario: scenarioById(data.session?.scenario_id ?? scenario.id) ?? scenario,
        me: data.me,
        participants: data.participants ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای نامشخص');
    } finally {
      setJoining(null);
    }
  }

  if (session) {
    return (
      <GroupChat
        sessionId={session.id}
        scenario={session.scenario}
        me={session.me}
        initialParticipants={session.participants}
        onLeave={() => setSession(null)}
      />
    );
  }

  const locked = allScenarioCount - scenarios.length;

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold">👥 گفت‌وگوی گروهی</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
          با زبان‌آموزان هم‌سطح خود تمرین کنید — سطح شما:
          <LevelBadge level={level} />
        </p>
      </div>

      <Card>
        <SectionTitle
          title="یک سناریو انتخاب کنید"
          subtitle="شما به اتاقی با زبان‌آموزان هم‌سطح وصل می‌شوید"
        />

        {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios.map((s) => {
            const waiting = openRooms[s.id] ?? 0;
            return (
              <button
                key={s.id}
                onClick={() => void join(s)}
                disabled={joining !== null}
                className="rounded-xl border-2 p-4 text-start transition-all hover:-translate-y-0.5 disabled:opacity-60"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-3xl">{s.icon}</span>
                  {waiting > 0 && (
                    <span className="badge bg-success-50 text-success-800">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--color-success-700)' }} />
                      اتاق باز
                    </span>
                  )}
                </div>

                <div className="mt-2 font-bold">{s.topic_fa}</div>
                <div className="flex items-center gap-1">
                  <span className="ltr text-xs" style={{ color: 'var(--muted)' }} dir="ltr">{s.topic}</span>
                  <Speak text={s.topic} size="xs" />
                </div>

                <p className="mt-2 text-xs leading-6" style={{ color: 'var(--muted)' }}>
                  {s.description_fa}
                </p>

                <div className="mt-3 flex items-center justify-between">
                  <span className="num badge bg-primary-50 text-primary-800">{s.minLevel}+</span>
                  {joining === s.id ? (
                    <Spinner size={15} />
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--color-primary-600)' }}>
                      پیوستن ←
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {locked > 0 && (
          <p className="mt-4 text-xs leading-6" style={{ color: 'var(--muted)' }}>
            🔒 {locked} سناریوی دیگر برای سطوح بالاتر قفل است. با ارتقای سطح باز می‌شوند.
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle title="💡 چطور کار می‌کند؟" />
        <ul className="space-y-2 text-sm leading-7" style={{ color: 'var(--muted)' }}>
          <li>• یک سناریو انتخاب کنید تا به اتاقی با زبان‌آموزان هم‌سطح وصل شوید.</li>
          <li>• اگر اتاق بازی نباشد، یک اتاق جدید ساخته می‌شود و منتظر هم‌گروهی می‌مانید.</li>
          <li>• «راهنمای گفت‌وگو» هوشمند هر چند پیام یک‌بار وارد می‌شود: سؤال می‌پرسد، اشتباهات را ملایم تصحیح می‌کند و اگر گفت‌وگو کند شد آن را دوباره راه می‌اندازد.</li>
          <li>• برای جلوگیری از اسپم، هر ۲ ثانیه یک پیام می‌توانید بفرستید.</li>
          <li>• هر پیام ۴ امتیاز تجربه (XP) دارد.</li>
        </ul>
      </Card>
    </div>
  );
}
