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
