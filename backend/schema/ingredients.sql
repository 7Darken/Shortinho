-- ingredients.sql
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references public.recipes(id) on delete cascade,
  name text not null,
  quantity text,
  unit text
);

alter table public.ingredients enable row level security;

create policy "Ingredients are viewable by recipe owner"
on public.ingredients
for select
using (
  auth.uid() in (
    select user_id from public.recipes where id = recipe_id
  )
);

create policy "Ingredients are insertable by recipe owner"
on public.ingredients
for insert
with check (
  auth.uid() in (
    select user_id from public.recipes where id = recipe_id
  )
);

create policy "Ingredients are updatable by recipe owner"
on public.ingredients
for update
using (
  auth.uid() in (
    select user_id from public.recipes where id = recipe_id
  )
);

create policy "Ingredients are deletable by recipe owner"
on public.ingredients
for delete
using (
  auth.uid() in (
    select user_id from public.recipes where id = recipe_id
  )
);

alter table public.ingredients
add column if not exists food_item_id uuid references public.food_items(id);
