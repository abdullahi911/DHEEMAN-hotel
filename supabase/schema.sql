-- ========================================================
-- DHEEMAN RESTAURANT MANAGEMENT — SUPABASE SCHEMA & RLS
-- Copy and run this entire file in Supabase SQL Editor
-- ========================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE (Linked to Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text default 'manager',
  created_at timestamptz not null default now()
);

-- Trigger to automatically create a profile entry when a user signs in with Gmail/Google
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2. EXPENSES TABLE
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  type text not null check (type in ('cash', 'debt')),
  item text not null,
  amount numeric(12, 2) not null default 0,
  note text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- 3. INVENTORY ITEMS TABLE
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  item text not null,
  unit text not null default 'kiish',
  stocked numeric(12, 2) not null default 0,
  used numeric(12, 2) not null default 0,
  unit_cost numeric(12, 2) not null default 0,
  stocked_date date not null default current_date,
  finished_date date,
  created_at timestamptz not null default now()
);

-- 4. INVENTORY USAGE TABLE
create table if not exists public.inventory_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  item text not null,
  quantity numeric(12, 2) not null default 0,
  unit text not null default 'kiish',
  cost numeric(12, 2) not null default 0,
  usage_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- 5. SALES TABLE
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  item text not null,
  amount numeric(12, 2) not null default 0,
  sale_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- 6. DEBTS & MARKETS TABLE (Dayn & Suuqyo)
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  market_name text not null,
  supplier_phone text,
  item_description text not null,
  total_amount numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  debt_date date not null default current_date,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid')),
  notes text,
  created_at timestamptz not null default now()
);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures only authenticated users can access their data
-- ========================================================

alter table public.profiles enable row level security;
alter table public.expenses enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_usage enable row level security;
alter table public.sales enable row level security;
alter table public.debts enable row level security;

-- PROFILES POLICIES
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- EXPENSES POLICIES
drop policy if exists "Authenticated users manage own expenses" on public.expenses;
create policy "Authenticated users manage own expenses" on public.expenses
  for all to authenticated
  using (auth.uid() = user_id or user_id is null)
  with check (auth.uid() = user_id or user_id is null);

-- INVENTORY ITEMS POLICIES
drop policy if exists "Authenticated users manage own inventory" on public.inventory_items;
create policy "Authenticated users manage own inventory" on public.inventory_items
  for all to authenticated
  using (auth.uid() = user_id or user_id is null)
  with check (auth.uid() = user_id or user_id is null);

-- INVENTORY USAGE POLICIES
drop policy if exists "Authenticated users manage own usage" on public.inventory_usage;
create policy "Authenticated users manage own usage" on public.inventory_usage
  for all to authenticated
  using (auth.uid() = user_id or user_id is null)
  with check (auth.uid() = user_id or user_id is null);

-- SALES POLICIES
drop policy if exists "Authenticated users manage own sales" on public.sales;
create policy "Authenticated users manage own sales" on public.sales
  for all to authenticated
  using (auth.uid() = user_id or user_id is null)
  with check (auth.uid() = user_id or user_id is null);

-- DEBTS POLICIES
drop policy if exists "Authenticated users manage own debts" on public.debts;
create policy "Authenticated users manage own debts" on public.debts
  for all to authenticated
  using (auth.uid() = user_id or user_id is null)
  with check (auth.uid() = user_id or user_id is null);

