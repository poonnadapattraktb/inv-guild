-- Switch the app from calling security-definer RPC functions to calling
-- PostgREST's auto-generated REST API on public.members directly.
--
-- Column-level grants + RLS replace the guards that used to live in
-- assign_member_class(): anon/authenticated may only ever update
-- class_id/avatar_id/assigned_at, and only while class_id is still null,
-- so a member's class can be assigned once and never overwritten by a
-- replayed or forged PATCH request.

grant select on public.members to anon, authenticated;
grant update (class_id, avatar_id, assigned_at) on public.members to anon, authenticated;

create policy "members_select_all" on public.members
  for select
  to anon, authenticated
  using (true);

create policy "members_assign_once" on public.members
  for update
  to anon, authenticated
  using (class_id is null)
  with check (class_id is not null and avatar_id is not null and assigned_at is not null);

drop function if exists public.get_member_by_id(uuid);
drop function if exists public.list_assigned_members();
drop function if exists public.assign_member_class(uuid, text, text);
