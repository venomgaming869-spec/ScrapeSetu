alter table public.lots add column service_location text;

drop policy "verified compatible recyclers read available lots" on public.lots;
create policy "verified compatible recyclers read available lots" on public.lots for select to authenticated using (
  public.current_profile_role() = 'recycler'
  and status in ('available','matching','offers_received')
  and exists (
    select 1 from public.recyclers r
    join public.recycler_materials rm on rm.recycler_id = r.id
    where r.profile_id = auth.uid()
      and r.active
      and r.authorization_status = 'verified'
      and rm.material_id = lots.material_id
      and (
        r.service_area ilike '%all%'
        or (lots.service_location is not null and r.service_area ilike '%' || lots.service_location || '%')
      )
  )
);

drop policy "participants view lot images" on storage.objects;
create policy "participants view lot images" on storage.objects for select to authenticated using (
  bucket_id = 'e-waste-images'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.current_profile_role() = 'admin'
    or exists (
      select 1 from public.lots l
      join public.recycler_materials rm on rm.material_id = l.material_id
      join public.recyclers r on r.id = rm.recycler_id
      where l.photo_url = storage.objects.name
        and r.profile_id = auth.uid()
        and r.active
        and r.authorization_status = 'verified'
        and (r.service_area ilike '%all%' or (l.service_location is not null and r.service_area ilike '%' || l.service_location || '%'))
    )
  )
);