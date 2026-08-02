import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PronunciationWorkshop from '@/components/PronunciationWorkshop';
import { sentencesForLevel } from '@/lib/ai/pronunciation-engine';
import type { CefrLevel, PronunciationAttempt } from '@/types/db';

export const metadata = { title: 'تمرین تلفظ | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function PronunciationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: attempts }] = await Promise.all([
    supabase.from('profiles').select('current_level').eq('id', user.id).single(),
    supabase
      .from('pronunciation_attempts')
      .select('id, target_text, accuracy_score, created_at, source, used_fallback')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const level = (profile?.current_level ?? null) as CefrLevel | null;

  return (
    <PronunciationWorkshop
      level={level}
      sentences={sentencesForLevel(level)}
      recent={(attempts ?? []) as Pick<
        PronunciationAttempt,
        'id' | 'target_text' | 'accuracy_score' | 'created_at' | 'source' | 'used_fallback'
      >[]}
    />
  );
}
