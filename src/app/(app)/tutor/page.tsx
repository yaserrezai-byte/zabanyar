import { redirect } from 'next/navigation';
import { getActiveLanguage } from '@/lib/active-language';
import { createClient } from '@/lib/supabase/server';
import TutorChat from '@/components/TutorChat';

export const metadata = { title: 'مربی هوشمند | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function TutorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const language = await getActiveLanguage(supabase, user.id);

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, title, scenario, message_count, updated_at')
    .eq('user_id', user.id)
    .eq('language', language)
    .order('updated_at', { ascending: false })
    .limit(15);

  return <TutorChat language={language} conversations={conversations ?? []} />;
}
