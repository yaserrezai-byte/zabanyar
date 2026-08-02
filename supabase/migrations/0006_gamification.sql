-- ============================================================
-- زبان‌یار | Gamification: badges, streaks and leaderboard
-- Migration: 0006_gamification
--
-- Reuses what already exists rather than duplicating it:
--   * XP comes from learning_history.xp (already written by every
--     API route: grade, vocabulary/review, tutor/message, ...).
--   * Streaks use profiles.streak_days / last_active_on, which were
--     declared in 0001 but never maintained by anything — this
--     migration adds the missing bookkeeping so the columns finally
--     carry real values (they were 0 for every row before).
--
-- Privacy: the leaderboard is strictly opt-in. profiles gains
-- show_on_leaderboard (default false) and only opted-in learners are
-- ever exposed, without email or any other identifying field.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Opt-in flag + public display name
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists show_on_leaderboard boolean not null default false,
  add column if not exists display_name        text;

comment on column public.profiles.show_on_leaderboard is
  'Opt-in for the public leaderboard. Default false — never expose a learner who has not chosen to appear.';
comment on column public.profiles.display_name is
  'Optional public alias shown on the leaderboard instead of full_name. Never an email.';

-- ------------------------------------------------------------
-- 2) badges — catalogue (readable by everyone, writable by admins)
-- ------------------------------------------------------------
create table if not exists public.badges (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  title_fa       text not null,
  description_fa text not null,
  icon           text not null default '🏅',
  -- { "type": "...", "threshold": n }  — evaluated by award_badges()
  criteria       jsonb not null default '{}'::jsonb,
  tier           text not null default 'bronze'
                   check (tier in ('bronze','silver','gold','platinum')),
  sort_order     int not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

comment on table public.badges is
  'Achievement catalogue. criteria.type is interpreted by public.award_badges().';

create index if not exists idx_badges_active on public.badges(active, sort_order);

-- ------------------------------------------------------------
-- 3) user_badges — who earned what
-- ------------------------------------------------------------
create table if not exists public.user_badges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  badge_id   uuid not null references public.badges(id) on delete cascade,
  earned_at  timestamptz not null default now(),
  -- snapshot of the value that unlocked it, for the UI
  progress   jsonb not null default '{}'::jsonb,
  seen       boolean not null default false,
  unique (user_id, badge_id)          -- idempotent awarding
);

create index if not exists idx_user_badges_user
  on public.user_badges(user_id, earned_at desc);
create index if not exists idx_user_badges_unseen
  on public.user_badges(user_id) where not seen;

comment on table public.user_badges is
  'Earned achievements. Rows are only ever created by award_badges() (SECURITY DEFINER) — there is deliberately no INSERT policy for end users.';

-- ------------------------------------------------------------
-- 4) Seed catalogue
-- ------------------------------------------------------------
insert into public.badges (code, title_fa, description_fa, icon, criteria, tier, sort_order) values
  ('first_step',      'اولین قدم',      'اولین فعالیت یادگیری خود را ثبت کردید.',                    '🌱', '{"type":"total_events","threshold":1}',        'bronze',   10),
  ('placement_done',  'خودشناسی',       'آزمون تعیین سطح را کامل کردید.',                            '🎯', '{"type":"placement_done"}',                    'bronze',   20),
  ('streak_3',        'سه‌روزه',         'سه روز پیاپی تمرین کردید.',                                  '🔥', '{"type":"streak","threshold":3}',              'bronze',   30),
  ('streak_7',        'هفت‌روزه',        'هفت روز پیاپی تمرین کردید — عادت در حال شکل‌گیری است!',      '🔥', '{"type":"streak","threshold":7}',              'silver',   40),
  ('streak_30',       'یک‌ماهه',         'سی روز پیاپی تمرین کردید. پشتکار واقعی!',                    '🏆', '{"type":"streak","threshold":30}',             'gold',     50),
  ('vocab_100',       'صد لغت',         'صد لغت را مرور کردید.',                                      '📚', '{"type":"vocab_reviewed","threshold":100}',     'bronze',   60),
  ('vocab_1000',      'هزار لغت',       'هزار بار لغت مرور کردید — واژگان شما در حال انفجار است!',    '📖', '{"type":"vocab_reviewed","threshold":1000}',    'gold',     70),
  ('vocab_master_50', 'واژه‌شناس',       'پنجاه لغت را به تسلط کامل رساندید.',                         '🧠', '{"type":"vocab_mastered","threshold":50}',      'silver',   80),
  ('flawless_10',     'بدون خطا',       'ده تصحیح پیاپی بدون خطای تکراری داشتید.',                    '✨', '{"type":"flawless_streak","threshold":10}',     'gold',     90),
  ('conversationalist','مکالمه‌گر',      'پنجاه پیام با مربی هوشمند رد و بدل کردید.',                  '💬', '{"type":"messages","threshold":50}',           'silver',  100),
  ('chatterbox',      'پرگو',           'دویست پیام با مربی هوشمند رد و بدل کردید.',                  '🗣️', '{"type":"messages","threshold":200}',          'gold',    110),
  ('lesson_10',       'ده درس',         'ده درس را کامل کردید.',                                      '🎓', '{"type":"lessons_completed","threshold":10}',   'silver',  120),
  ('xp_1000',         'هزار امتیاز',    'هزار امتیاز تجربه جمع کردید.',                               '⭐', '{"type":"total_xp","threshold":1000}',         'silver',  130),
  ('xp_10000',        'ده‌هزار امتیاز',  'ده هزار امتیاز تجربه جمع کردید. افسانه‌ای!',                 '👑', '{"type":"total_xp","threshold":10000}',        'platinum',140),
  ('pronunciation_20','خوش‌بیان',        'بیست تمرین تلفظ با امتیاز بالای ۸۰ ثبت کردید.',              '🎤', '{"type":"pronunciation_good","threshold":20}',  'silver',  150),
  ('early_bird',      'سحرخیز',         'پیش از ساعت ۷ صبح تمرین کردید.',                             '🌅', '{"type":"early_bird"}',                        'bronze',  160),
  ('night_owl',       'شب‌زنده‌دار',      'پس از نیمه‌شب تمرین کردید.',                                 '🦉', '{"type":"night_owl"}',                         'bronze',  170)
on conflict (code) do update set
  title_fa       = excluded.title_fa,
  description_fa = excluded.description_fa,
  icon           = excluded.icon,
  criteria       = excluded.criteria,
  tier           = excluded.tier,
  sort_order     = excluded.sort_order;

-- ------------------------------------------------------------
-- 5) Streak bookkeeping
--
--    profiles.streak_days / last_active_on existed since 0001 but
--    nothing ever wrote to them. This trigger maintains them from the
--    learning_history rows the app already inserts.
-- ------------------------------------------------------------
create or replace function public.touch_streak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  last_day date;
  cur      int;
begin
  select last_active_on, streak_days into last_day, cur
  from public.profiles where id = new.user_id;

  if last_day is null then
    cur := 1;                                   -- first ever activity
  elsif new.occurred_on = last_day then
    return new;                                 -- already counted today
  elsif new.occurred_on = last_day + 1 then
    cur := coalesce(cur, 0) + 1;                -- consecutive day
  elsif new.occurred_on > last_day then
    cur := 1;                                   -- gap → restart
  else
    return new;                                 -- backfilled older row
  end if;

  update public.profiles
  set streak_days    = cur,
      last_active_on = greatest(coalesce(last_day, new.occurred_on), new.occurred_on)
  where id = new.user_id;

  return new;
end $$;

drop trigger if exists trg_touch_streak on public.learning_history;
create trigger trg_touch_streak
  after insert on public.learning_history
  for each row execute function public.touch_streak();

comment on function public.touch_streak() is
  'Maintains profiles.streak_days / last_active_on from learning_history inserts. Added in 0006 — before this the columns were never written.';

-- Backfill from history already on record, so existing learners do not
-- start from zero the day this ships.
with days as (
  select user_id, occurred_on,
         occurred_on - (row_number() over (partition by user_id order by occurred_on))::int as grp
  from (select distinct user_id, occurred_on from public.learning_history) d
),
runs as (
  select user_id, grp, count(*) as len, max(occurred_on) as last_day
  from days group by user_id, grp
),
latest as (
  select distinct on (user_id) user_id, len, last_day
  from runs order by user_id, last_day desc
)
update public.profiles p
set streak_days = case
      when l.last_day >= (now() at time zone 'utc')::date - 1 then l.len::int
      else 0
    end,
    last_active_on = l.last_day
from latest l
where p.id = l.user_id;

-- ------------------------------------------------------------
-- 6) Badge evaluation
--
--    Called after learning events. SECURITY DEFINER so it can insert
--    into user_badges (which has no INSERT policy) while still only
--    ever touching the row for `target`.
-- ------------------------------------------------------------
create or replace function public.award_badges(target uuid default null)
returns table (code text, title_fa text, icon text, tier text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := coalesce(target, auth.uid());
  b   record;
  val numeric;
  hit boolean;
begin
  if uid is null then return; end if;

  -- Only the learner themselves, an admin, or the backend may trigger
  -- an evaluation for a given user.
  if auth.uid() is not null
     and auth.uid() <> uid
     and not public.is_admin()
  then
    raise exception 'cannot award badges for another user'
      using errcode = 'insufficient_privilege';
  end if;

  for b in
    select * from public.badges
    where active
      and id not in (select badge_id from public.user_badges where user_id = uid)
    order by sort_order
  loop
    val := null;
    hit := false;

    case b.criteria->>'type'

      when 'total_events' then
        select count(*) into val from public.learning_history where user_id = uid;

      when 'total_xp' then
        select coalesce(sum(xp), 0) into val from public.learning_history where user_id = uid;

      when 'streak' then
        select coalesce(streak_days, 0) into val from public.profiles where id = uid;

      when 'placement_done' then
        select case when placement_done then 1 else 0 end into val
        from public.profiles where id = uid;
        hit := coalesce(val, 0) >= 1;

      when 'vocab_reviewed' then
        select count(*) into val from public.learning_history
        where user_id = uid and event_type = 'vocab_reviewed';

      when 'vocab_mastered' then
        select count(*) into val from public.vocabulary_memory
        where user_id = uid and mastery >= 0.8;

      when 'messages' then
        select count(*) into val from public.messages
        where user_id = uid and role = 'user';

      when 'lessons_completed' then
        select count(*) into val from public.learning_history
        where user_id = uid and event_type = 'lesson_completed';

      when 'pronunciation_good' then
        select count(*) into val from public.pronunciation_attempts
        where user_id = uid and accuracy_score >= 80 and source <> 'heuristic';

      when 'flawless_streak' then
        -- longest run of graded submissions with no recorded errors
        select coalesce(max(run_len), 0) into val from (
          select count(*) as run_len
          from (
            select s.id,
                   row_number() over (order by s.created_at)
                     - row_number() over (
                         partition by (coalesce(jsonb_array_length(s.ai_feedback->'errors'), 0) = 0)
                         order by s.created_at) as grp,
                   coalesce(jsonb_array_length(s.ai_feedback->'errors'), 0) = 0 as clean
            from public.submissions s
            where s.user_id = uid and s.graded_at is not null
          ) t
          where clean
          group by grp
        ) runs;

      when 'early_bird' then
        select count(*) into val from public.learning_history
        where user_id = uid
          and extract(hour from created_at at time zone 'Asia/Tehran') < 7;
        hit := coalesce(val, 0) >= 1;

      when 'night_owl' then
        select count(*) into val from public.learning_history
        where user_id = uid
          and extract(hour from created_at at time zone 'Asia/Tehran') between 0 and 4;
        hit := coalesce(val, 0) >= 1;

      else
        continue;                                  -- unknown criteria type
    end case;

    if not hit then
      hit := coalesce(val, 0) >= coalesce((b.criteria->>'threshold')::numeric, 1);
    end if;

    if hit then
      insert into public.user_badges (user_id, badge_id, progress)
      values (uid, b.id, jsonb_build_object('value', val))
      on conflict (user_id, badge_id) do nothing;

      -- report only rows this call actually created
      if found then
        code := b.code; title_fa := b.title_fa; icon := b.icon; tier := b.tier;
        return next;
      end if;
    end if;
  end loop;
end $$;

comment on function public.award_badges(uuid) is
  'Evaluates all badge criteria for a user and inserts any newly earned rows. Returns only the badges awarded by this call.';

grant execute on function public.award_badges(uuid) to authenticated;

-- ------------------------------------------------------------
-- 7) Leaderboard
--
--    A plain view (not materialized): the dataset is small and a
--    materialized view would need a refresh job and would leak stale
--    rows for learners who just opted out.
-- ------------------------------------------------------------
create or replace view public.leaderboard_view
with (security_invoker = false) as
select
  p.id                                                as user_id,
  coalesce(nullif(trim(p.display_name), ''),
           nullif(trim(p.full_name), ''),
           'زبان‌آموز')                                as name,
  p.current_level,
  coalesce(p.streak_days, 0)                          as streak_days,
  coalesce(sum(h.xp), 0)::int                         as total_xp,
  coalesce(sum(h.xp) filter (
    where h.occurred_on >= (now() at time zone 'utc')::date - 6
  ), 0)::int                                          as weekly_xp,
  count(distinct h.occurred_on) filter (
    where h.occurred_on >= (now() at time zone 'utc')::date - 6
  )::int                                              as active_days_7,
  (select count(*) from public.user_badges ub where ub.user_id = p.id)::int as badge_count
from public.profiles p
left join public.learning_history h on h.user_id = p.id
where p.show_on_leaderboard = true
  and p.role = 'student'
group by p.id, p.display_name, p.full_name, p.current_level, p.streak_days;

comment on view public.leaderboard_view is
  'Opt-in leaderboard. Exposes no email and no per-user learning data — only an alias, level, streak, XP totals and badge count. Filtered to show_on_leaderboard = true.';

revoke all on public.leaderboard_view from anon;
grant select on public.leaderboard_view to authenticated;

-- ------------------------------------------------------------
-- 8) RLS
-- ------------------------------------------------------------
alter table public.badges      enable row level security;
alter table public.user_badges enable row level security;

-- Catalogue: readable by any signed-in user, mutable only by admins.
drop policy if exists badges_select on public.badges;
create policy badges_select on public.badges
  for select to authenticated using ( active or public.is_admin() );

drop policy if exists badges_write on public.badges;
create policy badges_write on public.badges
  for all to authenticated
  using ( public.is_admin() ) with check ( public.is_admin() );

-- Earned badges: same visibility rule as every other user-scoped table
-- (self, assigned teacher, admin) — mirrors the 0002 generic pattern.
drop policy if exists user_badges_select on public.user_badges;
create policy user_badges_select on public.user_badges
  for select to authenticated using ( public.can_access(user_id) );

-- Deliberately NO insert policy: rows may only be created by
-- award_badges() (SECURITY DEFINER) or the service role. A client
-- cannot grant itself a badge.

drop policy if exists user_badges_update on public.user_badges;
create policy user_badges_update on public.user_badges
  for update to authenticated
  using ( user_id = auth.uid() ) with check ( user_id = auth.uid() );

drop policy if exists user_badges_delete on public.user_badges;
create policy user_badges_delete on public.user_badges
  for delete to authenticated using ( public.is_admin() );

-- Guard: a learner may flip `seen`, but must not rewrite which badge
-- they hold or when they earned it.
create or replace function public.guard_user_badge_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  new.user_id   := old.user_id;
  new.badge_id  := old.badge_id;
  new.earned_at := old.earned_at;
  new.progress  := old.progress;
  return new;
end $$;

drop trigger if exists trg_guard_user_badge on public.user_badges;
create trigger trg_guard_user_badge
  before update on public.user_badges
  for each row execute function public.guard_user_badge_update();
