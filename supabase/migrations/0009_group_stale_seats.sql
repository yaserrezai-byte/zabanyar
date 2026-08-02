-- ============================================================
-- زبان‌یار | Fix: stale participants occupied seats forever
-- Migration: 0009_group_stale_seats
--
-- Found by repeated live runs of the group end-to-end test.
--
-- A participant row only frees its seat when left_at is stamped, which
-- happens on an explicit "leave" or when the idle sweeper runs. Anyone
-- who simply closed the tab kept their seat indefinitely, so a room
-- filled up with ghosts and matchmaking pushed new learners into fresh
-- rooms — the exact symptom that made two test users land in separate
-- rooms.
--
-- Two changes:
--   1. Seat counting ignores participants who have not been seen for
--      `stale_minutes` (default 5), so ghosts do not block a room.
--   2. join_group_session() sweeps the target scenario/level before
--      matching, so ghost rows get their left_at stamped rather than
--      lingering.
--
-- (auth.users deletion already cascades to group_participants via
--  profiles; the ghosts here were live-but-idle rows.)
-- ============================================================

-- Seats currently held by learners who are plausibly still present.
create or replace function public.active_seat_count(
  p_session uuid,
  stale_minutes int default 5
)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.group_participants gp
  where gp.session_id = p_session
    and gp.left_at is null
    and gp.last_seen_at > now() - make_interval(mins => stale_minutes);
$$;

grant execute on function public.active_seat_count(uuid, int) to authenticated;

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

  -- Release ghost seats in this scenario/level before matching, so a
  -- room abandoned by a closed tab becomes joinable again.
  update public.group_participants gp
  set left_at = now()
  from public.group_sessions gs
  where gs.id = gp.session_id
    and gs.scenario_id = p_scenario
    and gs.level_cefr  = p_level
    and gp.left_at is null
    and gp.last_seen_at < now() - interval '5 minutes';

  -- Close rooms that just became empty as a result.
  update public.group_sessions gs
  set status = 'ended', ended_at = now()
  where gs.scenario_id = p_scenario
    and gs.level_cefr  = p_level
    and gs.status <> 'ended'
    and not exists (
      select 1 from public.group_participants gp
      where gp.session_id = gs.id and gp.left_at is null
    );

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

  -- Prefer the fullest room that still has a real free seat.
  select gs.id into sess
  from public.group_sessions gs
  where gs.scenario_id = p_scenario
    and gs.level_cefr  = p_level
    and gs.status <> 'ended'
    and public.active_seat_count(gs.id) between 1 and gs.max_participants - 1
  order by public.active_seat_count(gs.id) desc, gs.created_at
  limit 1
  for update skip locked;

  -- Otherwise reuse an empty waiting room...
  if sess is null then
    select gs.id into sess
    from public.group_sessions gs
    where gs.scenario_id = p_scenario
      and gs.level_cefr  = p_level
      and gs.status = 'waiting'
      and public.active_seat_count(gs.id) = 0
    order by gs.created_at
    limit 1
    for update skip locked;
  end if;

  -- ...or open a new one.
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

  update public.group_sessions gs
  set status     = 'active',
      started_at = coalesce(gs.started_at, now())
  where gs.id = sess
    and gs.status = 'waiting'
    and public.active_seat_count(sess) >= 2;

  return sess;
end $$;

comment on function public.join_group_session(text, text, text, cefr_level, int) is
  'Matchmaking. Sweeps ghost seats first, then matches on genuinely occupied seats so an abandoned room does not stay full forever.';

-- One-off cleanup of ghosts already in the table.
update public.group_participants
set left_at = now()
where left_at is null
  and last_seen_at < now() - interval '5 minutes';

update public.group_sessions gs
set status = 'ended', ended_at = now()
where gs.status <> 'ended'
  and not exists (
    select 1 from public.group_participants gp
    where gp.session_id = gs.id and gp.left_at is null
  );

-- ------------------------------------------------------------
-- leave_group_session() must use the same seat definition, and must
-- NOT force a one-person room back to 'waiting': under the seat-based
-- matchmaking of 0008 an active room with a free seat is joinable, so
-- flipping the status is unnecessary and made the state confusing.
-- ------------------------------------------------------------
create or replace function public.leave_group_session(p_session uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  remaining int;
begin
  update public.group_participants
  set left_at = now()
  where session_id = p_session and user_id = auth.uid() and left_at is null;

  select public.active_seat_count(p_session) into remaining;

  if remaining = 0 then
    update public.group_sessions
    set status = 'ended', ended_at = now()
    where id = p_session and status <> 'ended';
  end if;
end $$;
