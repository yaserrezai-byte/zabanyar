import { z } from 'zod';
import { getStaff, unauthorized, forbidden, badRequest, serverError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const Body = z.object({
  submission_id: z.string().uuid(),
  teacher_feedback: z.string().max(4000).nullable().optional(),
  teacher_score: z.coerce.number().min(0).max(100).nullable().optional(),
});

export async function POST(req: Request) {
  const staff = await getStaff();
  if (staff === null) return unauthorized();
  if (staff === 'forbidden') return forbidden('فقط مدرس یا مدیر می‌تواند بازخورد ثبت کند.');
  const { supabase } = staff;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return badRequest('داده ارسالی نامعتبر است.');
  }

  try {
    // RLS scopes this to the caller's own students; the 0005 guard
    // trigger independently rejects anyone else writing these columns.
    const { data, error } = await supabase
      .from('submissions')
      .update({
        teacher_feedback: body.teacher_feedback ?? null,
        teacher_score: body.teacher_score ?? null,
      })
      .eq('id', body.submission_id)
      .select('id, user_id, teacher_feedback, teacher_score, teacher_feedback_at')
      .maybeSingle();

    if (error) {
      // insufficient_privilege from the guard trigger
      if (error.code === '42501') {
        return forbidden('شما مدرس این دانش‌آموز نیستید.');
      }
      throw error;
    }

    if (!data) {
      return forbidden('این پاسخ در دسترس شما نیست.');
    }

    return Response.json({ ok: true, ...data });
  } catch (e) {
    console.error('[teacher/feedback]', e);
    return serverError('ثبت بازخورد ناموفق بود.');
  }
}
