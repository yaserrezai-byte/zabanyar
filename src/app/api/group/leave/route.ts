import { z } from 'zod';
import { getAuth, unauthorized, badRequest, serverError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const Body = z.object({ session_id: z.string().uuid() });

/**
 * Leave a room. Stamps left_at and, if the room is now empty, marks it
 * ended; if only one learner remains it drops back to `waiting` so
 * matchmaking can refill it.
 */
export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const { supabase } = auth;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return badRequest('شناسه جلسه نامعتبر است.');
  }

  try {
    const { error } = await supabase.rpc('leave_group_session', {
      p_session: body.session_id,
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[group/leave]', e);
    return serverError('خروج از جلسه ناموفق بود.');
  }
}
