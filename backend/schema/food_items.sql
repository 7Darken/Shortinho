create table if not exists public.food_items (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,     -- nom standardisé, ex: "tomate"
  image_url text,                -- lien de l’image (fond transparent)
  category text,                 -- ex: "légume", "fruit", etc
  created_at timestamp with time zone default now()
);

alter table public.food_items enable row level security;

-- Tout le monde peut lire les images
create policy "Anyone can view food items"
on public.food_items
for select
using (true);

-- Seuls les admins peuvent insérer (facultatif selon ton besoin)
create policy "Only admins can insert food items"
on public.food_items
for insert
with check (auth.role() = 'admin');
