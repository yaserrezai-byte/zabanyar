import { z } from 'zod';
import { getStaff, unauthorized, forbidden, badRequest, serverError } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const Body = z.object({
  student_ids: z.array(z.string().uuid()).min(1).max(60),
  title: z.string().min(1).max(200),
  instructions_fa: z.string().max(4000).optional(),
  skill: z
    .enum(['grammar', 'vocabulary', 'listening', 'speaking', 'reading', 'writing'])
    .default('writing'),
  lesson_id: z.string().uuid().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  max_points: z.coerce.number().int().min(1).max(1000).default(100),
});

export async function POST(req: Request) {
  const staff = await getStaff();
  if (staff === null) return unauthorized();
  if (staff === 'forbidden') return forbidden('فقط مدرس یا مدیر می‌تواند تکلیف تخصیص دهد.');
  const { supabase, user, role } = staff;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return badRequest('اطلاعات تکلیف نامعتبر است.');
  }

  try {
    // Confirm every target is genuinely in scope BEFORE inserting, so a
    // partial failure can't leave some students with the assignment and
    // others without. RLS would reject the write anyway; this turns that
    // into a clear Persian message instead of an opaque error.
    const { data: roster, error: rosterErr } = await supabase.rpc('my_students');
    if (rosterErr) throw rosterErr;

    const allowed = new Set(((roster ?? []) as { id: string }[]).map((s) => s.id));
    const rejected = body.student_ids.filter((id) => !allowed.has(id));

    if (rejected.length) {
      return forbidden(
        role === 'admin'
          ? 'برخی از شناسه‌های ارسالی متعلق به دانش‌آموز نیستند.'
          : `${rejected.length} دانش‌آموز از فهرست شما نیستند و تکلیفی برایشان ثبت نشد.`
      );
    }

    const rows = body.student_ids.map((sid) => ({
      user_id: sid,
      assigned_by: user.id,
      lesson_id: body.lesson_id ?? null,
      title: body.title.trim(),
      instructions_fa: body.instructions_fa?.trim() || null,
      skill: body.skill,
      status: 'assigned' as const,
      due_at: body.due_at ?? null,
      max_points: body.max_points,
    }));

    const { data, error } = await supabase
      .from('assignments')
      .insert(rows)
      .select('id, user_id');

    if (error) {
      if (error.code === '42501') {
        return forbidden('اجازه تخصیص تکلیف به این دانش‌آموزان را ندارید.');
      }
      throw error;
    }

    return Response.json({
      ok: true,
      created: data?.length ?? 0,
      assignment_ids: (data ?? []).map((d) => d.id),
    });
  } catch (e) {
    console.error('[teacher/assign]', e);
    return serverError('تخصیص تکلیف ناموفق بود.');
  }
}
