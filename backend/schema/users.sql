-- users.sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  onboarding_completed boolean default false,
  created_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

-- Chaque utilisateur ne peut voir que son profil
create policy "Profiles are viewable by owner"
on public.profiles
for select
using (auth.uid() = id);

create policy "Profiles are insertable by owner"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "Profiles are updatable by owner"
on public.profiles
for update
using (auth.uid() = id);
