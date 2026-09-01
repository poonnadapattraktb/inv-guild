create table if not exists public.members (
  id uuid primary key,
  name text not null check (length(trim(name)) > 0),
  role text not null default '',
  class_id text check (class_id in ('pm', 'sa', 'ba', 'fe', 'be', 'fs', 'qa', 'do', 'ux', 'da', 'monarch', 'archmage')),
  avatar_id text check (avatar_id in ('a1', 'a2', 'a3', 'a4', 'a5', 'a6')),
  level integer not null default 1 check (level between 1 and 99),
  assigned_at timestamptz,
  created_at timestamptz not null default now(),
  check ((class_id is null and assigned_at is null) or (class_id is not null and avatar_id is not null and assigned_at is not null))
);

create index if not exists members_class_id_idx on public.members (class_id);

alter table public.members enable row level security;
revoke all on public.members from anon, authenticated;

insert into public.members (id, name, role, class_id, avatar_id, level, assigned_at)
values
  ('10000000-0000-4000-8000-000000000001', 'ต้นน้ำ', 'Product Manager', 'pm', 'a4', 24, now()),
  ('10000000-0000-4000-8000-000000000002', 'แนน', 'Senior System Analyst', 'sa', 'a5', 22, now()),
  ('10000000-0000-4000-8000-000000000003', 'ป๊อป', 'Business Analyst', 'ba', 'a1', 18, now()),
  ('10000000-0000-4000-8000-000000000004', 'ไอซ์', 'Frontend Developer', 'fe', 'a3', 20, now()),
  ('10000000-0000-4000-8000-000000000005', 'หมี', 'Backend Developer', 'be', 'a6', 26, now()),
  ('10000000-0000-4000-8000-000000000006', 'กัน', 'Backend Developer', 'be', 'a2', 15, now()),
  ('10000000-0000-4000-8000-000000000007', 'โดนัท', 'Full-stack Developer', 'fs', 'a1', 21, now()),
  ('10000000-0000-4000-8000-000000000008', 'เจได', 'QA Engineer', 'qa', 'a5', 19, now()),
  ('10000000-0000-4000-8000-000000000009', 'บอมบ์', 'DevOps Engineer', 'do', 'a2', 25, now()),
  ('10000000-0000-4000-8000-000000000010', 'พลอย', 'Product Designer', 'ux', 'a3', 20, now()),
  ('10000000-0000-4000-8000-000000000011', 'เบล', 'UX Researcher', 'ux', 'a6', 14, now()),
  ('10000000-0000-4000-8000-000000000012', 'ฟ้า', 'Data Engineer', 'da', 'a4', 23, now())
on conflict (id) do nothing;

create or replace function public.get_member_by_id(p_id uuid)
returns setof public.members
language sql
stable
security definer
set search_path = public
as $$
  select * from public.members where id = p_id;
$$;

create or replace function public.list_assigned_members()
returns setof public.members
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.members
  where class_id is not null
  order by name;
$$;

create or replace function public.assign_member_class(p_id uuid, p_class_id text, p_avatar_id text)
returns setof public.members
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_class_id not in ('pm', 'sa', 'ba', 'fe', 'be', 'fs', 'qa', 'do', 'ux', 'da', 'monarch', 'archmage') then
    raise exception 'invalid class_id';
  end if;

  if p_avatar_id not in ('a1', 'a2', 'a3', 'a4', 'a5', 'a6') then
    raise exception 'invalid avatar_id';
  end if;

  update public.members
  set class_id = p_class_id,
      avatar_id = p_avatar_id,
      assigned_at = now()
  where id = p_id and class_id is null;

  return query select * from public.members where id = p_id;
end;
$$;

revoke all on function public.get_member_by_id(uuid) from public;
revoke all on function public.list_assigned_members() from public;
revoke all on function public.assign_member_class(uuid, text, text) from public;
grant execute on function public.get_member_by_id(uuid) to anon, authenticated;
grant execute on function public.list_assigned_members() to anon, authenticated;
grant execute on function public.assign_member_class(uuid, text, text) to anon, authenticated;