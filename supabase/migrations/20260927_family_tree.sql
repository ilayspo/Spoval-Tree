-- Public family directory. Access to changes is limited to explicit Auth user IDs.
create table if not exists public.family_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.family_people (
  id text primary key,
  name_he text not null check (length(trim(name_he)) > 0),
  name_ru text not null check (length(trim(name_ru)) > 0),
  deceased boolean not null default false,
  photo_path text,
  notes text not null default '',
  updated_at timestamptz not null default now()
);
create table if not exists public.family_units (
  id text primary key,
  relationship_status text not null default 'unknown' check (relationship_status in ('unknown','married','partnered','former'))
);
create table if not exists public.family_members (
  family_id text not null references public.family_units(id) on delete cascade,
  person_id text not null references public.family_people(id) on delete cascade,
  role text not null check (role in ('parent','child')),
  sort_order integer not null default 0,
  primary key (family_id,person_id,role)
);
create index if not exists family_members_person_id_idx on public.family_members(person_id);
create or replace function public.is_family_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.family_admins a where a.user_id = (select auth.uid())) $$;
revoke all on function public.is_family_admin() from public;
grant execute on function public.is_family_admin() to anon, authenticated;

alter table public.family_admins enable row level security;
alter table public.family_people enable row level security;
alter table public.family_units enable row level security;
alter table public.family_members enable row level security;
create policy "admins can see their own membership" on public.family_admins for select to authenticated using (user_id = (select auth.uid()));
create policy "people publicly visible" on public.family_people for select to anon, authenticated using (true);
create policy "units publicly visible" on public.family_units for select to anon, authenticated using (true);
create policy "members publicly visible" on public.family_members for select to anon, authenticated using (true);
create policy "admins insert people" on public.family_people for insert to authenticated with check ((select public.is_family_admin()));
create policy "admins update people" on public.family_people for update to authenticated using ((select public.is_family_admin())) with check ((select public.is_family_admin()));
create policy "admins delete people" on public.family_people for delete to authenticated using ((select public.is_family_admin()));
create policy "admins insert units" on public.family_units for insert to authenticated with check ((select public.is_family_admin()));
create policy "admins update units" on public.family_units for update to authenticated using ((select public.is_family_admin())) with check ((select public.is_family_admin()));
create policy "admins delete units" on public.family_units for delete to authenticated using ((select public.is_family_admin()));
create policy "admins insert members" on public.family_members for insert to authenticated with check ((select public.is_family_admin()));
create policy "admins update members" on public.family_members for update to authenticated using ((select public.is_family_admin())) with check ((select public.is_family_admin()));
create policy "admins delete members" on public.family_members for delete to authenticated using ((select public.is_family_admin()));

grant select on public.family_people, public.family_units, public.family_members to anon;
grant select, insert, update, delete on public.family_people, public.family_units, public.family_members to authenticated;
grant select on public.family_admins to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('family-photos','family-photos',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "family admins upload photos" on storage.objects for insert to authenticated
with check (bucket_id = 'family-photos' and (select public.is_family_admin()));
create policy "family admins replace photos" on storage.objects for update to authenticated
using (bucket_id = 'family-photos' and (select public.is_family_admin()))
with check (bucket_id = 'family-photos' and (select public.is_family_admin()));
create policy "family admins remove photos" on storage.objects for delete to authenticated
using (bucket_id = 'family-photos' and (select public.is_family_admin()));
-- Grant the first administrator only after their verified Supabase Auth user exists:
-- insert into public.family_admins(user_id) select id from auth.users where email = 'OWNER_EMAIL' and email_confirmed_at is not null;
