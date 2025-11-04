-- users.sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  profile_type text, 
  onboarding_completed boolean default false,
  created_at timestamp with time zone default now()
   -- Gestion premium / abonnements
  is_premium boolean DEFAULT false,             -- true si premium
  premium_since timestamptz,                   -- date début premium
  premium_expiry timestamptz,                  -- date d'expiration (NULL si illimité)
  subscription_name text,                      -- nom de l'abonnement (Oshii Pro Monthly / Yearly)
  free_generations_remaining integer DEFAULT 2,
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
