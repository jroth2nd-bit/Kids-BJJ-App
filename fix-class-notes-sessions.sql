alter table public.class_notes
  add column session_id text;

alter table public.class_notes
  drop constraint if exists class_notes_program_class_date_key;

alter table public.class_notes
  add constraint class_notes_program_date_session_key unique (program, class_date, session_id);
