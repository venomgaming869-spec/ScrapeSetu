create or replace function public.admin_set_recycler_materials(p_recycler_id uuid, p_material_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_role() <> 'admin' then
    raise exception 'Admin access required';
  end if;
  if not exists (select 1 from public.recyclers where id = p_recycler_id) then
    raise exception 'Recycler not found';
  end if;
  delete from public.recycler_materials where recycler_id = p_recycler_id;
  insert into public.recycler_materials (recycler_id, material_id)
  select p_recycler_id, material_id
  from unnest(coalesce(p_material_ids, array[]::uuid[])) as material_id
  join public.materials m on m.id = material_id
  where m.active
  on conflict (recycler_id, material_id) do nothing;
end;
$$;

revoke execute on function public.admin_set_recycler_materials(uuid, uuid[]) from public, anon;
grant execute on function public.admin_set_recycler_materials(uuid, uuid[]) to authenticated;