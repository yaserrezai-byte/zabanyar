import { AI_ENABLED } from '@/lib/ai/provider';

export const dynamic = 'force-dynamic';

export async function GET() {
  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  let host: string | null = null;
  try {
    host = new URL(base).host;
  } catch {
    host = null;
  }

  return Response.json({
    ok: true,
    service: 'zabanyar',
    time: new Date().toISOString(),
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    ai: AI_ENABLED
      ? {
          mode: 'provider',
          host,
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        }
      : { mode: 'local-engine' },
  });
}
