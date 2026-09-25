alter table public.promotions
  add column belt_size text not null default '',
  add column in_stock boolean not null default false,
  add column confirmed boolean not null default false,
  add column legacy_key text;

create unique index promotions_legacy_key_key
  on public.promotions (legacy_key)
  where legacy_key is not null;
