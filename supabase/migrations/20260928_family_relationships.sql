-- Keep approximate historical dates without inventing a day. Accepted ISO formats: YYYY, YYYY-MM, YYYY-MM-DD.
alter table public.family_people
  add column birth_date text,
  add column death_date text,
  add column is_visible boolean not null default true;
alter table public.family_people
  add constraint family_birth_date_format check (birth_date is null or birth_date ~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$'),
  add constraint family_death_date_format check (death_date is null or death_date ~ '^[0-9]{4}(-[0-9]{2}(-[0-9]{2})?)?$'),
  add constraint family_death_requires_memorial check (death_date is null or deceased);
alter table public.family_units
  drop constraint family_units_relationship_status_check,
  add column is_current boolean,
  add constraint family_units_relationship_status_check check (relationship_status in ('unknown','married','partnered','divorced','separated','former')),
  add constraint family_divorced_not_current check (relationship_status not in ('divorced','separated','former') or is_current is distinct from true);

-- Hidden profiles cannot be fetched anonymously. Editors can still restore them.
drop policy "people publicly visible" on public.family_people;
create policy "visible people for visitors" on public.family_people for select to anon using (is_visible);
create policy "people for editors" on public.family_people for select to authenticated using (is_visible or (select public.is_family_admin()));
drop policy "members publicly visible" on public.family_members;
create policy "visible family members for visitors" on public.family_members for select to anon
  using (exists (select 1 from public.family_people p where p.id=person_id and p.is_visible));
create policy "family members for editors" on public.family_members for select to authenticated
  using (exists (select 1 from public.family_people p where p.id=person_id and (p.is_visible or (select public.is_family_admin()))));

-- Yuli is Aviv's daughter from a different relationship. Her other parent is not identified.
delete from public.family_members where family_id='F6' and person_id='I48' and role='child';
insert into public.family_units(id,relationship_status,is_current) values ('F40','unknown',null) on conflict (id) do nothing;
insert into public.family_members(family_id,person_id,role,sort_order) values
  ('F40','I15','parent',0),('F40','I48','child',0) on conflict do nothing;
update public.family_units set is_current=true where id='F1';

update public.family_people set birth_date='1989-11-10' where id='I1' and birth_date is null;
update public.family_people set birth_date='1952-02-27' where id='I2' and birth_date is null;
update public.family_people set birth_date='1960-05-18',death_date='2021-02-21' where id='I3' and birth_date is null;
update public.family_people set death_date='2025-11-07' where id='I8' and death_date is null;
update public.family_people set birth_date='1982-02-22' where id='I14' and birth_date is null;
update public.family_people set birth_date='1996-01-06' where id='I16' and birth_date is null;
update public.family_people set birth_date='1991-06-28' where id='I22' and birth_date is null;
update public.family_people set birth_date='2021-09-22' where id='I23' and birth_date is null;
update public.family_people set birth_date='2025-06-25' where id='I24' and birth_date is null;
update public.family_people set death_date='2014' where id='I38' and death_date is null;
update public.family_people set birth_date='1923-07',death_date='2013-10' where id='I81' and birth_date is null;
update public.family_people set death_date='2003-11-17' where id='I82' and death_date is null;
-- Keep Ilay's photo and remove the other photo from the new tree.
update public.family_people set photo_path=null where id<>'I1' and photo_path is not null;
-- The older prototype also stored a public image URL; remove it except for Ilay.
update public.people set photo_url=null where id<>'1a2313f5-7a15-47c6-b1ff-71381bc460cb' and photo_url is not null;
