-- ============================================================
-- زبان‌یار | Row Level Security + Policies
-- Migration: 0002_rls_policies
-- Rules:
--   student  -> only own rows
--   teacher  -> own rows + rows of assigned students
--   admin    -> full access
-- ============================================================

-- ---------- helper functions (SECURITY DEFINER, avoid RLS recursion) ----------
create or replace function public.current_role_of()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'admin', false);
$$;

create or replace function public.is_teacher()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'teacher', false);
$$;

-- is the given user a student of the current teacher?
create or replace function public.teaches(target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target and p.teacher_id = auth.uid()
  );
$$;

-- one predicate to rule them all
create or replace function public.can_access(target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() = target
      or public.is_admin()
      or (public.is_teacher() and public.teaches(target));
$$;

grant execute on function public.current_role_of, public.is_admin, public.is_teacher,
                        public.teaches(uuid), public.can_access(uuid) to authenticated;

-- ---------- enable RLS everywhere ----------
alter table public.profiles          enable row level security;
alter table public.skill_levels      enable row level security;
alter table public.placement_tests   enable row level security;
alter table public.lessons           enable row level security;
alter table public.exercises         enable row level security;
alter table public.assignments       enable row level security;
alter table public.submissions       enable row level security;
alter table public.mistakes_memory   enable row level security;
alter table public.vocabulary_memory enable row level security;
alter table public.conversations     enable row level security;
alter table public.messages          enable row level security;
alter table public.learning_history  enable row level security;
alter table public.progress_reports  enable row level security;
alter table public.ai_memory         enable row level security;

-- ============================================================
-- PROFILES
-- ============================================================
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using ( id = auth.uid() or public.is_admin() or (public.is_teacher() and teacher_id = auth.uid()) );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check ( id = auth.uid() or public.is_admin() );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using ( id = auth.uid() or public.is_admin() )
  with check ( id = auth.uid() or public.is_admin() );

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using ( public.is_admin() );

-- prevent students from escalating their own role / subscription
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    return new;
  end if;
  new.role         := old.role;
  new.subscription := old.subscription;
  new.teacher_id   := old.teacher_id;
  return new;
end $$;

drop trigger if exists trg_guard_profile on public.profiles;
create trigger trg_guard_profile before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ============================================================
-- GENERIC user_id-scoped tables
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'skill_levels','placement_tests','assignments','submissions',
    'mistakes_memory','vocabulary_memory','conversations',
    'learning_history','progress_reports','ai_memory'
  ]
  loop
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated using ( public.can_access(user_id) );', t, t);

    execute format('drop policy if exists %I_insert on public.%I;', t, t);
    execute format(
      'create policy %I_insert on public.%I for insert to authenticated with check ( user_id = auth.uid() or public.is_admin() or (public.is_teacher() and public.teaches(user_id)) );', t, t);

    execute format('drop policy if exists %I_update on public.%I;', t, t);
    execute format(
      'create policy %I_update on public.%I for update to authenticated using ( public.can_access(user_id) ) with check ( public.can_access(user_id) );', t, t);

    execute format('drop policy if exists %I_delete on public.%I;', t, t);
    execute format(
      'create policy %I_delete on public.%I for delete to authenticated using ( user_id = auth.uid() or public.is_admin() );', t, t);
  end loop;
end $$;

-- ============================================================
-- LESSONS  (user_id NULL = global curated content, readable by all)
-- ============================================================
drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons for select to authenticated
  using ( user_id is null or public.can_access(user_id) );

drop policy if exists lessons_insert on public.lessons;
create policy lessons_insert on public.lessons for insert to authenticated
  with check ( user_id = auth.uid() or public.is_admin() or (public.is_teacher() and public.teaches(user_id)) );

drop policy if exists lessons_update on public.lessons;
create policy lessons_update on public.lessons for update to authenticated
  using ( (user_id is not null and public.can_access(user_id)) or public.is_admin() )
  with check ( (user_id is not null and public.can_access(user_id)) or public.is_admin() );

drop policy if exists lessons_delete on public.lessons;
create policy lessons_delete on public.lessons for delete to authenticated
  using ( user_id = auth.uid() or public.is_admin() );

-- ============================================================
-- EXERCISES  (inherit from lesson, or own user_id)
-- ============================================================
drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises for select to authenticated
  using (
    (user_id is not null and public.can_access(user_id))
    or exists (
      select 1 from public.lessons l
      where l.id = exercises.lesson_id
        and (l.user_id is null or public.can_access(l.user_id))
    )
  );

drop policy if exists exercises_insert on public.exercises;
create policy exercises_insert on public.exercises for insert to authenticated
  with check ( user_id = auth.uid() or public.is_admin() or (public.is_teacher() and public.teaches(user_id)) );

drop policy if exists exercises_update on public.exercises;
create policy exercises_update on public.exercises for update to authenticated
  using ( (user_id is not null and public.can_access(user_id)) or public.is_admin() )
  with check ( (user_id is not null and public.can_access(user_id)) or public.is_admin() );

drop policy if exists exercises_delete on public.exercises;
create policy exercises_delete on public.exercises for delete to authenticated
  using ( user_id = auth.uid() or public.is_admin() );

-- ============================================================
-- MESSAGES  (scoped through conversation ownership)
-- ============================================================
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
  using ( public.can_access(user_id) );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );

drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated
  using ( user_id = auth.uid() or public.is_admin() );

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars','avatars', true, 2097152, array['image/png','image/jpeg','image/webp']),
  ('speech','speech', false, 10485760, array['audio/webm','audio/mpeg','audio/wav','audio/ogg','audio/mp4']),
  ('submissions','submissions', false, 20971520, null)
on conflict (id) do nothing;

-- avatars: public read, own write
drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select
  using ( bucket_id = 'avatars' );

drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for insert to authenticated
  with check ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects for update to authenticated
  using ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using ( bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text );

-- private buckets: owner-folder access only
drop policy if exists private_read on storage.objects;
create policy private_read on storage.objects for select to authenticated
  using (
    bucket_id in ('speech','submissions')
    and ( (storage.foldername(name))[1] = auth.uid()::text
          or public.is_admin()
          or (public.is_teacher() and public.teaches(((storage.foldername(name))[1])::uuid)) )
  );

drop policy if exists private_write on storage.objects;
create policy private_write on storage.objects for insert to authenticated
  with check (
    bucket_id in ('speech','submissions')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists private_delete on storage.objects;
create policy private_delete on storage.objects for delete to authenticated
  using (
    bucket_id in ('speech','submissions')
    and ( (storage.foldername(name))[1] = auth.uid()::text or public.is_admin() )
  );
