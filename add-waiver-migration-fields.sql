alter table public.waivers
  add column date_of_birth date,
  add column emergency_relationship text not null default '',
  add column signature jsonb not null default '{}'::jsonb,
  add column snapshot jsonb not null default '{}'::jsonb,
  add column legacy_key text;

create unique index waivers_legacy_key_key
  on public.waivers (legacy_key)
  where legacy_key is not null;
