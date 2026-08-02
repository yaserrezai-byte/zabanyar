import { z } from 'zod';
import { getAuth, unauthorized, badRequest, serverError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const Body = z.object({
  show_on_leaderboard: z.boolean(),
  display_name: z.string().trim().max(40).nullable().optional(),
});

/** Learner-controlled opt-in for the public leaderboard. */
export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const { supabase, user } = auth;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return badRequest('داده ارسالی نامعتبر است.');
  }

  // Reject anything that looks like an email, so opting in can never
  // leak a contact address into a public list.
  const name = body.display_name?.trim() || null;
  if (name && /@|\s{3,}/.test(name)) {
    return badRequest('نام نمایشی نباید شامل ایمیل باشد.');
  }

  try {
    const patch: Record<string, unknown> = {
      show_on_leaderboard: body.show_on_leaderboard,
    };
    if (body.display_name !== undefined) patch.display_name = name;

    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', user.id)
      .select('show_on_leaderboard, display_name')
      .single();

    if (error) throw error;
    return Response.json({ ok: true, ...data });
  } catch (e) {
    console.error('[leaderboard-optin]', e);
    return serverError('ذخیره تنظیمات ناموفق بود.');
  }
}
