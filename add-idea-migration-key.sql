alter table public.idea_notes
  add column legacy_key text;

create unique index idea_notes_legacy_key_key
  on public.idea_notes (legacy_key)
  where legacy_key is not null;
