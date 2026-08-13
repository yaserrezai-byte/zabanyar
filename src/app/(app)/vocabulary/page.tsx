import { redirect } from 'next/navigation';
import { getActiveLanguage } from '@/lib/active-language';
import { createClient } from '@/lib/supabase/server';
import VocabReview from '@/components/VocabReview';
import { Empty } from '@/components/ui';
import type { VocabularyMemory } from '@/types/db';
import { nowIso } from '@/utils/dates';

export const metadata = { title: 'مرور لغات | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function VocabularyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const language = await getActiveLanguage(supabase, user.id);
  const now = nowIso();

  const [{ data: due }, { count: total }, { count: mastered }] = await Promise.all([
    supabase.from('vocabulary_memory').select('*')
      .eq('user_id', user.id).eq('language', language).lte('next_review_at', now)
      .order('next_review_at').limit(20),
    supabase.from('vocabulary_memory').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('language', language),
    supabase.from('vocabulary_memory').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('language', language).gte('mastery', 0.8),
  ]);

  if (!total) {
    return (
      <Empty
        icon="📖"
        title="هنوز لغتی در حافظه شما نیست"
        description="با ساخت درس یا گفت‌وگو با مربی، لغات جدید به‌طور خودکار به اینجا اضافه می‌شوند."
        action={{ label: 'ساخت اولین درس', href: '/lessons' }}
      />
    );
  }

  return (
    <VocabReview language={language}
      words={(due ?? []) as VocabularyMemory[]}
      total={total ?? 0}
      mastered={mastered ?? 0}
    />
  );
}
