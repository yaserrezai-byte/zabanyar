import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

export interface AuthCtx {
  supabase: SupabaseClient;
  user: User;
}

/** Returns the authenticated context or null. */
export async function getAuth(): Promise<AuthCtx | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}

export function unauthorized() {
  return Response.json({ error: 'ابتدا وارد حساب خود شوید.' }, { status: 401 });
}

export function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400 });
}

export function serverError(msg = 'خطای داخلی سرور') {
  return Response.json({ error: msg }, { status: 500 });
}

/** Roles allowed to reach the teacher panel. */
export type StaffRole = 'teacher' | 'admin';

export interface StaffCtx extends AuthCtx {
  role: StaffRole;
}

/**
 * Auth context for staff-only areas. Returns null when the caller is
 * not signed in, and 'forbidden' when they are signed in but are not a
 * teacher or admin — mirroring how the admin page gates itself.
 */
export async function getStaff(): Promise<StaffCtx | 'forbidden' | null> {
  const ctx = await getAuth();
  if (!ctx) return null;

  const { data } = await ctx.supabase
    .from('profiles')
    .select('role')
    .eq('id', ctx.user.id)
    .maybeSingle();

  const role = data?.role;
  if (role !== 'teacher' && role !== 'admin') return 'forbidden';

  return { ...ctx, role };
}

export function forbidden(msg = 'برای این عملیات دسترسی لازم را ندارید.') {
  return Response.json({ error: msg }, { status: 403 });
}
