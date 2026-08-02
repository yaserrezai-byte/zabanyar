-- ============================================================
-- زبان‌یار | Pronunciation practice
-- Migration: 0004_pronunciation
--
-- Adds pronunciation_attempts, following the same conventions as
-- 0001/0002: user_id-scoped table, RLS enabled, policies built from
-- the shared can_access()/is_admin()/is_teacher() helpers so a
-- student sees only their own rows, a teacher sees their assigned
-- students, and an admin sees everything.
--
-- Audio is NOT stored in this table — only a path into the existing
-- private `speech` bucket created in 0002, whose policies already
-- restrict objects to the owner's folder (speech/{user_id}/...).
-- ============================================================

-- ---------- ENUM: where the transcript came from ----------
do $$ begin
  create type transcript_source as enum ('service', 'browser', 'heuristic');
exception when duplicate_object then null; end $$;

comment on type transcript_source is
  'service = server-side STT provider; browser = on-device Web Speech API; heuristic = no transcript available, duration-based estimate';

-- ============================================================
-- pronunciation_attempts
-- ============================================================
create table if not exists public.pronunciation_attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,

  -- what the learner was asked to say, and what we heard
  target_text      text not null,
  transcript       text,

  -- 0..100 overall pronunciation accuracy
  accuracy_score   numeric(5,2) not null default 0
                     check (accuracy_score between 0 and 100),

  -- per-word / per-phoneme breakdown, Persian-facing notes
  phoneme_feedback jsonb not null default '{}'::jsonb,

  -- object path inside the private `speech` bucket: {user_id}/{file}
  audio_path       text,

  -- context + provenance
  level            cefr_level,
  duration_ms      int check (duration_ms is null or duration_ms >= 0),
  source           transcript_source not null default 'heuristic',
  used_fallback    boolean not null default true,

  created_at       timestamptz not null default now()
);

comment on table public.pronunciation_attempts is
  'One row per spoken attempt at a target sentence. Audio itself lives in the private speech bucket.';
comment on column public.pronunciation_attempts.audio_path is
  'Path within the private `speech` storage bucket. Must start with the owner user id folder.';
comment on column public.pronunciation_attempts.used_fallback is
  'true when the score came from the local engine rather than an external speech service.';

create index if not exists idx_pron_user
  on public.pronunciation_attempts(user_id, created_at desc);
create index if not exists idx_pron_user_score
  on public.pronunciation_attempts(user_id, accuracy_score);

-- ------------------------------------------------------------
-- Integrity: an audio_path may only ever point at the owner's folder.
-- Storage RLS already enforces this at the object level; this trigger
-- stops a mismatched pointer being recorded in the first place.
-- ------------------------------------------------------------
create or replace function public.guard_pronunciation_audio_path()
returns trigger
language plpgsql
as $$
begin
  if new.audio_path is not null
     and split_part(new.audio_path, '/', 1) <> new.user_id::text then
    raise exception
      'audio_path must live under the owner folder (%/...), got %',
      new.user_id, new.audio_path
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_pron_audio on public.pronunciation_attempts;
create trigger trg_guard_pron_audio
  before insert or update on public.pronunciation_attempts
  for each row execute function public.guard_pronunciation_audio_path();

-- ============================================================
-- RLS — identical shape to the generic user_id-scoped tables in 0002
-- ============================================================
alter table public.pronunciation_attempts enable row level security;

drop policy if exists pronunciation_attempts_select on public.pronunciation_attempts;
create policy pronunciation_attempts_select
  on public.pronunciation_attempts for select to authenticated
  using ( public.can_access(user_id) );

drop policy if exists pronunciation_attempts_insert on public.pronunciation_attempts;
create policy pronunciation_attempts_insert
  on public.pronunciation_attempts for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.is_admin()
    or (public.is_teacher() and public.teaches(user_id))
  );

drop policy if exists pronunciation_attempts_update on public.pronunciation_attempts;
create policy pronunciation_attempts_update
  on public.pronunciation_attempts for update to authenticated
  using ( public.can_access(user_id) )
  with check ( public.can_access(user_id) );

drop policy if exists pronunciation_attempts_delete on public.pronunciation_attempts;
create policy pronunciation_attempts_delete
  on public.pronunciation_attempts for delete to authenticated
  using ( user_id = auth.uid() or public.is_admin() );

-- ============================================================
-- The `speech` bucket already exists from 0002 with owner-folder
-- policies (private_read / private_write / private_delete).
-- Re-assert it here so this migration is self-contained if replayed
-- against a database where 0002 predates the bucket.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('speech','speech', false, 10485760,
        array['audio/webm','audio/mpeg','audio/wav','audio/ogg','audio/mp4'])
on conflict (id) do nothing;
