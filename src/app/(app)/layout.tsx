import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppNav from '@/components/AppNav';
import { getLanguageContext } from '@/lib/active-language';
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

  // Resolve the active language once, here, so every page below renders
  // the right track and the nav shows the right level/streak.
  const { language, track } = await getLanguageContext(supabase, user.id);

  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">
        رفتن به محتوای اصلی
      </a>
      <AppNav
        profile={profile as Profile}
        language={language}
        level={track.current_level}
        streak={track.streak_days}
      />
      {/* pb-nav leaves room for the mobile bottom nav; on desktop it collapses */}
      <main id="main" className="pb-nav mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
