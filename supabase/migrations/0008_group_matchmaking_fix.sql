-- ============================================================
-- زبان‌یار | Fix: matchmaking skipped half-empty active rooms
-- Migration: 0008_group_matchmaking_fix
--
-- Found by the live end-to-end test: join_group_session() only
-- considered rooms with status = 'waiting'. A room drops to
-- 'waiting' when it empties out, but a room that reached two
-- learners and then lost one stays 'active' with a free seat —
-- and was therefore invisible to matchmaking. Two learners asking
-- for the same scenario at the same level could each be placed in
-- a different room and never meet.
--
-- Fix: match on FREE SEATS, not on status. Any non-ended room with
-- capacity is a candidate, oldest first.
-- ============================================================

create or replace function public.join_group_session(
  p_scenario text,
  p_topic    text,
  p_topic_fa text,
  p_level    cefr_level,
  p_max      int default 4
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  sess uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  -- Already in a live room for this scenario? Return it.
  select gs.id into sess
  from public.group_sessions gs
  join public.group_participants gp on gp.session_id = gs.id
  where gp.user_id = uid
    and gp.left_at is null
    and gs.status in ('waiting','active')
    and gs.scenario_id = p_scenario
  limit 1;

  if sess is not null then
    update public.group_participants
    set last_seen_at = now()
    where session_id = sess and user_id = uid;
    return sess;
  end if;

  -- Any room with a free seat, regardless of waiting/active.
  -- Prefer the fullest room so learners cluster instead of scattering
  -- one-per-room, then oldest first.
  select gs.id into sess
  from public.group_sessions gs
  where gs.scenario_id = p_scenario
    and gs.level_cefr  = p_level
    and gs.status <> 'ended'
    and (
      select count(*) from public.group_participants gp
      where gp.session_id = gs.id and gp.left_at is null
    ) between 1 and gs.max_participants - 1
  order by (
    select count(*) from public.group_participants gp
    where gp.session_id = gs.id and gp.left_at is null
  ) desc,
  gs.created_at
  limit 1
  for update skip locked;

  -- Nothing joinable → fall back to a completely empty waiting room,
  -- then to creating one.
  if sess is null then
    select gs.id into sess
    from public.group_sessions gs
    where gs.scenario_id = p_scenario
      and gs.level_cefr  = p_level
      and gs.status = 'waiting'
      and not exists (
        select 1 from public.group_participants gp
        where gp.session_id = gs.id and gp.left_at is null
      )
    order by gs.created_at
    limit 1
    for update skip locked;
  end if;

  if sess is null then
    insert into public.group_sessions
      (scenario_id, topic, topic_fa, level_cefr, max_participants, created_by)
    values (p_scenario, p_topic, p_topic_fa, p_level, greatest(2, least(8, p_max)), uid)
    returning id into sess;
  end if;

  insert into public.group_participants (session_id, user_id)
  values (sess, uid)
  on conflict (session_id, user_id)
  do update set left_at = null, last_seen_at = now();

  -- Two or more present → the room is live.
  update public.group_sessions gs
  set status     = 'active',
      started_at = coalesce(gs.started_at, now())
  where gs.id = sess
    and gs.status = 'waiting'
    and (
      select count(*) from public.group_participants gp
      where gp.session_id = sess and gp.left_at is null
    ) >= 2;

  return sess;
end $$;

comment on function public.join_group_session(text, text, text, cefr_level, int) is
  'Matchmaking. Matches on free seats rather than status, so a half-empty active room is reused instead of stranding learners in separate rooms.';
