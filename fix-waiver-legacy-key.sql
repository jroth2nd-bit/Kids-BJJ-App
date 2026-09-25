drop index if exists public.waivers_legacy_key_key;

alter table public.waivers
  alter column legacy_key set not null;

alter table public.waivers
  add constraint waivers_legacy_key_key unique (legacy_key);
