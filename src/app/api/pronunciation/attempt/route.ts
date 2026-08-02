import { z } from 'zod';
import { getAuth, unauthorized, badRequest, serverError } from '@/lib/auth';
import { transcribeAndScore } from '@/lib/ai/service';
import type { CefrLevel } from '@/types/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

/** Hard ceiling matching the `speech` bucket's file_size_limit (10 MB). */
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = [
  'audio/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
];

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

const JsonBody = z.object({
  target_text: z.string().min(1).max(600),
  audio_base64: z.string().max(15_000_000).optional(),
  mime_type: z.string().max(80).optional(),
  browser_transcript: z.string().max(2000).optional(),
  duration_ms: z.coerce.number().int().min(0).max(600_000).optional(),
  level: z.enum(LEVELS).optional(),
  save_audio: z.coerce.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const { supabase, user } = auth;

  // ------------------------------------------------------------
  // Accept both multipart/form-data and JSON+base64
  // ------------------------------------------------------------
  let targetText = '';
  let browserTranscript: string | undefined;
  let durationMs: number | undefined;
  let level: CefrLevel | undefined;
  let saveAudio = true;
  let audioBuf: Buffer | null = null;
  let mimeType = 'audio/webm';

  const contentType = req.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();

      targetText = String(form.get('target_text') ?? '').trim();
      browserTranscript = form.get('browser_transcript')
        ? String(form.get('browser_transcript'))
        : undefined;
      const d = form.get('duration_ms');
      if (d != null && d !== '') durationMs = Number(d);
      const lv = form.get('level');
      if (lv && (LEVELS as readonly string[]).includes(String(lv))) {
        level = String(lv) as CefrLevel;
      }
      const sa = form.get('save_audio');
      if (sa != null) saveAudio = String(sa) !== 'false';

      const file = form.get('audio');
      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        const blob = file as Blob;
        if (blob.size > MAX_AUDIO_BYTES) {
          return badRequest('حجم فایل صوتی بیش از حد مجاز است (حداکثر ۱۰ مگابایت).');
        }
        if (blob.size > 0) {
          audioBuf = Buffer.from(await blob.arrayBuffer());
          mimeType = normaliseMime(blob.type || mimeType);
        }
      }
    } else {
      const parsed = JsonBody.safeParse(await req.json());
      if (!parsed.success) return badRequest('داده ارسالی نامعتبر است.');
      const b = parsed.data;

      targetText = b.target_text.trim();
      browserTranscript = b.browser_transcript;
      durationMs = b.duration_ms;
      level = b.level;
      saveAudio = b.save_audio ?? true;

      if (b.audio_base64) {
        const raw = b.audio_base64.replace(/^data:[^;]+;base64,/, '');
        const buf = Buffer.from(raw, 'base64');
        if (buf.byteLength > MAX_AUDIO_BYTES) {
          return badRequest('حجم فایل صوتی بیش از حد مجاز است (حداکثر ۱۰ مگابایت).');
        }
        if (buf.byteLength > 0) {
          audioBuf = buf;
          mimeType = normaliseMime(b.mime_type || mimeType);
        }
      }
    }
  } catch {
    return badRequest('خواندن داده ارسالی ناموفق بود.');
  }

  if (!targetText) return badRequest('جمله هدف را ارسال کنید.');
  if (!ALLOWED_MIME.includes(mimeType)) {
    return badRequest('قالب فایل صوتی پشتیبانی نمی‌شود.');
  }

  try {
    // ---------- transcribe + score (never throws) ----------
    const result = await transcribeAndScore(
      targetText,
      audioBuf ? { data: audioBuf, mimeType } : null,
      { browserTranscript, durationMs }
    );

    // ---------- persist audio in the private `speech` bucket ----------
    // Path MUST start with the owner's id: both the storage policies and
    // the 0004 guard trigger enforce that.
    let audioPath: string | null = null;
    if (audioBuf && saveAudio) {
      const ext = mimeType.split('/')[1]?.split(';')[0] || 'webm';
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('speech')
        .upload(path, audioBuf, { contentType: mimeType, upsert: false });

      if (upErr) {
        // Non-fatal: the learner still gets their score.
        console.error('[pronunciation] audio upload failed:', upErr.message);
      } else {
        audioPath = path;
      }
    }

    // ---------- record the attempt ----------
    const { data: attempt, error: insErr } = await supabase
      .from('pronunciation_attempts')
      .insert({
        user_id: user.id,
        target_text: targetText,
        transcript: result.transcript || null,
        accuracy_score: result.accuracy_score,
        phoneme_feedback: {
          words: result.words,
          strengths_fa: result.strengths_fa,
          improvements_fa: result.improvements_fa,
          problem_words: result.problem_words,
          feedback_fa: result.feedback_fa,
          coverage: result.coverage,
          confident: result.confident,
        },
        audio_path: audioPath,
        level: level ?? null,
        duration_ms: durationMs ?? null,
        source: result.source,
        used_fallback: result.used_fallback,
      })
      .select('id')
      .single();

    if (insErr) throw insErr;

    // ---------- learning history (only when the score is meaningful) ----------
    if (result.confident) {
      await supabase.from('learning_history').insert({
        user_id: user.id,
        event_type: 'pronunciation_attempt',
        skill: 'speaking',
        duration_sec: Math.round((durationMs ?? 0) / 1000) || 15,
        xp: Math.max(1, Math.round(result.accuracy_score / 10)),
        accuracy: result.accuracy_score,
        meta: {
          source: result.source,
          problem_words: result.problem_words.slice(0, 8),
        },
      });
    }

    return Response.json({
      attempt_id: attempt?.id,
      target_text: targetText,
      transcript: result.transcript,
      accuracy_score: result.accuracy_score,
      words: result.words,
      feedback_fa: result.feedback_fa,
      strengths_fa: result.strengths_fa,
      improvements_fa: result.improvements_fa,
      problem_words: result.problem_words,
      coverage: result.coverage,
      confident: result.confident,
      source: result.source,
      used_fallback: result.used_fallback,
      audio_saved: Boolean(audioPath),
    });
  } catch (e) {
    console.error('[pronunciation/attempt]', e);
    return serverError('ثبت تمرین تلفظ ناموفق بود.');
  }
}

function normaliseMime(m: string): string {
  return m.split(';')[0].trim().toLowerCase();
}
