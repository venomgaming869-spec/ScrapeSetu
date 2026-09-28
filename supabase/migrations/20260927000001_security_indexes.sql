revoke execute on function public.current_profile_role() from public, anon;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.assign_lot_reference() from public, anon, authenticated;
revoke execute on function public.record_lot_created() from public, anon, authenticated;
revoke execute on function public.record_offer_submitted() from public, anon, authenticated;
revoke execute on function public.accept_offer(uuid) from public, anon;
revoke execute on function public.confirm_handover(uuid, numeric, numeric, numeric) from public, anon;
revoke execute on function public.record_lot_event(uuid, text, jsonb) from public, anon;
revoke execute on function public.record_payment_status(uuid, text) from public, anon;

grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.accept_offer(uuid) to authenticated;
grant execute on function public.confirm_handover(uuid, numeric, numeric, numeric) to authenticated;
grant execute on function public.record_lot_event(uuid, text, jsonb) to authenticated;
grant execute on function public.record_payment_status(uuid, text) to authenticated;

create index lots_material_idx on public.lots (material_id);
create index handovers_offer_idx on public.handovers (offer_id);
create index offers_recycler_idx on public.offers (recycler_id);
create index payments_handover_idx on public.payments (handover_id);
create index recycler_materials_material_idx on public.recycler_materials (material_id);
create index traceability_actor_idx on public.traceability_events (actor_id);