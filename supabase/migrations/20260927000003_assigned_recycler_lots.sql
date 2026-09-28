create policy "assigned recycler reads accepted lots" on public.lots for select to authenticated
  using (
    public.current_profile_role() = 'recycler'
    and status in ('offer_accepted', 'completed')
    and exists (
      select 1 from public.offers o
      join public.recyclers r on r.id = o.recycler_id
      where o.lot_id = lots.id and o.status = 'accepted' and r.profile_id = auth.uid()
    )
  );