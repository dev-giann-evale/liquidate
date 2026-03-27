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

create table if not exists profiles (
  id uuid primary key,
  first_name text,
  last_name text,
  email text,
  created_at timestamptz default now()
);

create index if not exists profiles_email_idx on profiles(email);

-- users table for authentication (password hash stored here)
create table if not exists users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

create table if not exists activities (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists activity_members (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references activities(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(activity_id, user_id)
);

create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references activities(id) on delete cascade,
  title text not null,
  total_amount numeric(12,2) not null,
  paid_by uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists expense_splits (
  id uuid default gen_random_uuid() primary key,
  expense_id uuid references expenses(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  owed_to uuid references profiles(id) on delete set null,
  amount numeric(12,2) not null,
  status text check (status in ('pending','paid')) default 'pending',
  created_at timestamptz default now()
);

create table if not exists payments (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references activities(id) on delete cascade,
  paid_by uuid references profiles(id) on delete set null,
  paid_to uuid references profiles(id) on delete set null,
  amount numeric(12,2) not null,
  payment_date timestamptz not null default now(),
  created_at timestamptz default now()
);

-- Enable RLS (optional) - policies below reference session settings
alter table if exists profiles enable row level security;
alter table if exists activities enable row level security;
alter table if exists activity_members enable row level security;
alter table if exists expenses enable row level security;
alter table if exists expense_splits enable row level security;
alter table if exists payments enable row level security;

-- Drop existing policies (idempotent script run)
drop policy if exists "profiles_select" on profiles;
drop policy if exists "profiles_insert" on profiles;
drop policy if exists "profiles_update" on profiles;
drop policy if exists "profiles_delete" on profiles;

drop policy if exists "activities_select_if_member_or_owner" on activities;
drop policy if exists "activities_insert_authenticated" on activities;
drop policy if exists "activities_owner_update" on activities;
drop policy if exists "activities_owner_delete" on activities;

drop policy if exists "activity_members_insert" on activity_members;
drop policy if exists "activity_members_select" on activity_members;

drop policy if exists "expenses_members" on expenses;
drop policy if exists "expenses_insert" on expenses;

drop policy if exists "expense_splits_select_involved" on expense_splits;
drop policy if exists "expense_splits_insert" on expense_splits;

drop policy if exists "payments_select_participant" on payments;
drop policy if exists "payments_insert" on payments;

-- Helper function: uses activity_members to check membership
create or replace function public.is_activity_member(aid uuid, uid uuid)
returns boolean language sql stable as $$
  select exists(select 1 from activity_members where activity_id = aid and user_id = uid);
$$;

-- Replace auth.uid() with session setting 'app.current_user_id'
-- and auth.role() with 'app.current_user_role'. The application server
-- must set these using set_config before executing queries when RLS is enabled.

create policy "profiles_select" on profiles
  for select using ((current_setting('app.current_user_id', true))::uuid = id);

create policy "profiles_insert" on profiles
  for insert with check ((current_setting('app.current_user_id', true))::uuid = id);

create policy "profiles_update" on profiles
  for update using ((current_setting('app.current_user_id', true))::uuid = id) with check ((current_setting('app.current_user_id', true))::uuid = id);

create policy "profiles_delete" on profiles
  for delete using ((current_setting('app.current_user_id', true))::uuid = id);

create policy "activities_select_if_member_or_owner" on activities
  for select using (
    public.is_activity_member(activities.id, (current_setting('app.current_user_id', true))::uuid) OR created_by = (current_setting('app.current_user_id', true))::uuid
  );

create policy "activities_insert_authenticated" on activities
  for insert with check ((current_setting('app.current_user_role', true)) = 'authenticated' AND (created_by = (current_setting('app.current_user_id', true))::uuid OR created_by IS NULL));

create policy "activities_owner_update" on activities
  for update using ((current_setting('app.current_user_role', true)) = 'authenticated' AND created_by = (current_setting('app.current_user_id', true))::uuid) with check ((current_setting('app.current_user_role', true)) = 'authenticated' AND created_by = (current_setting('app.current_user_id', true))::uuid);

create policy "activities_owner_delete" on activities
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

drop trigger if exists trg_set_activity_created_by on activities;
create trigger trg_set_activity_created_by
before insert on activities
for each row execute function public.set_activity_created_by();

create policy "activity_members_insert" on activity_members
  for insert with check (
    (current_setting('app.current_user_role', true)) = 'authenticated' AND (user_id = (current_setting('app.current_user_id', true))::uuid or exists (select 1 from activities a where a.id = activity_members.activity_id and a.created_by = (current_setting('app.current_user_id', true))::uuid))
  );

create policy "activity_members_select" on activity_members
  for select using (
    user_id = (current_setting('app.current_user_id', true))::uuid or public.is_activity_member(activity_members.activity_id, (current_setting('app.current_user_id', true))::uuid)
  );

create policy "expenses_members" on expenses
  for select using (
    public.is_activity_member(expenses.activity_id, (current_setting('app.current_user_id', true))::uuid)
  );

create policy "expenses_insert" on expenses
  for insert with check ((current_setting('app.current_user_role', true)) = 'authenticated');

create policy "expense_splits_select_involved" on expense_splits
  for select using (
    user_id = (current_setting('app.current_user_id', true))::uuid or owed_to = (current_setting('app.current_user_id', true))::uuid or public.is_activity_member((select activity_id from expenses e where e.id = expense_splits.expense_id), (current_setting('app.current_user_id', true))::uuid)
  );

create policy "expense_splits_insert" on expense_splits
  for insert with check ((current_setting('app.current_user_role', true)) = 'authenticated');

create policy "payments_select_participant" on payments
  for select using (
    public.is_activity_member(payments.activity_id, (current_setting('app.current_user_id', true))::uuid)
  );

create policy "payments_insert" on payments
  for insert with check ((current_setting('app.current_user_role', true)) = 'authenticated');

create index if not exists expense_splits_user_idx on expense_splits(user_id);
create index if not exists expense_splits_owed_to_idx on expense_splits(owed_to);

create or replace function public.delete_expense_and_splits(eid uuid)
returns void language plpgsql security definer as $$
begin
  delete from expense_splits where expense_id = eid;
  delete from expenses where id = eid;
end;
$$;

-- IMPORTANT: Your application server MUST set the session vars `app.current_user_id`
-- and `app.current_user_role` before executing queries if you want RLS to
-- enforce per-user policies. Example (psql/session):
--   SELECT set_config('app.current_user_id', '3c9f...-uuid', true);
--   SELECT set_config('app.current_user_role', 'authenticated', true);
