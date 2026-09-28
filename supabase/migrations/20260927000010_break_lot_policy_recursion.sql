create or replace function public.is_collector_lot_owner(p_lot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lots l
    where l.id = p_lot_id and l.collector_id = auth.uid()
  )
$$;

create or replace function public.is_assigned_recycler_for_lot(p_lot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.offers o
    join public.recyclers r on r.id = o.recycler_id
    where o.lot_id = p_lot_id
      and o.status = 'accepted'
      and r.profile_id = auth.uid()
  )
$$;

create or replace function public.can_view_lot_photo(p_photo_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lots l
    join public.recycler_materials rm on rm.material_id = l.material_id
    join public.recyclers r on r.id = rm.recycler_id
    where l.photo_url = p_photo_path
      and r.profile_id = auth.uid()
      and r.active
      and r.authorization_status = 'verified'
      and (
        r.service_area ilike '%all%'
        or (l.service_location is not null and r.service_area ilike '%' || l.service_location || '%')
      )
  )
$$;

revoke execute on function public.is_collector_lot_owner(uuid) from public, anon;
revoke execute on function public.is_assigned_recycler_for_lot(uuid) from public, anon;
revoke execute on function public.can_view_lot_photo(text) from public, anon;
grant execute on function public.is_collector_lot_owner(uuid) to authenticated;
grant execute on function public.is_assigned_recycler_for_lot(uuid) to authenticated;
grant execute on function public.can_view_lot_photo(text) to authenticated;

drop policy "assigned recycler reads accepted lots" on public.lots;
create policy "assigned recycler reads accepted lots" on public.lots for select to authenticated
  using (
    public.current_profile_role() = 'recycler'
    and status in ('offer_accepted', 'completed')
    and public.is_assigned_recycler_for_lot(id)
  );

drop policy "offers visible to participants or admin" on public.offers;
create policy "offers visible to participants or admin" on public.offers for select to authenticated
  using (
    public.current_profile_role() = 'admin'
    or public.is_collector_lot_owner(lot_id)
    or exists (
      select 1 from public.recyclers r
      where r.id = recycler_id and r.profile_id = auth.uid()
    )
  );

drop policy "handovers visible to participants or admin" on public.handovers;
create policy "handovers visible to participants or admin" on public.handovers for select to authenticated
  using (
    public.current_profile_role() = 'admin'
    or public.is_collector_lot_owner(lot_id)
    or public.is_assigned_recycler_for_lot(lot_id)
  );

drop policy "payments visible to participants or admin" on public.payments;
create policy "payments visible to participants or admin" on public.payments for select to authenticated
  using (
    public.current_profile_role() = 'admin'
    or public.is_collector_lot_owner(lot_id)
    or public.is_assigned_recycler_for_lot(lot_id)
  );

drop policy "traceability visible to participants or admin" on public.traceability_events;
create policy "traceability visible to participants or admin" on public.traceability_events for select to authenticated
  using (
    public.current_profile_role() = 'admin'
    or public.is_collector_lot_owner(lot_id)
    or public.is_assigned_recycler_for_lot(lot_id)
  );

drop policy "participants view lot images" on storage.objects;
create policy "participants view lot images" on storage.objects for select to authenticated
  using (
    bucket_id = 'e-waste-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_profile_role() = 'admin'
      or public.can_view_lot_photo(name)
    )
  );