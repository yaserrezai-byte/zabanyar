-- ============================================================
-- زبان‌یار | Fix: role guard must not block backend/service_role
-- Migration: 0003_fix_role_guard
--
-- Problem found by tests/rls.mjs:
--   trg_guard_profile reverted role / subscription / teacher_id for
--   EVERY caller whose auth.uid() is not an admin. For the
--   service_role backend auth.uid() is NULL, so legitimate
--   server-side updates (assigning a teacher, upgrading a plan,
--   promoting an admin) were silently rolled back.
--
-- Fix: the guard now applies only to genuine end-user sessions.
-- ============================================================

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted backend (service_role key) or internal/no-JWT context:
  -- allow the write through untouched.
  if auth.uid() is null
     or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     or coalesce(current_setting('role', true), '') = 'service_role'
  then
    return new;
  end if;

  -- Admins may change privileged columns.
  if public.is_admin() then
    return new;
  end if;

  -- Everyone else: privileged columns are immutable.
  new.role         := old.role;
  new.subscription := old.subscription;
  new.teacher_id   := old.teacher_id;
  return new;
end $$;

comment on function public.guard_profile_update() is
  'Prevents end users from escalating role/subscription/teacher_id. Backend (service_role) and admins are exempt.';
