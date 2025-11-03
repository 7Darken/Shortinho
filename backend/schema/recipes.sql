-- recipes.sql
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  title text not null,
  servings integer,
  prep_time text,
  cook_time text,
  total_time text,
  source_url text,
  audio_url text,
  image_url text,
  created_at timestamp with time zone default now()
   -- 🔹 Nouveaux champs nutrition
  calories numeric,       -- kcal totales
  proteins numeric,       -- g de protéines
  carbs numeric,          -- g de glucides
  fats numeric,           -- g de lipides

  -- 🔹 Nouveaux champs équipements utilisés
  equipment text[],       -- Liste des équipements (four, poêle, mixeur, etc.)
);

alter table public.recipes enable row level security;

create policy "Recipes are viewable by owner"
on public.recipes
for select
using (auth.uid() = user_id);

create policy "Recipes are insertable by owner"
on public.recipes
for insert
with check (auth.uid() = user_id);

create policy "Recipes are updatable by owner"
on public.recipes
for update
using (auth.uid() = user_id);

create policy "Recipes are deletable by owner"
on public.recipes
for delete
using (auth.uid() = user_id);
