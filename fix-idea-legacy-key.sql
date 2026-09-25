drop index if exists public.idea_notes_legacy_key_key;

alter table public.idea_notes
  alter column legacy_key set not null;

alter table public.idea_notes
  add constraint idea_notes_legacy_key_key unique (legacy_key);
