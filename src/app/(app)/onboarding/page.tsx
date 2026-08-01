import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import OnboardingWizard from '@/components/OnboardingWizard';
import type { Profile } from '@/types/db';

export const metadata = { title: 'تنظیمات یادگیری | زبان‌یار' };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single();

  return (
    <div className="mx-auto max-w-2xl">
      <OnboardingWizard profile={profile as Profile} />
    </div>
  );
}
