-- ============================================================
-- زبان‌یار | 0010 — Multi-language support (English + Spanish)
--
-- Until now every table implicitly assumed one target language.
-- Three unique constraints actively collide once a learner studies
-- two languages:
--
--   skill_levels      unique (user_id, skill)       -> EN grammar and ES grammar share a row
--   vocabulary_memory unique (user_id, word)        -> "actual" exists in both languages
--   mistakes_memory   unique (user_id, error_tag)   -> "article" exists in both languages
--
-- This migration adds a `language` dimension and re-keys those
-- constraints. It is written to be safe on a live database:
--   * every new column is NOT NULL with a default of 'en', so all
--     existing rows keep working and are attributed to English
--   * old unique constraints are dropped only after the new ones
--     are in place
--   * it is idempotent and can be re-run
-- ============================================================

-- ------------------------------------------------------------
-- 0) The language enum
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'learning_language') then
    create type learning_language as enum ('en', 'es');
  end if;
end$$;

-- ------------------------------------------------------------
-- 1) profiles — which language is active, and per-language state
--
-- `active_language` is the language the learner is currently studying.
-- Per-language progress (level, placement flag) moves into
-- `user_languages` so the two tracks stay independent.
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists active_language learning_language not null default 'en';

create table if not exists public.user_languages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  language        learning_language not null,

  -- per-language mirror of what used to live on `profiles`
  current_level   cefr_level,
  target_level    cefr_level,
  placement_done  boolean not null default false,
  streak_days     int not null default 0,
  last_active_on  date,

  -- the learner's own reason for studying this language
  goal_fa         text,
  started_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (user_id, language)
);

create index if not exists idx_user_languages_user
  on public.user_languages(user_id);

drop trigger if exists trg_user_languages_updated on public.user_languages;
create trigger trg_user_languages_updated before update on public.user_languages
  for each row execute function public.set_updated_at();

comment on table public.user_languages is
  'One row per (learner, language). Holds the level and streak for that language so English and Spanish progress never mix.';

-- Backfill: every existing learner is an English learner, carrying
-- over the level/placement state they already had.
insert into public.user_languages (user_id, language, current_level, target_level, placement_done, streak_days, last_active_on)
select p.id, 'en', p.current_level, p.target_level, p.placement_done, p.streak_days, p.last_active_on
from public.profiles p
on conflict (user_id, language) do nothing;

-- ------------------------------------------------------------
-- 2) Add `language` to every learner-data table
-- ------------------------------------------------------------
alter table public.skill_levels
  add column if not exists language learning_language not null default 'en';
alter table public.placement_tests
  add column if not exists language learning_language not null default 'en';
alter table public.lessons
  add column if not exists language learning_language not null default 'en';
alter table public.exercises
  add column if not exists language learning_language not null default 'en';
alter table public.assignments
  add column if not exists language learning_language not null default 'en';
alter table public.mistakes_memory
  add column if not exists language learning_language not null default 'en';
alter table public.vocabulary_memory
  add column if not exists language learning_language not null default 'en';
alter table public.conversations
  add column if not exists language learning_language not null default 'en';
alter table public.learning_history
  add column if not exists language learning_language not null default 'en';
alter table public.progress_reports
  add column if not exists language learning_language not null default 'en';
alter table public.pronunciation_attempts
  add column if not exists language learning_language not null default 'en';
alter table public.group_sessions
  add column if not exists language learning_language not null default 'en';

-- ------------------------------------------------------------
-- 3) Re-key the three colliding unique constraints
--
-- Order matters: create the new constraint first so there is never a
-- window without uniqueness protection.
-- ------------------------------------------------------------

-- 3a) skill_levels: (user_id, skill) -> (user_id, language, skill)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'skill_levels_user_id_language_skill_key'
  ) then
    alter table public.skill_levels
      add constraint skill_levels_user_id_language_skill_key
      unique (user_id, language, skill);
  end if;
end$$;

alter table public.skill_levels
  drop constraint if exists skill_levels_user_id_skill_key;

-- 3b) vocabulary_memory: (user_id, word) -> (user_id, language, word)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vocabulary_memory_user_id_language_word_key'
  ) then
    alter table public.vocabulary_memory
      add constraint vocabulary_memory_user_id_language_word_key
      unique (user_id, language, word);
  end if;
end$$;

alter table public.vocabulary_memory
  drop constraint if exists vocabulary_memory_user_id_word_key;

-- 3c) mistakes_memory: (user_id, error_tag) -> (user_id, language, error_tag)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mistakes_memory_user_id_language_error_tag_key'
  ) then
    alter table public.mistakes_memory
      add constraint mistakes_memory_user_id_language_error_tag_key
      unique (user_id, language, error_tag);
  end if;
end$$;

alter table public.mistakes_memory
  drop constraint if exists mistakes_memory_user_id_error_tag_key;

-- ------------------------------------------------------------
-- 4) Language-aware indexes
--    Every hot query now filters by language; keep them fast.
-- ------------------------------------------------------------
create index if not exists idx_vocab_due_lang
  on public.vocabulary_memory(user_id, language, next_review_at);
create index if not exists idx_mistakes_user_lang
  on public.mistakes_memory(user_id, language, resolved, occurrences desc);
create index if not exists idx_lessons_user_lang
  on public.lessons(user_id, language, created_at desc);
create index if not exists idx_history_user_lang
  on public.learning_history(user_id, language, occurred_on desc);
create index if not exists idx_skill_levels_user_lang
  on public.skill_levels(user_id, language);
create index if not exists idx_placement_user_lang
  on public.placement_tests(user_id, language, status);

-- Matchmaking must never pair an English learner with a Spanish one.
drop index if exists public.idx_group_open;
create index if not exists idx_group_open
  on public.group_sessions(language, level_cefr, status, created_at)
  where status = 'waiting';

-- ------------------------------------------------------------
-- 5) vocabulary_memory.example_en is now mis-named
--    Keep the column (RLS + existing rows) but document the change.
--    `example_en` holds an example in the *target* language.
-- ------------------------------------------------------------
comment on column public.vocabulary_memory.example_en is
  'Example sentence in the TARGET language (English or Spanish), despite the legacy _en suffix.';

-- ------------------------------------------------------------
-- 6) RLS for the new table — mirrors the generic user_id-scoped policy
--    set defined in 0002 (can_access / is_admin / teaches).
-- ------------------------------------------------------------
alter table public.user_languages enable row level security;

drop policy if exists user_languages_select on public.user_languages;
create policy user_languages_select on public.user_languages
  for select to authenticated
  using ( public.can_access(user_id) );

drop policy if exists user_languages_insert on public.user_languages;
create policy user_languages_insert on public.user_languages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_admin()
    or (public.is_teacher() and public.teaches(user_id))
  );

drop policy if exists user_languages_update on public.user_languages;
create policy user_languages_update on public.user_languages
  for update to authenticated
  using ( public.can_access(user_id) )
  with check ( public.can_access(user_id) );

drop policy if exists user_languages_delete on public.user_languages;
create policy user_languages_delete on public.user_languages
  for delete to authenticated
  using ( user_id = auth.uid() or public.is_admin() );
