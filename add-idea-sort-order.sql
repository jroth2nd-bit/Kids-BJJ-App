-- Lets Idea Notebook sections and subsections keep a custom drag-and-drop order.
alter table public.idea_notes
  add column if not exists sort_order integer;

create index if not exists idea_notes_sort_order_idx on public.idea_notes (sort_order);
