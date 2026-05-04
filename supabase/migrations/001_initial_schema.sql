-- Diagnostic Sessions: stores each AI diagnostic session
create table if not exists public.diagnostic_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  equipment_id  text,
  issue         text not null,
  response      text not null default '',
  outcome       text check (outcome in ('fixed','refine')),
  created_at    timestamptz not null default now()
);

alter table public.diagnostic_sessions enable row level security;

create policy "own_rows_select" on public.diagnostic_sessions
  for select using (auth.uid() = user_id);

create policy "own_rows_insert" on public.diagnostic_sessions
  for insert with check (auth.uid() = user_id);

create policy "own_rows_update" on public.diagnostic_sessions
  for update using (auth.uid() = user_id);

create index diagnostic_sessions_user_created_idx
  on public.diagnostic_sessions (user_id, created_at desc);

-- Cross-Fix Cards: shared repair knowledge across plants
create table if not exists public.cross_fix_cards (
  id                uuid primary key default gen_random_uuid(),
  code              text,
  title             text not null,
  equipment_id      text,
  equipment_name    text,
  plant             text,
  author            text,
  author_role       text check (author_role in ('technician','lead','management')),
  time_to_fix       text,
  symptoms          text,
  root_cause        text,
  solution          text,
  parts             text[] default '{}',
  tags              text[] default '{}',
  status            text not null default 'pending' check (status in ('pending','approved','rejected')),
  helpful           integer not null default 0,
  source_session_id uuid references diagnostic_sessions(id) on delete set null,
  approved_by       text,
  approved_at       timestamptz,
  created_at        timestamptz not null default now()
);

alter table public.cross_fix_cards enable row level security;

-- Everyone can read approved cards; authors can manage their own
create policy "approved_read" on public.cross_fix_cards
  for select using (status = 'approved');

create policy "authenticated_insert" on public.cross_fix_cards
  for insert with check (auth.uid() is not null);

create policy "author_update" on public.cross_fix_cards
  for update using (auth.uid() is not null);

create index cross_fix_cards_status_created_idx
  on public.cross_fix_cards (status, created_at desc);