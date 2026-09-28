-- One-time default for the existing family tree. Relationship exceptions can be edited in admin.
-- Only units with two distinct parent-role members represent a couple.
with couples as (
  select family_id
  from public.family_members
  where role = 'parent'
  group by family_id
  having count(distinct person_id) = 2
)
update public.family_units as u
set relationship_status = 'married', is_current = true
from couples
where u.id = couples.family_id
  and (u.relationship_status is distinct from 'married' or u.is_current is distinct from true);
