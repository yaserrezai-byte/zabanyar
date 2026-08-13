import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PronunciationWorkshop from '@/components/PronunciationWorkshop';
import { sentencesForLevelIn } from '@/lib/ai/banks';
import { getLanguageContext } from '@/lib/active-language';
import type { CefrLevel, PronunciationAttempt } from '@/types/db';

export const metadata = { title: 'تمرین تلفظ | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function PronunciationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { language, track } = await getLanguageContext(supabase, user.id);

  const { data: attempts } = await supabase
    .from('pronunciation_attempts')
    .select('id, target_text, accuracy_score, created_at, source, used_fallback')
    .eq('user_id', user.id)
    .eq('language', language)
    .order('created_at', { ascending: false })
    .limit(8);

  const level = (track.current_level ?? null) as CefrLevel | null;

  return (
    <PronunciationWorkshop
      level={level}
      language={language}
      sentences={sentencesForLevelIn(language, level)}
      recent={(attempts ?? []) as Pick<
        PronunciationAttempt,
        'id' | 'target_text' | 'accuracy_score' | 'created_at' | 'source' | 'used_fallback'
      >[]}
    />
  );
}
