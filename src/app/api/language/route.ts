import { z } from 'zod';
import { getAuth, unauthorized, badRequest, serverError } from '@/lib/auth';
import { ensureLanguageTrack, listLanguageTracks } from '@/lib/active-language';
import { isLanguage, LANGUAGES, toLanguage } from '@/lib/languages';

export const dynamic = 'force-dynamic';

const Body = z.object({
  language: z.enum(['en', 'es']),
});

/** Which languages the learner has started, and which is active. */
export async function GET() {
  const ctx = await getAuth();
  if (!ctx) return unauthorized();
  const { supabase, user } = ctx;

  try {
    const [{ data: profile }, tracks] = await Promise.all([
      supabase.from('profiles').select('active_language').eq('id', user.id).maybeSingle(),
      listLanguageTracks(supabase, user.id),
    ]);

    return Response.json({
      active: toLanguage(profile?.active_language),
      tracks,
      available: Object.values(LANGUAGES).map((l) => ({
        code: l.code,
        name_fa: l.nameFa,
        name_native: l.nameNative,
        flag: l.flag,
        tagline_fa: l.taglineFa,
      })),
    });
  } catch (e) {
    console.error('[language/GET]', e);
    return serverError();
  }
}

/**
 * Switch the active language. Creates the track on first use so the
 * learner lands on a working (if empty) dashboard rather than an error.
 */
export async function POST(req: Request) {
  const ctx = await getAuth();
  if (!ctx) return unauthorized();
  const { supabase, user } = ctx;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return badRequest('زبان انتخاب‌شده معتبر نیست.');
  }
  if (!isLanguage(body.language)) return badRequest('زبان انتخاب‌شده پشتیبانی نمی‌شود.');

  try {
    const track = await ensureLanguageTrack(supabase, user.id, body.language);

    const { error } = await supabase
      .from('profiles')
      .update({ active_language: body.language })
      .eq('id', user.id);
    if (error) throw error;

    return Response.json({
      ok: true,
      active: body.language,
      track,
      placement_done: track.placement_done,
    });
  } catch (e) {
    console.error('[language/POST]', e);
    return serverError('تغییر زبان ثبت نشد. دوباره تلاش کنید.');
  }
}
