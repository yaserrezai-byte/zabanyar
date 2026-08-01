import { AI_ENABLED } from '@/lib/ai/provider';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    ok: true,
    service: 'zabanyar',
    time: new Date().toISOString(),
    ai_provider: AI_ENABLED ? 'configured' : 'local-engine',
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  });
}
