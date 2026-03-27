-- Adapted schema for Neon/Postgres
-- This is derived from `supabase/schema.sql` but replaces Supabase-specific
-- `auth.uid()` and `auth.role()` calls with session settings that your
-- application server must set before running queries:
--   set_config('app.current_user_id', '<uuid>', true);
--   set_config('app.current_user_role', '<role>', true);
-- The server should set these per-connection or per-transaction to enable
-- RLS-style policies in Neon.

-- Supabase SQL schema for Liquidate (Neon-adapted)

-- Enable uuid-ossp if needed
-- create extension if not exists "uuid-ossp";

-- Enable pgcrypto for gen_random_uuid() (Neon/postgres)
create extension if not exists pgcrypto;

create table if not exists liquidate_profiles (
  id uuid primary key,
  first_name text,
  last_name text,
  email text,
  created_at timestamptz default now()
);

create index if not exists liquidate_profiles_email_idx on liquidate_profiles(email);

create table if not exists liquidate_users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  password_hash text not null,
  role text not null default 'user',
  created_at timestamptz default now()
);

create table if not exists liquidate_activities (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  created_by uuid references liquidate_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists liquidate_activity_members (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references liquidate_activities(id) on delete cascade,
  user_id uuid references liquidate_profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(activity_id, user_id)
);

create table if not exists liquidate_expenses (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references liquidate_activities(id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null,
  total_amount numeric(12,2) not null,
  paid_by uuid references liquidate_profiles(id) on delete set null,
  created_by uuid references liquidate_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists liquidate_expense_splits (
  id uuid default gen_random_uuid() primary key,
  expense_id uuid references liquidate_expenses(id) on delete cascade,
  user_id uuid references liquidate_profiles(id) on delete cascade,
  owed_to uuid references liquidate_profiles(id) on delete set null,
  amount numeric(12,2) not null,
  status text check (status in ('pending','paid')) default 'pending',
  created_at timestamptz default now()
);

create table if not exists liquidate_payments (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references liquidate_activities(id) on delete cascade,
  paid_by uuid references liquidate_profiles(id) on delete set null,
  paid_to uuid references liquidate_profiles(id) on delete set null,
  amount numeric(12,2) not null,
  payment_date timestamptz not null default now(),
  created_at timestamptz default now()
);

-- Enable RLS (optional) - policies below reference session settings
alter table if exists liquidate_profiles enable row level security;
alter table if exists liquidate_activities enable row level security;
alter table if exists liquidate_activity_members enable row level security;
alter table if exists liquidate_expenses enable row level security;
alter table if exists liquidate_expense_splits enable row level security;
alter table if exists liquidate_payments enable row level security;

-- Drop existing policies (idempotent script run)
drop policy if exists "profiles_select" on liquidate_profiles;
drop policy if exists "profiles_insert" on liquidate_profiles;
drop policy if exists "profiles_update" on liquidate_profiles;
drop policy if exists "profiles_delete" on liquidate_profiles;

drop policy if exists "activities_select_if_member_or_owner" on liquidate_activities;
drop policy if exists "activities_insert_authenticated" on liquidate_activities;
drop policy if exists "activities_owner_update" on liquidate_activities;
drop policy if exists "activities_owner_delete" on liquidate_activities;

drop policy if exists "activity_members_insert" on liquidate_activity_members;
drop policy if exists "activity_members_select" on liquidate_activity_members;

drop policy if exists "expenses_members" on liquidate_expenses;
drop policy if exists "expenses_insert" on liquidate_expenses;

drop policy if exists "expense_splits_select_involved" on liquidate_expense_splits;
drop policy if exists "expense_splits_insert" on liquidate_expense_splits;

drop policy if exists "payments_select_participant" on liquidate_payments;
drop policy if exists "payments_insert" on liquidate_payments;

-- Helper function: uses activity_members to check membership
create or replace function public.is_activity_member(aid uuid, uid uuid)
returns boolean language sql stable as $$
  select exists(select 1 from liquidate_activity_members where activity_id = aid and user_id = uid);
$$;

-- Replace auth.uid() with session setting 'app.current_user_id'
-- and auth.role() with 'app.current_user_role'. The application server
-- must set these using set_config before executing queries when RLS is enabled.

create policy "profiles_select" on liquidate_profiles
  for select using ((current_setting('app.current_user_id', true))::uuid = id);

create policy "profiles_insert" on liquidate_profiles
  for insert with check ((current_setting('app.current_user_id', true))::uuid = id);

create policy "profiles_update" on liquidate_profiles
  for update using ((current_setting('app.current_user_id', true))::uuid = id) with check ((current_setting('app.current_user_id', true))::uuid = id);

create policy "profiles_delete" on liquidate_profiles
  for delete using ((current_setting('app.current_user_id', true))::uuid = id);

create policy "activities_select_if_member_or_owner" on liquidate_activities
  for select using (
    public.is_activity_member(liquidate_activities.id, (current_setting('app.current_user_id', true))::uuid) OR created_by = (current_setting('app.current_user_id', true))::uuid
  );

create policy "activities_insert_authenticated" on liquidate_activities
  for insert with check ((current_setting('app.current_user_role', true)) = 'authenticated' AND (created_by = (current_setting('app.current_user_id', true))::uuid OR created_by IS NULL));

create policy "activities_owner_update" on liquidate_activities
  for update using ((current_setting('app.current_user_role', true)) = 'authenticated' AND created_by = (current_setting('app.current_user_id', true))::uuid) with check ((current_setting('app.current_user_role', true)) = 'authenticated' AND created_by = (current_setting('app.current_user_id', true))::uuid);

create policy "activities_owner_delete" on liquidate_activities
  for delete using ((current_setting('app.current_user_role', true)) = 'authenticated' AND created_by = (current_setting('app.current_user_id', true))::uuid);

create or replace function public.set_activity_created_by()
returns trigger language plpgsql security definer as $$
begin
  if new.created_by is null then
    begin
      new.created_by := (current_setting('app.current_user_id', true))::uuid;
    exception when others then
      -- leave null if no session var available
      new.created_by := null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_activity_created_by on liquidate_activities;
create trigger trg_set_activity_created_by
before insert on liquidate_activities
for each row execute function public.set_activity_created_by();

create policy "activity_members_insert" on liquidate_activity_members
  for insert with check (
    (current_setting('app.current_user_role', true)) = 'authenticated' AND (user_id = (current_setting('app.current_user_id', true))::uuid or exists (select 1 from liquidate_activities a where a.id = liquidate_activity_members.activity_id and a.created_by = (current_setting('app.current_user_id', true))::uuid))
  );

create policy "activity_members_select" on liquidate_activity_members
  for select using (
    user_id = (current_setting('app.current_user_id', true))::uuid or public.is_activity_member(liquidate_activity_members.activity_id, (current_setting('app.current_user_id', true))::uuid)
  );

create policy "expenses_members" on liquidate_expenses
  for select using (
    public.is_activity_member(liquidate_expenses.activity_id, (current_setting('app.current_user_id', true))::uuid)
  );

create policy "expenses_insert" on liquidate_expenses
  for insert with check ((current_setting('app.current_user_role', true)) = 'authenticated');

create policy "expense_splits_select_involved" on liquidate_expense_splits
  for select using (
    user_id = (current_setting('app.current_user_id', true))::uuid or owed_to = (current_setting('app.current_user_id', true))::uuid or public.is_activity_member((select activity_id from liquidate_expenses e where e.id = liquidate_expense_splits.expense_id), (current_setting('app.current_user_id', true))::uuid)
  );

create policy "expense_splits_insert" on liquidate_expense_splits
  for insert with check ((current_setting('app.current_user_role', true)) = 'authenticated');

create policy "payments_select_participant" on liquidate_payments
  for select using (
    public.is_activity_member(liquidate_payments.activity_id, (current_setting('app.current_user_id', true))::uuid)
  );

create policy "payments_insert" on liquidate_payments
  for insert with check ((current_setting('app.current_user_role', true)) = 'authenticated');

create index if not exists liquidate_expense_splits_user_idx on liquidate_expense_splits(user_id);
create index if not exists liquidate_expense_splits_owed_to_idx on liquidate_expense_splits(owed_to);

create or replace function public.delete_expense_and_splits(eid uuid)
returns void language plpgsql security definer as $$
begin
  delete from liquidate_expense_splits where expense_id = eid;
  delete from liquidate_expenses where id = eid;
end;
$$;

-- IMPORTANT: Your application server MUST set the session vars `app.current_user_id`
-- and `app.current_user_role` before executing queries if you want RLS to
-- enforce per-user policies. Example (psql/session):
--   SELECT set_config('app.current_user_id', '3c9f...-uuid', true);
--   SELECT set_config('app.current_user_role', 'authenticated', true);

-- Compatibility views
--
-- To make a gradual migration easier, the script creates read-only views that
-- expose the original, unprefixed table names (e.g. `profiles`) mapped to the
-- new `liquidate_` tables. These views are optional and safe to use while
-- you update tooling or third-party scripts that still reference the old
-- names. They do not bypass RLS: policies attached to the underlying tables
-- still apply.

-- Create or replace views for compatibility (idempotent)
create or replace view profiles as select * from liquidate_profiles;
create or replace view users as select * from liquidate_users;
create or replace view activities as select * from liquidate_activities;
create or replace view activity_members as select * from liquidate_activity_members;
create or replace view expenses as select * from liquidate_expenses;
create or replace view expense_splits as select * from liquidate_expense_splits;
create or replace view payments as select * from liquidate_payments;

-- If you prefer to remove compatibility views later, run:
--   drop view if exists profiles, users, activities, activity_members, expenses, expense_splits, payments;
