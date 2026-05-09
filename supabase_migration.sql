-- KH Tools — Supabase migration v2
-- Run this in your Supabase project SQL Editor

-- 1. planner_state table (VIA Planner)
create table if not exists planner_state (
  id         bigint primary key default 1,
  state      jsonb  not null default '{}',
  updated_at timestamptz not null default now(),
  constraint single_row_only check (id = 1)
);

-- 2. Enable RLS
alter table planner_state enable row level security;

-- 3. Drop old anon policy if it exists, replace with authenticated-only
drop policy if exists "anon_full_access" on planner_state;

create policy "auth_full_access" on planner_state
  for all
  to authenticated
  using (true)
  with check (true);

-- 4. Seed row
insert into planner_state (id, state)
values (1, '{}')
on conflict (id) do nothing;
