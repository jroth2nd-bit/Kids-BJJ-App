drop index if exists public.promotions_legacy_key_key;

alter table public.promotions
  alter column legacy_key set not null;

alter table public.promotions
  add constraint promotions_legacy_key_key unique (legacy_key);
