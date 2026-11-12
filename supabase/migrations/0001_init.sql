-- DYBYSTA initial schema
-- Every user-owned table carries user_id and is protected by Row Level Security
-- so a user can only ever read or write their own rows.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.priority_level as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('todo', 'in_progress', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reminder_status as enum ('pending', 'snoozed', 'dismissed', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reminder_repeat as enum ('none', 'daily', 'weekdays', 'weekly', 'monthly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.idea_status as enum ('new', 'exploring', 'converted', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.item_source as enum ('manual', 'ai');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Users: profile mirror of auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  voice_language text not null default 'en-US' check (voice_language in ('en-US', 'ru-RU')),
  ai_language text not null default 'auto' check (ai_language in ('auto', 'en', 'ru')),
  timezone text not null default 'UTC',
  week_starts_on smallint not null default 1 check (week_starts_on in (0, 1)),
  notifications_enabled boolean not null default true,
  browser_notifications boolean not null default false,
  notification_sound boolean not null default false,
  default_snooze_minutes integer not null default 10 check (default_snooze_minutes between 1 and 1440),
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '07:00',
  daily_overview_enabled boolean not null default true,
  ai_suggestions_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default 'violet',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  description text,
  due_date date,
  due_time time,
  priority public.priority_level not null default 'medium',
  status public.task_status not null default 'todo',
  category_id uuid references public.categories (id) on delete set null,
  completed_at timestamptz,
  source public.item_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  description text,
  remind_at timestamptz not null,
  repeat public.reminder_repeat not null default 'none',
  status public.reminder_status not null default 'pending',
  last_notified_at timestamptz,
  task_id uuid references public.tasks (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  source public.item_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled',
  content text not null default '',
  folder text,
  tags text[] not null default '{}',
  pinned boolean not null default false,
  category_id uuid references public.categories (id) on delete set null,
  source public.item_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  description text,
  tags text[] not null default '{}',
  status public.idea_status not null default 'new',
  converted_task_id uuid references public.tasks (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  source public.item_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  description text,
  start_date date not null,
  start_time time,
  end_time time,
  location text,
  category_id uuid references public.categories (id) on delete set null,
  source public.item_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists tasks_user_due_idx on public.tasks (user_id, due_date);
create index if not exists tasks_user_status_idx on public.tasks (user_id, status);
create index if not exists reminders_user_at_idx on public.reminders (user_id, remind_at);
create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index if not exists ideas_user_created_idx on public.ideas (user_id, created_at desc);
create index if not exists events_user_date_idx on public.events (user_id, start_date);
create index if not exists categories_user_idx on public.categories (user_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','user_preferences','tasks','reminders','notes','ideas','events'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.reminders enable row level security;
alter table public.notes enable row level security;
alter table public.ideas enable row level security;
alter table public.events enable row level security;

drop policy if exists "own profile select" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare t text;
begin
  foreach t in array array['user_preferences','categories','tasks','reminders','notes','ideas','events'] loop
    execute format('drop policy if exists "own rows select" on public.%I', t);
    execute format('drop policy if exists "own rows insert" on public.%I', t);
    execute format('drop policy if exists "own rows update" on public.%I', t);
    execute format('drop policy if exists "own rows delete" on public.%I', t);
    execute format('create policy "own rows select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "own rows insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "own rows update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "own rows delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- New user bootstrap: profile, preferences, default categories
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id) values (new.id) on conflict (user_id) do nothing;

  insert into public.categories (user_id, name, color) values
    (new.id, 'Work', 'blue'),
    (new.id, 'Personal', 'violet'),
    (new.id, 'Study', 'amber'),
    (new.id, 'Health', 'green'),
    (new.id, 'Finance', 'rose')
  on conflict (user_id, name) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Account deletion: a user can delete their own account (cascades all data)
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
