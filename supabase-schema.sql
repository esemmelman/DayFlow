create table if not exists public.tasks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null check (length(title) between 1 and 500),
  date date, start_time time, end_time time,
  notes text not null default '', color text not null default '#2f80ed',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.tasks enable row level security;
create policy "Users can read their own tasks" on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can insert their own tasks" on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own tasks" on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own tasks" on public.tasks for delete to authenticated using ((select auth.uid()) = user_id);
alter publication supabase_realtime add table public.tasks;
