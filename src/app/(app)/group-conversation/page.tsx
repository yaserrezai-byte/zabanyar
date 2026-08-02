import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import GroupLobby from '@/components/GroupLobby';
import { scenariosForLevel } from '@/lib/group-chat';
import type { CefrLevel } from '@/types/db';

export const metadata = { title: 'گفت‌وگوی گروهی | زبان‌یار' };
export const dynamic = 'force-dynamic';

export default async function GroupConversationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_level, full_name, display_name')
    .eq('id', user.id)
    .maybeSingle();

  const level = (profile?.current_level ?? 'A2') as CefrLevel;

  // Rooms already waiting at this level, so the lobby can show
  // "۲ نفر منتظرند" instead of a blind join.
  const { data: openRooms } = await supabase
    .from('group_sessions')
    .select('scenario_id, id')
    .eq('status', 'waiting')
    .eq('level_cefr', level);

  const counts: Record<string, number> = {};
  for (const r of openRooms ?? []) {
    counts[r.scenario_id] = (counts[r.scenario_id] ?? 0) + 1;
  }

  return (
    <GroupLobby
      level={level}
      scenarios={scenariosForLevel(level)}
      openRooms={counts}
      allScenarioCount={scenariosForLevel('C2').length}
    />
  );
}
