-- folders.sql
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default now()
);

alter table public.folders enable row level security;

create policy "Folders are viewable by owner"
on public.folders
for select
using (auth.uid() = user_id);

create policy "Folders are insertable by owner"
on public.folders
for insert
with check (auth.uid() = user_id);

create policy "Folders are updatable by owner"
on public.folders
for update
using (auth.uid() = user_id);

create policy "Folders are deletable by owner"
on public.folders
for delete
using (auth.uid() = user_id);
