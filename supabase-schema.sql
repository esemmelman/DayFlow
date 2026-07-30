create table if not exists public.tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null check (length(title) between 1 and 500),
  date date, start_time time, end_time time,
  notes text not null default '', color text not null default '#2f80ed',
  reminder_enabled boolean not null default false,
  reminder_minutes integer not null default 45 check (reminder_minutes between 1 and 10080),
  reminder_email boolean not null default true,
  reminder_push boolean not null default false,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.tasks add column if not exists reminder_enabled boolean not null default false;
alter table public.tasks add column if not exists reminder_minutes integer not null default 45;
alter table public.tasks add column if not exists reminder_email boolean not null default true;
alter table public.tasks add column if not exists reminder_push boolean not null default false;
alter table public.tasks add column if not exists timezone text not null default 'UTC';
alter table public.tasks enable row level security;
drop policy if exists "Users can read their own tasks" on public.tasks;
drop policy if exists "Users can insert their own tasks" on public.tasks;
drop policy if exists "Users can update their own tasks" on public.tasks;
drop policy if exists "Users can delete their own tasks" on public.tasks;
create policy "Users can read their own tasks" on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own tasks" on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own tasks" on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own tasks" on public.tasks for delete to authenticated using ((select auth.uid()) = user_id);
do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tasks') then alter publication supabase_realtime add table public.tasks; end if;
end $$;

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "Users can read their own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can insert their own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can update their own push subscriptions" on public.push_subscriptions;
drop policy if exists "Users can delete their own push subscriptions" on public.push_subscriptions;
create policy "Users can read their own push subscriptions" on public.push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own push subscriptions" on public.push_subscriptions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own push subscriptions" on public.push_subscriptions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own push subscriptions" on public.push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.reminder_deliveries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  channel text not null check (channel in ('email','push')),
  scheduled_for timestamptz not null,
  delivered_at timestamptz not null default now(),
  unique (user_id, task_id, channel, scheduled_for)
);
alter table public.reminder_deliveries enable row level security;
