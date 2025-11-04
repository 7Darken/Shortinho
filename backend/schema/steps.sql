-- steps.sql
create table if not exists public.steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references public.recipes(id) on delete cascade,
  "order" integer not null,
  text text not null,
  duration text,
  temperature text,
  ingredients_used text[] DEFAULT '{}'
);

alter table public.steps enable row level security;

create policy "Steps are viewable by recipe owner"
on public.steps
for select
using (
  auth.uid() in (
    select user_id from public.recipes where id = recipe_id
  )
);

create policy "Steps are insertable by recipe owner"
on public.steps
for insert
with check (
  auth.uid() in (
    select user_id from public.recipes where id = recipe_id
  )
);

create policy "Steps are updatable by recipe owner"
on public.steps
for update
using (
  auth.uid() in (
    select user_id from public.recipes where id = recipe_id
  )
);

create policy "Steps are deletable by recipe owner"
on public.steps
for delete
using (
  auth.uid() in (
    select user_id from public.recipes where id = recipe_id
  )
);
