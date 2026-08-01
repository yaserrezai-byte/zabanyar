import { getAuth, unauthorized, serverError } from '@/lib/auth';
import { buildLearnerContext, coachAdvice } from '@/lib/ai/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

export async function GET() {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const { supabase, user } = auth;

  try {
    const ctx = await buildLearnerContext(supabase, user.id);
    const advice = await coachAdvice(ctx);
    return Response.json(advice);
  } catch (e) {
    console.error('[coach]', e);
    return serverError();
  }
}
