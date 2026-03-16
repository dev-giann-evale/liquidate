-- Supabase SQL schema for Liquidate
-- Tables: profiles, activities, activity_members, expenses, expense_splits, payments

-- Enable uuid-ossp (if needed in some Postgres setups)
-- create extension if not exists "uuid-ossp";

-- profiles: linked to auth.users
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  first_name text,
  last_name text,
  email text,
  created_at timestamptz default now()
);

create index if not exists profiles_email_idx on profiles(email);

-- activities
create table if not exists activities (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- activity_members
create table if not exists activity_members (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references activities(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(activity_id, user_id)
);

-- expenses
create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references activities(id) on delete cascade,
  title text not null,
  total_amount numeric(12,2) not null,
  paid_by uuid references profiles(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- expense_splits
create table if not exists expense_splits (
  id uuid default gen_random_uuid() primary key,
  expense_id uuid references expenses(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  owed_to uuid references profiles(id) on delete set null,
  amount numeric(12,2) not null,
  status text check (status in ('pending','paid')) default 'pending',
  created_at timestamptz default now()
);

-- payments (audit trail)
create table if not exists payments (
  id uuid default gen_random_uuid() primary key,
  activity_id uuid references activities(id) on delete cascade,
  paid_by uuid references profiles(id) on delete set null,
  paid_to uuid references profiles(id) on delete set null,
  amount numeric(12,2) not null,
  payment_date timestamptz not null default now(),
  created_at timestamptz default now()
);

-- Example RLS policies (enable RLS per table as needed)
-- Grant read access to authenticated users and then lock down with policies

-- Enable RLS
alter table if exists profiles enable row level security;
alter table if exists activities enable row level security;
alter table if exists activity_members enable row level security;
alter table if exists expenses enable row level security;
alter table if exists expense_splits enable row level security;
alter table if exists payments enable row level security;

-- If this script is re-run, remove existing policies to avoid duplicates
drop policy if exists "profiles_select" on profiles;
drop policy if exists "profiles_insert" on profiles;
drop policy if exists "profiles_update" on profiles;
drop policy if exists "profiles_delete" on profiles;

drop policy if exists "activities_select_if_member" on activities;
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


-- Helper: check whether a user is a member of an activity.
-- Use SECURITY DEFINER so RLS does not apply when this function runs inside policies.
create or replace function public.is_activity_member(aid uuid, uid uuid)
returns boolean language sql security definer stable as $$
  select exists(select 1 from activity_members where activity_id = aid and user_id = uid);
$$;

-- Profiles policies: allow only the owner to see/modify their profile
create policy "profiles_select" on profiles
  for select using (auth.uid() = id);

create policy "profiles_insert" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_delete" on profiles
  for delete using (auth.uid() = id);

-- Activities: allow select if user is a member or the activity creator; insert if authenticated; update/delete only if owner
create policy "activities_select_if_member_or_owner" on activities
  for select using (
    public.is_activity_member(activities.id, auth.uid()) OR created_by = auth.uid()
  );

-- Allow authenticated users to create activities. If the client doesn't supply
-- created_by we accept NULL here and a trigger will set created_by := auth.uid().
create policy "activities_insert_authenticated" on activities
  for insert with check (auth.role() = 'authenticated' AND (created_by = auth.uid() OR created_by IS NULL));

-- Only the activity creator (owner) can update the record. Require authenticated role explicitly.
create policy "activities_owner_update" on activities
  for update using (auth.role() = 'authenticated' AND created_by = auth.uid()) with check (auth.role() = 'authenticated' AND created_by = auth.uid());

-- Only the activity creator (owner) can delete the record. Require authenticated role explicitly.
create policy "activities_owner_delete" on activities
  for delete using (auth.role() = 'authenticated' AND created_by = auth.uid());

-- If the client does not pass `created_by`, set it automatically to the
-- authenticated user. This avoids RLS insert failures when the frontend omits
-- the field and is simpler than requiring every client to include it.
create or replace function public.set_activity_created_by()
returns trigger language plpgsql security definer as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_activity_created_by on activities;
create trigger trg_set_activity_created_by
before insert on activities
for each row execute function public.set_activity_created_by();

-- activity_members: allow users to insert themselves or allow activity creator to add members
create policy "activity_members_insert" on activity_members
  for insert with check (
    auth.role() = 'authenticated' AND (user_id = auth.uid() or exists (select 1 from activities a where a.id = activity_members.activity_id and a.created_by = auth.uid()))
  );

create policy "activity_members_select" on activity_members
  for select using (
    user_id = auth.uid() or public.is_activity_member(activity_members.activity_id, auth.uid())
  );

-- expenses: allow members to insert and select expenses for activities they belong to
create policy "expenses_members" on expenses
  for select using (
    public.is_activity_member(expenses.activity_id, auth.uid())
  );

create policy "expenses_insert" on expenses
  for insert with check (auth.role() = 'authenticated');

-- expense_splits: only visible to the user involved or the owed_to (payer)
create policy "expense_splits_select_involved" on expense_splits
  for select using (
    user_id = auth.uid() or owed_to = auth.uid() or public.is_activity_member((select activity_id from expenses e where e.id = expense_splits.expense_id), auth.uid())
  );

create policy "expense_splits_insert" on expense_splits
  for insert with check (auth.role() = 'authenticated');

-- payments: allow select for participants, insert by authenticated
create policy "payments_select_participant" on payments
  for select using (
    public.is_activity_member(payments.activity_id, auth.uid())
  );

create policy "payments_insert" on payments
  for insert with check (auth.role() = 'authenticated');

-- Indexes for common queries
create index if not exists expense_splits_user_idx on expense_splits(user_id);
create index if not exists expense_splits_owed_to_idx on expense_splits(owed_to);

-- Note: Client-side sessions are handled via Supabase Auth (JWTs). We
-- removed the DB-backed `sessions` table in favor of using Supabase Auth
-- client-side sessions. Configure the JWT/session lifetime in
-- `supabase/config.toml` (see `auth.jwt_expiry = 3600` for 1-hour expiry).

