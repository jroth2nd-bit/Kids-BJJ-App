drop index if exists public.students_program_legacy_id_key;

alter table public.students
  alter column legacy_id set not null;

alter table public.students
  add constraint students_program_legacy_id_key unique (program, legacy_id);
