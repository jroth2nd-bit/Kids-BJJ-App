alter table public.students
  add column legacy_id bigint;

create unique index students_program_legacy_id_key
  on public.students (program, legacy_id)
  where legacy_id is not null;
