-- ============================================================
-- زبان‌یار | Group role-play conversations
-- Migration: 0007_group_conversation
--
-- The existing conversations/messages pair is strictly single-owner:
--   messages.user_id is NOT NULL and messages_insert requires
--   conversations.user_id = auth.uid().
-- Rather than loosen that (which would weaken privacy for every
-- existing 1:1 tutor chat), group chat gets its own tables and its
-- own membership-based policies. The 1:1 model is untouched.
--
-- Realtime: the supabase_realtime publication exists on this project
-- but had zero tables. The group tables are added to it at the bottom
-- of this file, so live updates work without any dashboard step.
-- ============================================================

-- ---------- ENUMS ----------
do $$ begin
  create type group_status as enum ('waiting','active','ended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type group_sender as enum ('user','ai','system');
exception when duplicate_object then null; end $$;

-- ============================================================
-- 1) group_sessions
-- ============================================================
create table if not exists public.group_sessions (
  id               uuid primary key default gen_random_uuid(),
  scenario_id      text not null,
  topic            text not null,
  topic_fa         text not null,
  level_cefr       cefr_level not null,
  status           group_status not null default 'waiting',
  max_participants int not null default 4 check (max_participants between 2 and 8),
  created_by       uuid references public.profiles(id) on delete set null,
  started_at       timestamptz,
  ended_at         timestamptz,
  last_ai_at       timestamptz,
  message_count    int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_group_open
  on public.group_sessions(level_cefr, status, created_at)
  where status = 'waiting';
create index if not exists idx_group_status on public.group_sessions(status, updated_at desc);

drop trigger if exists trg_group_sessions_updated on public.group_sessions;
create trigger trg_group_sessions_updated before update on public.group_sessions
  for each row execute function public.set_updated_at();

comment on table public.group_sessions is
  'A multi-learner role-play room. Matchmaking pairs learners of the same CEFR level into a waiting session.';

-- ============================================================
-- 2) group_participants
-- ============================================================
create table if not exists public.group_participants (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.group_sessions(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  role_label_fa text,
  joined_at     timestamptz not null default now(),
  left_at       timestamptz,
  last_seen_at  timestamptz not null default now(),
  message_count int not null default 0,
  unique (session_id, user_id)
);

create index if not exists idx_gp_session on public.group_participants(session_id) where left_at is null;
create index if not exists idx_gp_user    on public.group_participants(user_id, joined_at desc);

-- ============================================================
-- 3) group_messages
-- ============================================================
create table if not exists public.group_messages (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.group_sessions(id) on delete cascade,
  sender_type    group_sender not null default 'user',
  -- null for AI/system messages
  sender_id      uuid references public.profiles(id) on delete set null,
  sender_name    text,
  content        text not null check (length(trim(content)) > 0 and length(content) <= 2000),
  translation_fa text,
  corrections    jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),

  -- a human message must name its sender; AI/system must not
  constraint group_messages_sender_shape check (
    (sender_type = 'user' and sender_id is not null)
    or (sender_type in ('ai','system') and sender_id is null)
  )
);

create index if not exists idx_gm_session on public.group_messages(session_id, created_at);
create index if not exists idx_gm_sender  on public.group_messages(sender_id, created_at desc);

-- ------------------------------------------------------------
-- Membership helper (SECURITY DEFINER: policies on group_messages
-- must not recurse into group_participants' own policies)
-- ------------------------------------------------------------
create or replace function public.in_group_session(sess uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_participants gp
    where gp.session_id = sess
      and gp.user_id = auth.uid()
      and gp.left_at is null
  );
$$;

-- Includes people who have already left, so history stays readable
-- to those who were actually in the room.
create or replace function public.was_in_group_session(sess uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_participants gp
    where gp.session_id = sess and gp.user_id = auth.uid()
  );
$$;

-- A teacher may observe a room containing one of their students.
create or replace function public.teaches_in_session(sess uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_teacher() and exists (
    select 1
    from public.group_participants gp
    join public.profiles p on p.id = gp.user_id
    where gp.session_id = sess and p.teacher_id = auth.uid()
  );
$$;

create or replace function public.can_view_session(sess uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.was_in_group_session(sess)
      or public.is_admin()
      or public.teaches_in_session(sess);
$$;

grant execute on function
  public.in_group_session(uuid),
  public.was_in_group_session(uuid),
  public.teaches_in_session(uuid),
  public.can_view_session(uuid)
to authenticated;

-- ------------------------------------------------------------
-- Server-side rate limit: max 1 message / 2s per user per session.
-- Enforced in the database so it cannot be bypassed by calling
-- PostgREST directly, in addition to the API-route check.
-- ------------------------------------------------------------
create or replace function public.guard_group_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_at timestamptz;
begin
  if new.sender_type <> 'user' then
    return new;
  end if;

  -- Backend/service_role is exempt (it writes AI turns).
  if auth.uid() is null then
    return new;
  end if;

  select max(created_at) into last_at
  from public.group_messages
  where session_id = new.session_id
    and sender_id = new.sender_id
    and sender_type = 'user';

  if last_at is not null and now() - last_at < interval '2 seconds' then
    raise exception 'کمی آهسته‌تر! هر ۲ ثانیه یک پیام.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_guard_group_message on public.group_messages;
create trigger trg_guard_group_message
  before insert on public.group_messages
  for each row execute function public.guard_group_message();

-- Keep denormalised counters fresh.
create or replace function public.bump_group_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.group_sessions
  set message_count = message_count + 1,
      updated_at    = now()
  where id = new.session_id;

  if new.sender_type = 'user' and new.sender_id is not null then
    update public.group_participants
    set message_count = message_count + 1,
        last_seen_at  = now()
    where session_id = new.session_id and user_id = new.sender_id;
  end if;

  return new;
end $$;

drop trigger if exists trg_bump_group_counters on public.group_messages;
create trigger trg_bump_group_counters
  after insert on public.group_messages
  for each row execute function public.bump_group_counters();

-- ============================================================
-- 4) Matchmaking + lifecycle
-- ============================================================

-- Find an open room at the learner's level, or open one.
-- SECURITY DEFINER so a learner can discover a `waiting` room they are
-- not yet a member of — without being able to read its messages.
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

  -- Otherwise take the oldest waiting room with a free seat.
  select gs.id into sess
  from public.group_sessions gs
  where gs.scenario_id = p_scenario
    and gs.level_cefr = p_level
    and gs.status = 'waiting'
    and (
      select count(*) from public.group_participants gp
      where gp.session_id = gs.id and gp.left_at is null
    ) < gs.max_participants
  order by gs.created_at
  limit 1
  for update skip locked;          -- avoid two joiners racing for a seat

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

  -- Two or more present → the room goes live.
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

create or replace function public.leave_group_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int;
begin
  update public.group_participants
  set left_at = now()
  where session_id = p_session and user_id = auth.uid() and left_at is null;

  select count(*) into remaining
  from public.group_participants
  where session_id = p_session and left_at is null;

  if remaining = 0 then
    update public.group_sessions
    set status = 'ended', ended_at = now()
    where id = p_session and status <> 'ended';
  elsif remaining = 1 then
    -- Back to waiting so matchmaking can refill the room.
    update public.group_sessions
    set status = 'waiting'
    where id = p_session and status = 'active';
  end if;
end $$;

-- Sweep idle members and empty rooms. Safe to call from any request.
create or replace function public.expire_idle_group_sessions(
  idle_minutes int default 10
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.group_participants
  set left_at = now()
  where left_at is null
    and last_seen_at < now() - make_interval(mins => idle_minutes);

  with empty as (
    select gs.id
    from public.group_sessions gs
    where gs.status <> 'ended'
      and not exists (
        select 1 from public.group_participants gp
        where gp.session_id = gs.id and gp.left_at is null
      )
  )
  update public.group_sessions gs
  set status = 'ended', ended_at = now()
  from empty e
  where gs.id = e.id;

  get diagnostics n = row_count;
  return n;
end $$;

grant execute on function
  public.join_group_session(text, text, text, cefr_level, int),
  public.leave_group_session(uuid),
  public.expire_idle_group_sessions(int)
to authenticated;

-- ============================================================
-- 5) RLS
-- ============================================================
alter table public.group_sessions     enable row level security;
alter table public.group_participants enable row level security;
alter table public.group_messages     enable row level security;

-- ---------- sessions ----------
-- Members see their room; everyone may discover WAITING rooms so
-- matchmaking works. A waiting room reveals only scenario + level.
drop policy if exists group_sessions_select on public.group_sessions;
create policy group_sessions_select on public.group_sessions
  for select to authenticated
  using ( status = 'waiting' or public.can_view_session(id) );

drop policy if exists group_sessions_insert on public.group_sessions;
create policy group_sessions_insert on public.group_sessions
  for insert to authenticated
  with check ( created_by = auth.uid() or public.is_admin() );

drop policy if exists group_sessions_update on public.group_sessions;
create policy group_sessions_update on public.group_sessions
  for update to authenticated
  using ( public.in_group_session(id) or public.is_admin() )
  with check ( public.in_group_session(id) or public.is_admin() );

drop policy if exists group_sessions_delete on public.group_sessions;
create policy group_sessions_delete on public.group_sessions
  for delete to authenticated using ( public.is_admin() );

-- ---------- participants ----------
drop policy if exists group_participants_select on public.group_participants;
create policy group_participants_select on public.group_participants
  for select to authenticated
  using ( user_id = auth.uid() or public.can_view_session(session_id) );

drop policy if exists group_participants_insert on public.group_participants;
create policy group_participants_insert on public.group_participants
  for insert to authenticated
  with check ( user_id = auth.uid() or public.is_admin() );

-- A learner may only update their OWN row (last_seen_at / left_at).
drop policy if exists group_participants_update on public.group_participants;
create policy group_participants_update on public.group_participants
  for update to authenticated
  using ( user_id = auth.uid() or public.is_admin() )
  with check ( user_id = auth.uid() or public.is_admin() );

drop policy if exists group_participants_delete on public.group_participants;
create policy group_participants_delete on public.group_participants
  for delete to authenticated using ( public.is_admin() );

-- ---------- messages ----------
-- Read: only people who were in the room (plus their teacher / admin).
drop policy if exists group_messages_select on public.group_messages;
create policy group_messages_select on public.group_messages
  for select to authenticated
  using ( public.can_view_session(session_id) );

-- Write: only a CURRENT member, only as themselves, only 'user' rows.
-- AI/system turns are written by the service role, which bypasses RLS.
drop policy if exists group_messages_insert on public.group_messages;
create policy group_messages_insert on public.group_messages
  for insert to authenticated
  with check (
    sender_type = 'user'
    and sender_id = auth.uid()
    and public.in_group_session(session_id)
  );

drop policy if exists group_messages_delete on public.group_messages;
create policy group_messages_delete on public.group_messages
  for delete to authenticated
  using ( sender_id = auth.uid() or public.is_admin() );

-- No UPDATE policy: chat history is append-only for everyone.

-- ============================================================
-- 6) Realtime
--
-- The publication existed on this project but contained no tables,
-- so nothing was ever broadcast. Adding the group tables here means
-- Realtime works on deploy with no dashboard step.
-- REPLICA IDENTITY FULL lets subscribers see old values on UPDATE
-- (needed to detect a participant leaving).
-- ============================================================
alter table public.group_messages     replica identity full;
alter table public.group_participants replica identity full;
alter table public.group_sessions     replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'group_messages'
  ) then
    alter publication supabase_realtime add table public.group_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'group_participants'
  ) then
    alter publication supabase_realtime add table public.group_participants;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'group_sessions'
  ) then
    alter publication supabase_realtime add table public.group_sessions;
  end if;
end $$;
