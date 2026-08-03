'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Card, Progress, Spinner } from '@/components/ui';
import type { CefrLevel } from '@/types/db';
import type { TargetSentence } from '@/lib/ai/pronunciation-engine';
import { announceBadges } from '@/lib/badge-events';
import Speak from '@/components/Speak';

// ------------------------------------------------------------
// Minimal typings for the Web Speech API (not in lib.dom yet)
// ------------------------------------------------------------
interface SpeechRecognitionAlternativeLike { transcript: string }
interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  [i: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [i: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ------------------------------------------------------------
// Result shape returned by /api/pronunciation/attempt
// ------------------------------------------------------------
interface WordScore {
  target: string;
  heard: string | null;
  score: number;
  status: 'correct' | 'close' | 'wrong' | 'missing' | 'extra';
  hint_fa?: string;
}

interface AttemptResult {
  attempt_id?: string;
  transcript: string;
  accuracy_score: number;
  words: WordScore[];
  feedback_fa: string;
  strengths_fa: string[];
  improvements_fa: string[];
  problem_words: string[];
  confident: boolean;
  source: 'service' | 'browser' | 'heuristic';
  used_fallback: boolean;
}

const STATUS_STYLE: Record<WordScore['status'], { bg: string; fg: string; label: string }> = {
  correct: { bg: 'rgb(16 185 129 / .14)', fg: '#047857', label: 'درست' },
  close: { bg: 'rgb(245 158 11 / .16)', fg: '#b45309', label: 'نزدیک' },
  wrong: { bg: 'rgb(244 63 94 / .14)', fg: '#be123c', label: 'نادرست' },
  missing: { bg: 'rgb(100 116 139 / .14)', fg: '#475569', label: 'گفته نشد' },
  extra: { bg: 'rgb(139 92 246 / .14)', fg: '#6d28d9', label: 'اضافه' },
};

export default function PronunciationPractice({
  sentence,
  level,
  onScored,
}: {
  sentence: TargetSentence;
  level: CefrLevel | null;
  onScored?: (score: number) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  // Lazy initialiser: evaluated once on the client, no effect needed.
  const [sttSupported] = useState(() => Boolean(getRecognitionCtor()));

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef('');
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Reset when the learner picks another sentence. React's documented
  // "adjusting state on prop change" pattern — cheaper and flicker-free
  // compared with doing it in an effect after paint.
  const [lastSentenceId, setLastSentenceId] = useState(sentence.id);
  if (lastSentenceId !== sentence.id) {
    setLastSentenceId(sentence.id);
    setResult(null);
    setError(null);
    setElapsed(0);
    setAudioUrl(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    recognitionRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [cleanup]);

  function pickMime(): string {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];
    for (const c of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
    }
    return '';
  }

  async function startRecording() {
    setError(null);
    setResult(null);
    transcriptRef.current = '';

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('مرورگر شما از ضبط صدا پشتیبانی نمی‌کند. لطفاً از کروم یا فایرفاکس جدید استفاده کنید.');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setError(
        name === 'NotAllowedError'
          ? 'دسترسی به میکروفون داده نشد. از نوار آدرس مرورگر اجازه دسترسی را فعال کنید.'
          : name === 'NotFoundError'
            ? 'میکروفونی پیدا نشد. اتصال میکروفون را بررسی کنید.'
            : 'دسترسی به میکروفون ممکن نشد.'
      );
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorderRef.current = rec;

    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => { void handleStop(rec.mimeType || mime || 'audio/webm'); };
    rec.start();

    // Free, on-device transcription — gives real scoring with no API key.
    const Ctor = getRecognitionCtor();
    if (Ctor) {
      try {
        const recog = new Ctor();
        recog.lang = 'en-US';
        recog.continuous = true;
        recog.interimResults = true;
        recog.maxAlternatives = 1;
        recog.onresult = (e) => {
          let finalText = '';
          for (let i = 0; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finalText += r[0].transcript + ' ';
          }
          if (finalText.trim()) transcriptRef.current = finalText.trim();
        };
        recog.onerror = () => { /* silent: server or heuristic path covers us */ };
        recognitionRef.current = recog;
        recog.start();
      } catch { /* recognition is best-effort */ }
    }

    startedAtRef.current = Date.now();
    setElapsed(0);
    setRecording(true);
    timerRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsed(ms);
      if (ms > 30_000) stopRecording(); // safety cap
    }, 100);
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  async function handleStop(mimeType: string) {
    const durationMs = Date.now() - startedAtRef.current;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const blob = new Blob(chunksRef.current, { type: mimeType.split(';')[0] });

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    setAudioUrl(url);

    if (blob.size === 0) {
      setError('صدایی ضبط نشد. دوباره تلاش کنید.');
      return;
    }

    setAnalysing(true);
    // Give the recogniser a beat to flush its final result.
    await new Promise((r) => setTimeout(r, 350));

    try {
      const form = new FormData();
      form.append('audio', blob, `attempt.${mimeType.split('/')[1]?.split(';')[0] || 'webm'}`);
      form.append('target_text', sentence.text);
      form.append('duration_ms', String(durationMs));
      if (level) form.append('level', level);
      if (transcriptRef.current) form.append('browser_transcript', transcriptRef.current);

      const res = await fetch('/api/pronunciation/attempt', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'خطا در تحلیل تلفظ');

      setResult(data as AttemptResult);
      announceBadges(data.new_badges);
      onScored?.(data.accuracy_score);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای نامشخص در تحلیل تلفظ');
    } finally {
      setAnalysing(false);
    }
  }

  function speakTarget() {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setError('مرورگر شما از پخش گفتار پشتیبانی نمی‌کند.');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(sentence.text);
    u.lang = 'en-US';
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  }

  const seconds = (elapsed / 1000).toFixed(1);
  const scoreColor = (s: number) => (s >= 80 ? 'var(--color-success-700)' : s >= 55 ? 'var(--color-warning-700)' : 'var(--color-error-600)');

  return (
    <Card className="fade-in">
      {/* ---------- target sentence ---------- */}
      <div className="mb-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="badge bg-primary-50 text-primary-800">🗣️ تمرین تلفظ</span>
          <span className="badge bg-primary-50 text-primary-800">{sentence.focus_fa}</span>
        </div>

        <div className="flex items-start gap-2">
          <p className="ltr text-xl font-bold leading-9" dir="ltr">{sentence.text}</p>
          <Speak text={sentence.text} size="md" />
        </div>
        <p className="mt-1.5 text-sm leading-7" style={{ color: 'var(--muted)' }}>
          {sentence.translation_fa}
        </p>

        <button onClick={speakTarget} className="btn btn-ghost mt-3 py-1.5 text-sm">
          🔊 شنیدن تلفظ درست
        </button>
      </div>

      {/* ---------- recorder ---------- */}
      <div
        className="rounded-2xl border p-5 text-center"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
      >
        {!recording ? (
          <button
            onClick={startRecording}
            disabled={analysing}
            className="btn btn-primary px-8 py-3 text-base"
          >
            🎤 شروع ضبط
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full"
                style={{ background: 'var(--color-error-600)' }} />
              <span className="num font-medium">{seconds} ثانیه</span>
            </div>
            <div className="flex justify-center gap-1" aria-hidden>
              {Array.from({ length: 9 }).map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 rounded-full"
                  style={{
                    background: 'var(--color-error-600)',
                    height: 10 + ((elapsed / 90 + i * 7) % 26),
                    transition: 'height .12s linear',
                  }}
                />
              ))}
            </div>
            <button onClick={stopRecording} className="btn btn-accent px-8 py-3">
              ⏹ پایان و تحلیل
            </button>
          </div>
        )}

        {analysing && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <Spinner size={16} /> در حال تحلیل تلفظ…
          </div>
        )}

        {audioUrl && !recording && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs" style={{ color: 'var(--muted)' }}>صدای ضبط‌شده شما:</p>
            <audio controls src={audioUrl} className="mx-auto w-full max-w-sm" />
          </div>
        )}
      </div>

      {!sttSupported && !result && (
        <div className="mt-4">
          <Alert kind="warning">
            مرورگر شما از تبدیل گفتار به متن پشتیبانی نمی‌کند. برای دریافت امتیاز دقیق،
            از <b>گوگل کروم</b> استفاده کنید یا کلید سرویس گفتار روی سرور تنظیم شود.
          </Alert>
        </div>
      )}

      {error && <div className="mt-4"><Alert kind="error">{error}</Alert></div>}

      {/* ---------- result ---------- */}
      {result && (
        <div className="mt-5 fade-in">
          <div className="mb-4 flex items-center gap-4">
            <div
              className="num flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ background: scoreColor(result.accuracy_score) }}
            >
              {Math.round(result.accuracy_score)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="leading-8">{result.feedback_fa}</p>
              <div className="mt-2">
                <Progress value={result.accuracy_score} color={scoreColor(result.accuracy_score)} />
              </div>
            </div>
          </div>

          {result.transcript && (
            <div className="mb-4 rounded-xl p-3" style={{ background: 'var(--bg)' }}>
              <div className="mb-1 text-sm font-bold">🎧 آنچه شنیده شد</div>
              <div className="flex items-start gap-1.5">
                <p className="ltr leading-8" dir="ltr">{result.transcript}</p>
                <Speak text={result.transcript} />
              </div>
            </div>
          )}

          {result.words.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-sm font-bold">📊 بررسی کلمه‌به‌کلمه</div>
              <div className="ltr flex flex-wrap gap-1.5" dir="ltr">
                {result.words.map((w, i) => {
                  const st = STATUS_STYLE[w.status];
                  return (
                    <span
                      key={i}
                      title={`${st.label}${w.hint_fa ? ' — ' + w.hint_fa : ''}`}
                      className="rounded-lg px-2 py-1 text-sm font-medium"
                      style={{ background: st.bg, color: st.fg }}
                    >
                      {w.status === 'extra' ? `+${w.heard}` : w.target}
                      {w.status === 'missing' && ' ∅'}
                    </span>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs" style={{ color: 'var(--muted)' }}>
                {(['correct', 'close', 'wrong', 'missing'] as const).map((s) => (
                  <span key={s} className="flex items-center gap-1">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ background: STATUS_STYLE[s].bg, border: `1px solid ${STATUS_STYLE[s].fg}` }}
                    />
                    {STATUS_STYLE[s].label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {result.strengths_fa?.length > 0 && (
              <div className="rounded-xl border border-success-100 bg-success-50 p-3">
                <div className="mb-1.5 text-sm font-bold text-success-800">💪 نقاط قوت</div>
                <ul className="space-y-1 text-sm leading-7 text-success-800">
                  {result.strengths_fa.map((s, i) => <li key={i}>• {s}</li>)}
                </ul>
              </div>
            )}
            {result.improvements_fa?.length > 0 && (
              <div className="rounded-xl border border-info-100 bg-info-50 p-3">
                <div className="mb-1.5 text-sm font-bold text-info-800">📈 برای بهبود</div>
                <ul className="space-y-1 text-sm leading-7 text-info-800">
                  {result.improvements_fa.map((s, i) => <li key={i}>• {s}</li>)}
                </ul>
              </div>
            )}
          </div>

          {!result.confident && (
            <div className="mt-3">
              <Alert kind="info">
                امتیاز دقیق محاسبه نشد چون متنی از گفتار شما استخراج نشد. صدای شما ذخیره شد،
                اما برای نمره‌دهی واقعی از کروم استفاده کنید یا کلید سرویس گفتار تنظیم شود.
              </Alert>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={startRecording} className="btn btn-primary">🔁 تلاش دوباره</button>
            <button onClick={speakTarget} className="btn btn-ghost">🔊 شنیدن دوباره</button>
          </div>

          <p className="mt-3 text-[11px]" style={{ color: 'var(--muted)' }}>
            روش تحلیل:{' '}
            {result.source === 'service'
              ? 'سرویس تبدیل گفتار به متن'
              : result.source === 'browser'
                ? 'تشخیص گفتار داخل مرورگر (بدون ارسال به سرویس بیرونی)'
                : 'تخمین بر پایه مدت ضبط'}
          </p>
        </div>
      )}
    </Card>
  );
}
