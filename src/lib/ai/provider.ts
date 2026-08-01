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
