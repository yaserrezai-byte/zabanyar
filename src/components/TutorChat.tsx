'use client';

import { useEffect, useRef, useState } from 'react';
import { LANGUAGES, toLanguage, type LearningLanguage } from '@/lib/languages';
import { createClient } from '@/lib/supabase/client';
import { Card, ErrorState, SkeletonChat } from '@/components/ui';
import type { Correction } from '@/types/db';
import { announceBadges } from '@/lib/badge-events';
import Speak from '@/components/Speak';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  translation_fa?: string | null;
  corrections?: Correction[];
}

interface Conv {
  id: string;
  title: string;
  scenario: string | null;
  message_count: number;
  updated_at: string;
}

const SCENARIOS = [
  { key: '', label: '💬 گفت‌وگوی آزاد' },
  { key: 'You are a barista at a coffee shop. The learner is ordering.', label: '☕ کافی‌شاپ' },
  { key: 'You are a hotel receptionist. The learner is checking in.', label: '🏨 هتل' },
  { key: 'You are a job interviewer. Ask the learner interview questions.', label: '💼 مصاحبه شغلی' },
  { key: 'You are a doctor. The learner describes their symptoms.', label: '🏥 مطب دکتر' },
  { key: 'You are an airport check-in agent.', label: '✈️ فرودگاه' },
];

export default function TutorChat({
  conversations,
  language = 'en',
}: {
  conversations: Conv[];
  language?: LearningLanguage;
}) {
  const langCfg = LANGUAGES[toLanguage(language)];
  const [convId, setConvId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [scenario, setScenario] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showTranslation, setShowTranslation] = useState<Record<string, boolean>>({});
  const [sendError, setSendError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function openConversation(id: string) {
    setLoadingHistory(true);
    setHistoryError(null);
    setConvId(id);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('messages')
      .select('id, role, content, translation_fa, corrections')
      .eq('conversation_id', id)
      .order('created_at');
    if (error) {
      setHistoryError('پیام‌های این گفت‌وگو خوانده نشد. اتصال اینترنت را بررسی کن و دوباره تلاش کن.');
      setMessages([]);
    } else {
      setMessages((data ?? []) as Msg[]);
    }
    setLoadingHistory(false);
  }

  function newChat() {
    setConvId(undefined);
    setMessages([]);
    setSendError(null);
    setHistoryError(null);
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setSendError(null);
    setLastSent(text);
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await fetch('/api/tutor/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: convId, text, scenario: scenario || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setConvId(data.conversation_id);
      announceBadges(data.new_badges);
      setMessages((m) => [
        ...m,
        {
          id: data.message_id ?? `a-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          translation_fa: data.translation_fa,
          corrections: data.corrections ?? [],
        },
      ]);
    } catch (err) {
      // Surface the failure as a system error, not as words from the tutor.
      setSendError('پیام ارسال نشد. اتصال اینترنت را بررسی کن و دوباره تلاش کن.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function retrySend() {
    if (!lastSent) return;
    // drop the un-answered user bubble, then resend the same text
    setMessages((m) => {
      const last = m[m.length - 1];
      return last?.role === 'user' && last.content === lastSent ? m.slice(0, -1) : m;
    });
    setInput(lastSent);
    setSendError(null);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr] fade-in">
      {/* sidebar */}
      <aside className="space-y-3">
        <button onClick={newChat} className="btn btn-primary w-full">
          ＋ گفت‌وگوی جدید
        </button>

        <Card className="p-3">
          <div className="mb-2 text-xs font-bold" style={{ color: 'var(--muted)' }}>
            سناریوی نقش‌آفرینی
          </div>
          <div className="space-y-1">
            {SCENARIOS.map((s) => (
              <button
                key={s.label}
                onClick={() => setScenario(s.key)}
                className="w-full rounded-lg px-2.5 py-1.5 text-start text-sm transition-colors"
                style={
                  scenario === s.key
                    ? { background: 'var(--color-primary-50)', color: 'var(--color-primary-800)', fontWeight: 500 }
                    : {}
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        </Card>

        {conversations.length > 0 && (
          <Card className="p-3">
            <div className="mb-2 text-xs font-bold" style={{ color: 'var(--muted)' }}>
              گفت‌وگوهای اخیر
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className="w-full truncate rounded-lg px-2.5 py-1.5 text-start text-sm transition-colors hover:bg-primary-50"
                  style={convId === c.id ? { background: 'var(--color-primary-50)', fontWeight: 500 } : {}}
                >
                  {c.title}
                </button>
              ))}
            </div>
          </Card>
        )}
      </aside>

      {/* chat */}
      <Card className="flex h-[calc(100vh-9rem)] flex-col p-0">
        <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}>
          <h1 className="font-bold">💬 مربی هوشمند {langCfg.nameFa}</h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
            به {langCfg.nameFa} بنویسید — اشتباهاتتان با توضیح فارسی تصحیح می‌شود.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {loadingHistory && <SkeletonChat bubbles={4} />}

          {historyError && (
            <ErrorState
              title="گفت‌وگو باز نشد"
              description={historyError}
              onRetry={() => convId && openConversation(convId)}
            />
          )}

          {!messages.length && !loadingHistory && !historyError && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="text-4xl">👋</div>
              <p className="mt-3 font-medium">سلام! بیایید {langCfg.nameFa} صحبت کنیم.</p>
              <p className="mt-1 max-w-sm text-sm" style={{ color: 'var(--muted)' }}>
                هر جمله‌ای که بنویسید بررسی می‌شود و اشتباهاتش با توضیح فارسی برایتان
                شرح داده می‌شود.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {(language === 'es'
                  ? ['¡Hola! ¿Cómo estás?', 'Quiero practicar español.', 'Ayer yo voy al parque.']
                  : ['Hello! How are you?', 'I want to practice English.', 'Yesterday I go to park.']
                ).map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="ltr rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-primary-50"
                    style={{ borderColor: 'var(--border)' }}
                    dir="ltr"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-start' : 'flex justify-end'}>
              <div className="max-w-[85%]">
                <div
                  className="mb-1 text-[.7rem]"
                  style={{ color: 'var(--muted)' }}
                >
                  {m.role === 'user' ? 'شما' : '🧠 مربی'}
                </div>
                <div
                  className="px-4 py-2.5"
                  style={
                    m.role === 'user'
                      ? {
                          background: 'var(--color-primary-700)',
                          color: '#fff',
                          borderRadius: '18px 18px 18px 4px',
                        }
                      : {
                          background: 'var(--card)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: '18px 18px 4px 18px',
                        }
                  }
                >
                  <div className="flex items-start gap-1.5">
                    <p className="ltr leading-7" dir="ltr">{m.content}</p>
                    <Speak text={m.content} language={language} />
                  </div>

                  {m.translation_fa && (
                    <>
                      <button
                        onClick={() => setShowTranslation((s) => ({ ...s, [m.id]: !s[m.id] }))}
                        className="mt-1.5 text-xs underline opacity-70"
                      >
                        {showTranslation[m.id] ? 'پنهان کردن ترجمه' : 'نمایش ترجمه'}
                      </button>
                      {showTranslation[m.id] && (
                        <p className="mt-1.5 border-t pt-1.5 text-sm leading-7 opacity-90" style={{ borderColor: 'var(--border)' }}>
                          {m.translation_fa}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {m.corrections && m.corrections.length > 0 && (
                  <div className="mt-2 space-y-1.5 rounded-xl border border-accent-100 bg-accent-50 p-3 text-sm">
                    <div className="font-bold text-accent-800">✏️ تصحیح‌ها</div>
                    {m.corrections.map((c, i) => (
                      <div key={i} className="text-accent-800">
                        <span className="ltr inline-block line-through opacity-60" dir="ltr">{c.wrong}</span>
                        {' → '}
                        <span className="ltr inline-block font-bold" dir="ltr">{c.right}</span>
                        <Speak text={c.right} size="xs" language={language} />
                        <div className="mt-0.5 text-xs leading-6">{c.note_fa}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-end" role="status" aria-label="مربی در حال نوشتن است">
              <div className="max-w-[85%]">
                <div className="mb-1 text-[.7rem]" style={{ color: 'var(--muted)' }}>
                  🧠 مربی
                </div>
                <div
                  className="flex items-center gap-1.5 px-4 py-3.5"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '18px 18px 4px 18px',
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="typing-dot h-2 w-2 rounded-full"
                      style={{
                        background: 'var(--muted)',
                        animationDelay: `${i * 0.16}s`,
                      }}
                    />
                  ))}
                  <span className="sr-only">در حال نوشتن…</span>
                </div>
              </div>
            </div>
          )}

          {sendError && (
            <ErrorState compact title="ارسال نشد" description={sendError} onRetry={retrySend} />
          )}

          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="flex gap-2 border-t p-3" style={{ borderColor: 'var(--border)' }}>
          <input
            className="input ltr flex-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={language === 'es' ? 'Escribe en español…' : 'Type in English…'}
            dir="ltr"
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary px-5" disabled={loading || !input.trim()}>
            ارسال
          </button>
        </form>
      </Card>
    </div>
  );
}
