// ============================================================
// زبان‌یار | AI Provider abstraction
// Works with OpenAI-compatible APIs. If no key is configured the
// app transparently falls back to the deterministic local engine,
// so every feature stays functional without an AI subscription.
// ============================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const AI_ENABLED = Boolean(process.env.OPENAI_API_KEY);

const BASE_URL =
  process.env.OPENAI_BASE_URL?.replace(/\/$/, '') || 'https://api.openai.com/v1';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// ---- Speech-to-text ----------------------------------------
// Falls back to the chat credentials so a single OPENAI_API_KEY is
// enough, but can be pointed at a dedicated STT provider.
const SPEECH_KEY = process.env.SPEECH_API_KEY || process.env.OPENAI_API_KEY;
const SPEECH_BASE_URL = (
  process.env.SPEECH_BASE_URL ||
  process.env.OPENAI_BASE_URL ||
  'https://api.openai.com/v1'
).replace(/\/$/, '');
const SPEECH_MODEL = process.env.SPEECH_MODEL || 'whisper-1';

/** True when a server-side speech-to-text provider is configured. */
export const SPEECH_ENABLED = Boolean(SPEECH_KEY);

export class AiUnavailableError extends Error {
  constructor(message = 'AI provider is not configured') {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

/** Plain text completion. */
export async function chat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  if (!AI_ENABLED) throw new AiUnavailableError();

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 1200,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`AI request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? '';
}

/** JSON-mode completion with a safe parse. */
export async function chatJson<T>(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<T> {
  if (!AI_ENABLED) throw new AiUnavailableError();

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens ?? 2000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`AI request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(raw) as T;
}

// ============================================================
// Speech-to-text
// ============================================================

export interface TranscriptionResult {
  text: string;
  /** Provider-reported language, when available. */
  language?: string;
  /** Provider-reported audio duration in seconds, when available. */
  duration?: number;
}

/**
 * Transcribe audio through an OpenAI-compatible `/audio/transcriptions`
 * endpoint (Whisper and most drop-in replacements implement this).
 *
 * Throws AiUnavailableError when no speech key is configured, and a
 * plain Error on transport/HTTP failure — callers are expected to
 * catch and fall back to the local engine, exactly like chatJson().
 */
export async function transcribeAudio(
  audio: Blob | Buffer | Uint8Array,
  opts: { filename?: string; mimeType?: string; language?: string; prompt?: string } = {}
): Promise<TranscriptionResult> {
  if (!SPEECH_ENABLED) throw new AiUnavailableError('Speech provider is not configured');

  const mime = opts.mimeType || 'audio/webm';
  const filename = opts.filename || `speech.${mime.split('/')[1]?.split(';')[0] || 'webm'}`;

  const blob =
    audio instanceof Blob
      ? audio
      : new Blob([audio as unknown as BlobPart], { type: mime });

  const form = new FormData();
  form.append('file', blob, filename);
  form.append('model', SPEECH_MODEL);
  // Bias the decoder towards English so Persian-accented speech is
  // transcribed as English words rather than transliterated.
  form.append('language', opts.language ?? 'en');
  form.append('response_format', 'json');
  if (opts.prompt) form.append('prompt', opts.prompt);

  const res = await fetch(`${SPEECH_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SPEECH_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Speech request failed (${res.status}): ${detail.slice(0, 300)}`
    );
  }

  const data = await res.json();
  const text = typeof data?.text === 'string' ? data.text.trim() : '';
  if (!text) throw new Error('Speech provider returned an empty transcript');

  return { text, language: data?.language, duration: data?.duration };
}
