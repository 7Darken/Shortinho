-- File: shopping_list_items_v2.sql
-- Migration: Ajouter food_item_id à shopping_list_items

-- Ajouter la colonne food_item_id si elle n'existe pas
alter table public.shopping_list_items 
add column if not exists food_item_id uuid references public.food_items(id) on delete set null;

