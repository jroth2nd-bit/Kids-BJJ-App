-- Removes duplicate Idea Notebook rows created by the old save bug.
-- Each idea's original key is the text before the first ":". The newest row per idea is kept.
-- Run in the Supabase SQL editor. Preview first with the SELECT, then run the DELETE.

-- Preview: rows that would be deleted
select id, title, legacy_key, updated_at
from (
  select *, row_number() over (
    partition by split_part(legacy_key, ':', 1)
    order by updated_at desc, length(legacy_key), id
  ) as rn
  from public.idea_notes
) ranked
where rn > 1
order by title, updated_at;

-- Delete
delete from public.idea_notes
where id in (
  select id from (
    select id, row_number() over (
      partition by split_part(legacy_key, ':', 1)
      order by updated_at desc, length(legacy_key), id
    ) as rn
    from public.idea_notes
  ) ranked
  where rn > 1
);
