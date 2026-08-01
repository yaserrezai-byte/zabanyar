-- ============================================================
-- زبان‌یار | Zabanyar AI  —  Initial Schema
-- Migration: 0001_init_schema
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
do $$ begin
  create type user_role as enum ('student','teacher','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cefr_level as enum ('A1','A2','B1','B2','C1','C2');
exception when duplicate_object then null; end $$;

do $$ begin
  create type skill_kind as enum ('grammar','vocabulary','listening','speaking','reading','writing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type test_status as enum ('in_progress','completed','abandoned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lesson_status as enum ('draft','published','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type exercise_kind as enum ('mcq','fill_blank','reorder','match','short_answer','essay','speaking');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assignment_status as enum ('assigned','submitted','graded','late','skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type conversation_role as enum ('user','assistant','system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_tier as enum ('free','pro','premium');
exception when duplicate_object then null; end $$;

-- ---------- UTILITY: updated_at ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================
-- 1) PROFILES  (extends auth.users)
-- ============================================================
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text,
  full_name         text,
  avatar_url        text,
  role              user_role not null default 'student',
  locale            text not null default 'fa',
  timezone          text not null default 'Asia/Tehran',
  current_level     cefr_level,
  target_level      cefr_level,
  daily_goal_min    int not null default 15 check (daily_goal_min between 5 and 240),
  interests         text[] not null default '{}',
  learning_pace     numeric(4,2) not null default 1.0 check (learning_pace > 0),
  streak_days       int not null default 0,
  last_active_on    date,
  onboarding_done   boolean not null default false,
  placement_done    boolean not null default false,
  subscription      subscription_tier not null default 'free',
  teacher_id        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_profiles_role      on public.profiles(role);
create index if not exists idx_profiles_teacher   on public.profiles(teacher_id);
drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2) SKILL LEVELS
-- ============================================================
create table if not exists public.skill_levels (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  skill         skill_kind not null,
  level         cefr_level not null default 'A1',
  score         numeric(5,2) not null default 0 check (score between 0 and 100),
  confidence    numeric(4,3) not null default 0.5 check (confidence between 0 and 1),
  assessed_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, skill)
);
create index if not exists idx_skill_levels_user on public.skill_levels(user_id);
drop trigger if exists trg_skill_levels_updated on public.skill_levels;
create trigger trg_skill_levels_updated before update on public.skill_levels
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3) PLACEMENT TESTS
-- ============================================================
create table if not exists public.placement_tests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  status         test_status not null default 'in_progress',
  current_index  int not null default 0,
  questions      jsonb not null default '[]'::jsonb,
  answers        jsonb not null default '[]'::jsonb,
  raw_score      numeric(5,2),
  result_level   cefr_level,
  skill_breakdown jsonb not null default '{}'::jsonb,
  ai_summary     text,
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_placement_user on public.placement_tests(user_id, status);
drop trigger if exists trg_placement_updated on public.placement_tests;
create trigger trg_placement_updated before update on public.placement_tests
  for each row execute function public.set_updated_at();

-- ============================================================
-- 4) LESSONS
-- ============================================================
create table if not exists public.lessons (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete cascade, -- null = global/curated
  title         text not null,
  title_fa      text,
  slug          text,
  skill         skill_kind not null default 'grammar',
  level         cefr_level not null default 'A1',
  topic         text,
  summary_fa    text,
  content       jsonb not null default '{}'::jsonb,
  est_minutes   int not null default 10,
  order_index   int not null default 0,
  status        lesson_status not null default 'published',
  ai_generated  boolean not null default true,
  generated_from jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_lessons_user  on public.lessons(user_id);
create index if not exists idx_lessons_level on public.lessons(level, skill);
drop trigger if exists trg_lessons_updated on public.lessons;
create trigger trg_lessons_updated before update on public.lessons
  for each row execute function public.set_updated_at();

-- ============================================================
-- 5) EXERCISES
-- ============================================================
create table if not exists public.exercises (
  id             uuid primary key default gen_random_uuid(),
  lesson_id      uuid references public.lessons(id) on delete cascade,
  user_id        uuid references public.profiles(id) on delete cascade,
  kind           exercise_kind not null default 'mcq',
  skill          skill_kind not null default 'grammar',
  level          cefr_level not null default 'A1',
  prompt         text not null,
  prompt_fa      text,
  options        jsonb not null default '[]'::jsonb,
  correct_answer jsonb,
  explanation_fa text,
  points         int not null default 10,
  order_index    int not null default 0,
  ai_generated   boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists idx_exercises_lesson on public.exercises(lesson_id);
create index if not exists idx_exercises_user   on public.exercises(user_id);

-- ============================================================
-- 6) ASSIGNMENTS
-- ============================================================
create table if not exists public.assignments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  assigned_by   uuid references public.profiles(id) on delete set null,
  lesson_id     uuid references public.lessons(id) on delete set null,
  title         text not null,
  instructions_fa text,
  skill         skill_kind not null default 'writing',
  status        assignment_status not null default 'assigned',
  due_at        timestamptz,
  max_points    int not null default 100,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_assignments_user on public.assignments(user_id, status);
drop trigger if exists trg_assignments_updated on public.assignments;
create trigger trg_assignments_updated before update on public.assignments
  for each row execute function public.set_updated_at();

-- ============================================================
-- 7) SUBMISSIONS
-- ============================================================
create table if not exists public.submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid references public.assignments(id) on delete cascade,
  exercise_id    uuid references public.exercises(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  answer         jsonb not null default '{}'::jsonb,
  answer_text    text,
  audio_path     text,
  is_correct     boolean,
  score          numeric(5,2),
  time_spent_sec int,
  ai_feedback    jsonb not null default '{}'::jsonb,
  feedback_fa    text,
  graded_at      timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_submissions_user       on public.submissions(user_id, created_at desc);
create index if not exists idx_submissions_assignment on public.submissions(assignment_id);

-- ============================================================
-- 8) MISTAKES MEMORY  (AI Error Intelligence)
-- ============================================================
create table if not exists public.mistakes_memory (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  skill            skill_kind not null default 'grammar',
  error_tag        text not null,
  error_label_fa   text,
  description_fa   text,
  example_wrong    text,
  example_correct  text,
  occurrences      int not null default 1,
  severity         numeric(4,3) not null default 0.5 check (severity between 0 and 1),
  resolved         boolean not null default false,
  last_seen_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, error_tag)
);
create index if not exists idx_mistakes_user on public.mistakes_memory(user_id, resolved, occurrences desc);
drop trigger if exists trg_mistakes_updated on public.mistakes_memory;
create trigger trg_mistakes_updated before update on public.mistakes_memory
  for each row execute function public.set_updated_at();

-- ============================================================
-- 9) VOCABULARY MEMORY  (SM-2 spaced repetition)
-- ============================================================
create table if not exists public.vocabulary_memory (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  word            text not null,
  meaning_fa      text not null,
  part_of_speech  text,
  example_en      text,
  example_fa      text,
  phonetic        text,
  level           cefr_level not null default 'A1',
  ease_factor     numeric(4,2) not null default 2.5,
  interval_days   int not null default 0,
  repetitions     int not null default 0,
  lapses          int not null default 0,
  mastery         numeric(4,3) not null default 0 check (mastery between 0 and 1),
  next_review_at  timestamptz not null default now(),
  last_review_at  timestamptz,
  source          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, word)
);
create index if not exists idx_vocab_due on public.vocabulary_memory(user_id, next_review_at);
drop trigger if exists trg_vocab_updated on public.vocabulary_memory;
create trigger trg_vocab_updated before update on public.vocabulary_memory
  for each row execute function public.set_updated_at();

-- ============================================================
-- 10) CONVERSATIONS + MESSAGES  (AI Tutor)
-- ============================================================
create table if not exists public.conversations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  title         text not null default 'گفت‌وگوی جدید',
  scenario      text,
  level         cefr_level,
  mode          text not null default 'free_chat',
  message_count int not null default 0,
  last_message_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_conv_user on public.conversations(user_id, updated_at desc);
drop trigger if exists trg_conv_updated on public.conversations;
create trigger trg_conv_updated before update on public.conversations
  for each row execute function public.set_updated_at();

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            conversation_role not null,
  content         text not null,
  translation_fa  text,
  corrections     jsonb not null default '[]'::jsonb,
  audio_path      text,
  tokens          int,
  created_at      timestamptz not null default now()
);
create index if not exists idx_messages_conv on public.messages(conversation_id, created_at);

-- ============================================================
-- 11) LEARNING HISTORY
-- ============================================================
create table if not exists public.learning_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  event_type    text not null,
  skill         skill_kind,
  lesson_id     uuid references public.lessons(id) on delete set null,
  duration_sec  int not null default 0,
  xp            int not null default 0,
  accuracy      numeric(5,2),
  meta          jsonb not null default '{}'::jsonb,
  occurred_on   date not null default (now() at time zone 'utc')::date,
  created_at    timestamptz not null default now()
);
create index if not exists idx_history_user on public.learning_history(user_id, occurred_on desc);

-- ============================================================
-- 12) PROGRESS REPORTS
-- ============================================================
create table if not exists public.progress_reports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  period_start   date not null,
  period_end     date not null,
  total_minutes  int not null default 0,
  total_xp       int not null default 0,
  lessons_done   int not null default 0,
  accuracy_avg   numeric(5,2),
  skill_snapshot jsonb not null default '{}'::jsonb,
  strengths_fa   text[],
  weaknesses_fa  text[],
  coach_advice_fa text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_reports_user on public.progress_reports(user_id, period_end desc);

-- ============================================================
-- 13) AI MEMORY  (long-term tutor memory)
-- ============================================================
create table if not exists public.ai_memory (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null,           -- preference | weakness | goal | fact | style
  key         text not null,
  value       text not null,
  weight      numeric(4,3) not null default 0.5,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, kind, key)
);
create index if not exists idx_ai_memory_user on public.ai_memory(user_id, weight desc);
drop trigger if exists trg_ai_memory_updated on public.ai_memory;
create trigger trg_ai_memory_updated before update on public.ai_memory
  for each row execute function public.set_updated_at();
