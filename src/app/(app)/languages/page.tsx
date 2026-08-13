import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LanguagePicker from '@/components/LanguagePicker';
import { getActiveLanguage, listLanguageTracks } from '@/lib/active-language';

export const metadata = { title: 'انتخاب زبان | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function LanguagesPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { mode } = await searchParams;

  const [language, tracks] = await Promise.all([
    getActiveLanguage(supabase, user.id),
    listLanguageTracks(supabase, user.id),
  ]);

  return (
    <div className="py-4">
      <LanguagePicker
        active={language}
        tracks={tracks}
        mode={mode === 'choose' ? 'choose' : 'switch'}
      />
    </div>
  );
}
