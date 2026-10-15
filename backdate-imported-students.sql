-- One-time fix: the 2026-09-24 import stamped existing students with the import date.
-- Backdate them to each program's class start date so attendance counts include earlier classes.
update public.students set created_at = '2026-07-28T12:00:00Z' where program = 'kids'  and created_at::date = '2026-09-24';
update public.students set created_at = '2026-07-01T12:00:00Z' where program = 'adult' and created_at::date = '2026-09-24';
