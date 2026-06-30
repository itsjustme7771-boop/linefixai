-- MTTR.ai / linefixai — initial schema
-- Run via: supabase db push   (after supabase link)

-- ── Profiles (extends auth.users) ───────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  name       text not null default '',
  role       text not null default 'technician'
             check (role in ('technician', 'lead', 'management')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'user'), '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'technician')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Diagnostic sessions ─────────────────────────────────────────────────────
create table if not exists public.diagnostic_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  equipment_id  text,
  issue         text not null,
  response      text not null default '',
  outcome       text check (outcome in ('fixed', 'refine')),
  created_at    timestamptz not null default now()
);

alter table public.diagnostic_sessions enable row level security;

create policy "diagnostic_sessions_select_own"
  on public.diagnostic_sessions for select
  using (auth.uid() = user_id);

create policy "diagnostic_sessions_insert_own"
  on public.diagnostic_sessions for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "diagnostic_sessions_update_own"
  on public.diagnostic_sessions for update
  using (auth.uid() = user_id);

create index if not exists diagnostic_sessions_user_created_idx
  on public.diagnostic_sessions (user_id, created_at desc);

-- ── Cross-Fix Cards ─────────────────────────────────────────────────────────
create table if not exists public.cross_fix_cards (
  id                 uuid primary key default gen_random_uuid(),
  code               text,
  title              text not null,
  equipment_id       text,
  equipment_name     text,
  plant              text,
  author             text,
  author_role        text check (author_role in ('technician', 'lead', 'management')),
  time_to_fix        text,
  symptoms           text,
  root_cause         text,
  solution           text,
  parts              jsonb not null default '[]'::jsonb,
  tags               jsonb not null default '[]'::jsonb,
  status             text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected')),
  helpful            integer not null default 0,
  source_session_id  uuid references public.diagnostic_sessions(id) on delete set null,
  approved_by        text,
  approved_at        timestamptz,
  created_at         timestamptz not null default now()
);

alter table public.cross_fix_cards enable row level security;

-- Authenticated users can read all cards (leads approve pending ones)
create policy "cross_fix_cards_select_authenticated"
  on public.cross_fix_cards for select
  to authenticated
  using (true);

create policy "cross_fix_cards_insert_authenticated"
  on public.cross_fix_cards for insert
  to authenticated
  with check (true);

create policy "cross_fix_cards_update_authenticated"
  on public.cross_fix_cards for update
  to authenticated
  using (true);

create index if not exists cross_fix_cards_status_created_idx
  on public.cross_fix_cards (status, created_at desc);

-- Realtime: enable in Supabase Dashboard → Database → Replication
--   Add table: cross_fix_cards