-- One-time fix: move Jay Eisenmann's waiver from the White belt record
-- (adult legacy_id 11) to the Brown belt record (adult legacy_id 10),
-- then mark the White belt record inactive.
-- The waiver row holds phone, date of birth, emergency contact, emergency phone,
-- relationship, typed/drawn signature and agreement, so they all move together.

-- STEP 1: Preview. Run this first. Expect Brown 4 (no waivers) and White (1 waiver).
select s.id, s.legacy_id, s.first_name, s.last_name, s.rank, s.active,
       (select count(*) from public.waivers w where w.student_id = s.id) as waiver_count
from public.students s
where s.program = 'adult' and s.legacy_id in (10, 11)
order by s.legacy_id;

-- STEP 2: Apply. Runs as one transaction and stops if the counts are not as expected.
do $$
declare
  brown_id bigint;
  white_id bigint;
  moved integer;
begin
  select id into brown_id from public.students where program = 'adult' and legacy_id = 10 and rank like 'Brown%';
  select id into white_id from public.students where program = 'adult' and legacy_id = 11 and rank = 'White';
  if brown_id is null or white_id is null then
    raise exception 'Expected Brown (10) and White (11) Jay Eisenmann records were not found';
  end if;
  if exists (select 1 from public.waivers where student_id = brown_id) then
    raise exception 'Brown belt record already has a waiver; nothing changed';
  end if;

  update public.waivers set student_id = brown_id where student_id = white_id;
  get diagnostics moved = row_count;
  if moved <> 1 then
    raise exception 'Expected to move 1 waiver but found %; nothing changed', moved;
  end if;

  update public.students set active = false where id = white_id;
end $$;

-- STEP 3: Verify. Expect Brown (1 waiver, active) and White (0 waivers, inactive).
select s.id, s.legacy_id, s.rank, s.active,
       (select count(*) from public.waivers w where w.student_id = s.id) as waiver_count
from public.students s
where s.program = 'adult' and s.legacy_id in (10, 11)
order by s.legacy_id;
