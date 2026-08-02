-- ============================================================
-- زبان‌یار | Teacher panel
-- Migration: 0005_teacher_panel
--
-- Adds manual teacher feedback on top of the existing automatic AI
-- feedback, plus the column-level protection RLS cannot express.
--
-- Context from 0002: submissions already use the generic policy set
--   select/update -> public.can_access(user_id)
-- which means an assigned teacher can ALREADY update a student's
-- submission row. Row-level security cannot restrict *which columns*
-- each role may write, so the rule
--   "only the assigned teacher or an admin may write teacher_feedback,
--    the student may only read it"
-- is enforced with a guard trigger, matching the pattern already used
-- by guard_profile_update (0003) and guard_pronunciation_audio_path (0004).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Teacher feedback columns on submissions
-- ------------------------------------------------------------
alter table public.submissions
  add column if not exists teacher_feedback     text,
  add column if not exists teacher_score        numeric(5,2)
    check (teacher_score is null or teacher_score between 0 and 100),
  add column if not exists teacher_feedback_by  uuid references public.profiles(id) on delete set null,
  add column if not exists teacher_feedback_at  timestamptz;

comment on column public.submissions.teacher_feedback is
  'Manual feedback written by the assigned teacher or an admin. Students have read-only access (enforced by guard_submission_feedback).';
comment on column public.submissions.teacher_score is
  'Optional manual score that overrides the automatic AI score in the learner UI.';
comment on column public.submissions.teacher_feedback_by is
  'Profile id of the teacher/admin who wrote the feedback. Set automatically by the guard trigger.';

-- Fast lookup of "submissions from my students still awaiting review"
create index if not exists idx_submissions_pending_review
  on public.submissions(created_at desc)
  where teacher_feedback is null;

create index if not exists idx_submissions_teacher_reviewed
  on public.submissions(teacher_feedback_by, teacher_feedback_at desc);

-- ------------------------------------------------------------
-- 2) Column-level guard for teacher feedback
-- ------------------------------------------------------------
create or replace function public.guard_submission_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed boolean;
begin
  changed :=
        new.teacher_feedback is distinct from old.teacher_feedback
     or new.teacher_score    is distinct from old.teacher_score;

  if not changed then
    -- Nothing privileged is being touched; leave the row alone but make
    -- sure nobody can forge the authorship metadata on an unrelated write.
    new.teacher_feedback_by := old.teacher_feedback_by;
    new.teacher_feedback_at := old.teacher_feedback_at;
    return new;
  end if;

  -- Trusted backend (service_role) — auth.uid() is null there.
  if auth.uid() is null
     or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
  then
    new.teacher_feedback_at := coalesce(new.teacher_feedback_at, now());
    return new;
  end if;

  -- Admins, and teachers of THIS student, may write feedback.
  if public.is_admin() or (public.is_teacher() and public.teaches(new.user_id)) then
    new.teacher_feedback_by := auth.uid();
    new.teacher_feedback_at := now();
    return new;
  end if;

  -- Everyone else (including the student who owns the row) is read-only.
  raise exception
    'only the assigned teacher or an admin may write teacher feedback'
    using errcode = 'insufficient_privilege';
end $$;

comment on function public.guard_submission_feedback() is
  'Column-level protection for submissions.teacher_feedback / teacher_score. RLS is row-level only, so authorship is enforced here.';

drop trigger if exists trg_guard_submission_feedback on public.submissions;
create trigger trg_guard_submission_feedback
  before update on public.submissions
  for each row execute function public.guard_submission_feedback();

-- Feedback cannot be pre-filled at insert time by a student either.
create or replace function public.guard_submission_feedback_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.teacher_feedback is null and new.teacher_score is null then
    return new;
  end if;

  if auth.uid() is null
     or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     or public.is_admin()
     or (public.is_teacher() and public.teaches(new.user_id))
  then
    new.teacher_feedback_by := coalesce(new.teacher_feedback_by, auth.uid());
    new.teacher_feedback_at := coalesce(new.teacher_feedback_at, now());
    return new;
  end if;

  raise exception
    'only the assigned teacher or an admin may write teacher feedback'
    using errcode = 'insufficient_privilege';
end $$;

drop trigger if exists trg_guard_submission_feedback_ins on public.submissions;
create trigger trg_guard_submission_feedback_ins
  before insert on public.submissions
  for each row execute function public.guard_submission_feedback_insert();

-- ------------------------------------------------------------
-- 3) Teacher roster helper
--    Returns the caller's students. SECURITY DEFINER so the teacher
--    dashboard can aggregate without tripping RLS recursion, but it
--    only ever returns rows the caller is already entitled to see.
-- ------------------------------------------------------------
create or replace function public.my_students()
returns table (
  id             uuid,
  full_name      text,
  email          text,
  current_level  cefr_level,
  target_level   cefr_level,
  streak_days    int,
  last_active_on date,
  placement_done boolean,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.email, p.current_level, p.target_level,
         p.streak_days, p.last_active_on, p.placement_done, p.created_at
  from public.profiles p
  where p.role = 'student'
    and (
      p.teacher_id = auth.uid()
      or public.is_admin()
    )
  order by p.full_name nulls last;
$$;

comment on function public.my_students() is
  'Roster for the signed-in teacher (all students for an admin).';

grant execute on function public.my_students() to authenticated;
grant execute on function public.guard_submission_feedback() to authenticated;
