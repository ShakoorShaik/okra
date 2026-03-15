-- Project Okra: Run in Supabase SQL Editor

-- 1. Drop old reports table if exists (migrating from Fix6ix)
drop table if exists public.reports;

-- 2. Create appointments table
create table if not exists public.appointments (
  id                text primary key,
  requestor_id      text,
  requestor_name    text not null,
  requestor_address text,
  provider_id       text,
  provider_name     text,
  status            text not null default 'pending',
  time_preference   text not null,
  services_requested text[] not null default '{}',
  highest_urgency   text not null,
  watsonx_care_plan jsonb,
  location_lat      double precision not null,
  location_lng      double precision not null,
  notes             text,
  created_at        timestamptz not null default now(),
  scheduled_for     timestamptz
);

-- 3. RLS
alter table public.appointments enable row level security;
create policy "Public read" on public.appointments for select using (true);
create policy "Public insert" on public.appointments for insert with check (true);
create policy "Public update" on public.appointments for update using (true);

-- 4. Realtime
alter publication supabase_realtime add table public.appointments;

-- 5. Profiles (linked to Supabase Auth users)
create table if not exists public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  name          text not null,
  role          text not null check (role in ('requestor', 'provider')),
  location_lat  float8 not null default 43.6532,
  location_lng  float8 not null default -79.3832,
  created_at    timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can read own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
