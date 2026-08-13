import { getAuth, unauthorized, serverError } from '@/lib/auth';
import { buildLearnerContext, coachAdvice } from '@/lib/ai/service';
import { getActiveLanguage } from '@/lib/active-language';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

export async function GET() {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const { supabase, user } = auth;

  try {
    const language = await getActiveLanguage(supabase, user.id);
    const ctx = await buildLearnerContext(supabase, user.id, language);
    const advice = await coachAdvice(ctx);
    return Response.json(advice);
  } catch (e) {
    console.error('[coach]', e);
    return serverError();
  }
}
