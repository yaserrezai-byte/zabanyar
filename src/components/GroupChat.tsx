'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { Alert, Card, Spinner } from '@/components/ui';
import { MESSAGE_COOLDOWN_MS, moderate, type GroupScenario } from '@/lib/group-chat';

interface GroupMessage {
  id: string;
  sender_type: 'user' | 'ai' | 'system';
  sender_id: string | null;
  sender_name: string | null;
  content: string;
  translation_fa: string | null;
  corrections: { wrong: string; right: string; note_fa: string }[];
  created_at: string;
}

export interface Participant {
  user_id: string;
  name: string;
  level: string | null;
  is_me: boolean;
  message_count?: number;
}

/** Stable colour per participant so avatars stay recognisable. */
const AVATAR_COLOURS = ['#1d5cf5', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2'];
function colourFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}

export default function GroupChat({
  sessionId,
  scenario,
  me,
  initialParticipants,
  onLeave,
}: {
  sessionId: string;
  scenario: GroupScenario;
  me: string;
  initialParticipants: Participant[];
  onLeave: () => void;
}) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState<string[]>([]);
  const [cooldown, setCooldown] = useState(0);
  const [showTranslation, setShowTranslation] = useState<Record<string, boolean>>({});

  const endRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSentRef = useRef(0);
  const typingSentRef = useRef(0);

  const myName = participants.find((p) => p.is_me)?.name ?? 'شما';

  const refreshParticipants = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('group_participants')
      .select('user_id, message_count, profiles(full_name, display_name, current_level)')
      .eq('session_id', sessionId)
      .is('left_at', null);

    if (!data) return;
    setParticipants(
      data.map((p) => {
        const prof = p.profiles as unknown as
          { full_name: string | null; display_name: string | null; current_level: string | null } | null;
        return {
          user_id: p.user_id,
          name: prof?.display_name || prof?.full_name || 'زبان‌آموز',
          level: prof?.current_level ?? null,
          is_me: p.user_id === me,
          message_count: p.message_count,
        };
      })
    );
  }, [sessionId, me]);

  // ---------- load history + subscribe ----------
  useEffect(() => {
    const supabase = createClient();
    let alive = true;

    void (async () => {
      const { data } = await supabase
        .from('group_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (alive && data) setMessages(data as GroupMessage[]);
    })();

    const channel = supabase
      .channel(`group:${sessionId}`, { config: { presence: { key: me } } })
      // new messages (from anyone, including the AI guide)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as GroupMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          // someone spoke → they are no longer typing
          setTyping((t) => t.filter((n) => n !== (row.sender_name ?? '')));
        }
      )
      // people joining / leaving
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_participants', filter: `session_id=eq.${sessionId}` },
        () => void refreshParticipants()
      )
      // lightweight typing indicator (ephemeral, not persisted)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const name = payload?.name as string;
        if (!name || name === myName) return;
        setTyping((t) => (t.includes(name) ? t : [...t, name]));
        window.setTimeout(() => setTyping((t) => t.filter((n) => n !== name)), 3000);
      })
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'));

    channelRef.current = channel;

    // heartbeat so the idle sweeper does not evict an active learner
    const beat = window.setInterval(() => {
      void supabase
        .from('group_participants')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('session_id', sessionId)
        .eq('user_id', me);
    }, 60_000);

    return () => {
      alive = false;
      window.clearInterval(beat);
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [sessionId, me, myName, refreshParticipants]);


  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => setCooldown((c) => Math.max(0, c - 100)), 100);
    return () => window.clearInterval(t);
  }, [cooldown]);

  function announceTyping() {
    const now = Date.now();
    if (now - typingSentRef.current < 1500) return;
    typingSentRef.current = now;
    void channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { name: myName },
    });
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    // client-side mirror of the server rules (server remains the truth)
    const verdict = moderate(text);
    if (!verdict.allowed) {
      setError(verdict.reason_fa ?? 'پیام نامعتبر است.');
      return;
    }
    const since = Date.now() - lastSentRef.current;
    if (since < MESSAGE_COOLDOWN_MS) {
      setCooldown(MESSAGE_COOLDOWN_MS - since);
      return;
    }

    setSending(true);
    setError(null);
    setInput('');

    try {
      const res = await fetch('/api/group/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, text }),
      });
      const data = await res.json();

      if (res.status === 429) {
        setCooldown(data.retry_after_ms ?? MESSAGE_COOLDOWN_MS);
        setError(data.error);
        setInput(text);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'ارسال ناموفق بود');

      lastSentRef.current = Date.now();
      // The message itself arrives via Realtime, so nothing to append here.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای نامشخص');
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  async function leave() {
    try {
      await fetch('/api/group/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch {
      /* leaving is best-effort */
    }
    onLeave();
  }

  const waiting = participants.length < 2;

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr] fade-in">
      {/* ---------- participants ---------- */}
      <aside className="space-y-3">
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold">شرکت‌کنندگان</span>
            <span
              className="badge"
              style={{
                background: connected ? 'rgb(16 185 129 / .14)' : 'rgb(100 116 139 / .14)',
                color: connected ? '#047857' : 'var(--muted)',
              }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: connected ? '#10b981' : '#94a3b8' }}
              />
              {connected ? 'متصل' : 'در حال اتصال'}
            </span>
          </div>

          <div className="space-y-2">
            {participants.map((p) => (
              <div key={p.user_id} className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: colourFor(p.user_id) }}
                >
                  {p.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    {p.name}
                    {p.is_me && <span className="mr-1 text-xs" style={{ color: 'var(--muted)' }}> (شما)</span>}
                  </div>
                  {p.level && (
                    <div className="num text-[10px]" style={{ color: 'var(--muted)' }}>{p.level}</div>
                  )}
                </div>
                {typeof p.message_count === 'number' && p.message_count > 0 && (
                  <span className="num text-[10px]" style={{ color: 'var(--muted)' }}>{p.message_count}</span>
                )}
              </div>
            ))}
          </div>

          <button onClick={leave} className="btn btn-ghost mt-4 w-full py-1.5 text-xs">
            🚪 خروج از گفت‌وگو
          </button>
        </Card>

        <Card className="p-4">
          <div className="mb-1.5 text-sm font-bold">{scenario.icon} {scenario.topic_fa}</div>
          <p className="text-xs leading-6" style={{ color: 'var(--muted)' }}>
            {scenario.description_fa}
          </p>
          <div className="mt-2 text-[11px]" style={{ color: 'var(--muted)' }}>
            نقش‌های پیشنهادی: {scenario.roles_fa.join('، ')}
          </div>
        </Card>
      </aside>

      {/* ---------- chat ---------- */}
      <Card className="flex h-[calc(100vh-11rem)] flex-col p-0">
        <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
          <h1 className="font-bold">{scenario.icon} گفت‌وگوی گروهی — {scenario.topic_fa}</h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
            به انگلیسی بنویسید. راهنما هر چند پیام یک‌بار کمک می‌کند.
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {waiting && (
            <Alert kind="info">
              در انتظار هم‌گروهی… به‌محض پیوستن نفر دوم، گفت‌وگو شروع می‌شود.
              می‌توانید همین حالا هم بنویسید.
            </Alert>
          )}

          {messages.length === 0 && !waiting && (
            <div className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>
              هنوز پیامی نیست — اولین نفر باشید!
            </div>
          )}

          {messages.map((m) => {
            const mine = m.sender_id === me;
            const isAi = m.sender_type === 'ai';

            if (m.sender_type === 'system') {
              return (
                <div key={m.id} className="text-center text-xs" style={{ color: 'var(--muted)' }}>
                  {m.content}
                </div>
              );
            }

            return (
              <div key={m.id} className={mine ? 'flex justify-start' : 'flex justify-end'}>
                <div className="flex max-w-[85%] items-start gap-2">
                  {!mine && (
                    <div
                      className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: isAi ? '#7c3aed' : colourFor(m.sender_id ?? 'x') }}
                      aria-hidden
                    >
                      {isAi ? '🧭' : (m.sender_name ?? '؟').charAt(0)}
                    </div>
                  )}

                  <div className="min-w-0">
                    {!mine && (
                      <div className="mb-0.5 text-[11px]" style={{ color: 'var(--muted)' }}>
                        {isAi ? 'راهنمای گفت‌وگو' : m.sender_name}
                      </div>
                    )}

                    <div
                      className="rounded-2xl px-3.5 py-2"
                      style={
                        mine
                          ? { background: 'var(--color-brand-600)', color: '#fff' }
                          : isAi
                            ? { background: 'rgb(124 58 237 / .10)', border: '1px solid rgb(124 58 237 / .3)' }
                            : { background: 'var(--bg)', border: '1px solid var(--border)' }
                      }
                    >
                      <p className="ltr leading-7" dir="ltr">{m.content}</p>

                      {m.translation_fa && (
                        <>
                          <button
                            onClick={() =>
                              setShowTranslation((s) => ({ ...s, [m.id]: !s[m.id] }))
                            }
                            className="mt-1 text-[11px] underline opacity-70"
                          >
                            {showTranslation[m.id] ? 'پنهان کردن ترجمه' : 'ترجمه'}
                          </button>
                          {showTranslation[m.id] && (
                            <p className="mt-1 border-t pt-1 text-xs leading-6 opacity-90"
                               style={{ borderColor: 'var(--border)' }}>
                              {m.translation_fa}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {m.corrections?.length > 0 && (
                      <div className="mt-1.5 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs">
                        {m.corrections.map((c, i) => (
                          <div key={i} className="text-amber-900">
                            <span className="ltr line-through opacity-60" dir="ltr">{c.wrong}</span>
                            {' → '}
                            <span className="ltr font-bold" dir="ltr">{c.right}</span>
                            <div className="mt-0.5 leading-6">{c.note_fa}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {typing.length > 0 && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '.15s' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: '.3s' }} />
              </span>
              {typing.join('، ')} در حال نوشتن…
            </div>
          )}

          <div ref={endRef} />
        </div>

        {error && (
          <div className="px-3 pb-2">
            <Alert kind="error">{error}</Alert>
          </div>
        )}

        <form onSubmit={send} className="flex gap-2 border-t p-3" style={{ borderColor: 'var(--border)' }}>
          <input
            className="input ltr flex-1"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              announceTyping();
            }}
            placeholder="Type in English…"
            dir="ltr"
            maxLength={500}
            disabled={sending}
          />
          <button
            type="submit"
            className="btn btn-primary px-5"
            disabled={sending || !input.trim() || cooldown > 0}
          >
            {sending ? <Spinner size={15} /> : cooldown > 0 ? `${(cooldown / 1000).toFixed(1)}s` : 'ارسال'}
          </button>
        </form>
      </Card>
    </div>
  );
}
