-- File: shopping_list_items_supabase.sql

-- Création de la table shopping_list_items
create table if not exists public.shopping_list_items (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    ingredient_name text not null,
    quantity text,
    unit text,
    checked boolean default false,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Trigger pour mettre à jour updated_at automatiquement
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
   new.updated_at = now();
   return new;
end;
$$ language 'plpgsql';

create trigger trigger_update_shopping_list_items_updated_at
before update on public.shopping_list_items
for each row
execute function public.update_updated_at_column();

-- Activer RLS (Row Level Security) pour la sécurité
alter table public.shopping_list_items enable row level security;

-- Politique pour que chaque utilisateur ne puisse accéder qu'à ses propres items
create policy "Users can manage their own shopping list items"
on public.shopping_list_items
for all
using (auth.uid() = user_id);

alter table public.shopping_list_items 
add column if not exists food_item_id uuid references public.food_items(id) on delete set null;
