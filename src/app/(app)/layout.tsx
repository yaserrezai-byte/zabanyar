import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppNav from '@/components/AppNav';
import type { Profile } from '@/types/db';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  // safety net if the signup trigger did not run
  if (!profile) {
    const { data: created } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        full_name:
          (user.user_metadata?.full_name as string) ??
          user.email?.split('@')[0] ??
          'کاربر',
      })
      .select('*')
      .single();
    profile = created;
  }

  if (!profile) redirect('/login');

  return (
    <div className="min-h-screen">
      <AppNav profile={profile as Profile} />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
