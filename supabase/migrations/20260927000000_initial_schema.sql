create extension if not exists pgcrypto;

create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, name text not null default '', phone text, role text not null check (role in ('collector','recycler','admin')), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.materials (id uuid primary key default gen_random_uuid(), name text not null unique, description text not null default '', active boolean not null default true, created_at timestamptz not null default now());
create table public.lots (id uuid primary key default gen_random_uuid(), reference_id text not null unique, collector_id uuid not null references public.profiles(id), material_id uuid not null references public.materials(id), approximate_weight numeric(10,2) not null check (approximate_weight > 0), description text not null default '', photo_url text, latitude numeric(10,7), longitude numeric(10,7), status text not null default 'available' check (status in ('draft','pending_sync','available','matching','offers_received','offer_accepted','handover_pending','completed')), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.price_benchmarks (id uuid primary key default gen_random_uuid(), material_id uuid not null references public.materials(id), minimum_price numeric(10,2) not null check (minimum_price >= 0), maximum_price numeric(10,2) not null check (maximum_price >= minimum_price), unit text not null default 'kg', location text not null default 'All locations', effective_date date not null default current_date, source text not null, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.recyclers (id uuid primary key default gen_random_uuid(), profile_id uuid not null unique references public.profiles(id) on delete cascade, business_name text not null, location text not null default '', service_area text not null default '', authorization_status text not null default 'pending' check (authorization_status in ('pending','verified','rejected')), active boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.recycler_materials (id uuid primary key default gen_random_uuid(), recycler_id uuid not null references public.recyclers(id) on delete cascade, material_id uuid not null references public.materials(id) on delete cascade, unique (recycler_id, material_id));
create table public.offers (id uuid primary key default gen_random_uuid(), lot_id uuid not null references public.lots(id) on delete cascade, recycler_id uuid not null references public.recyclers(id), offer_value numeric(12,2) not null check (offer_value > 0), status text not null default 'pending' check (status in ('pending','accepted','rejected')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (lot_id, recycler_id));
create table public.handovers (id uuid primary key default gen_random_uuid(), lot_id uuid not null unique references public.lots(id), offer_id uuid not null references public.offers(id), confirmed_weight numeric(10,2) not null check (confirmed_weight > 0), final_value numeric(12,2) not null check (final_value > 0), latitude numeric(10,7), longitude numeric(10,7), handover_timestamp timestamptz not null default now(), recycler_confirmation boolean not null default false, status text not null default 'confirmed' check (status in ('pending','confirmed')), created_at timestamptz not null default now());
create table public.payments (id uuid primary key default gen_random_uuid(), lot_id uuid not null unique references public.lots(id), handover_id uuid not null references public.handovers(id), amount numeric(12,2) not null check (amount > 0), status text not null default 'pending' check (status in ('pending','paid','failed')), paid_at timestamptz, created_at timestamptz not null default now());
create table public.traceability_events (id uuid primary key default gen_random_uuid(), lot_id uuid not null references public.lots(id) on delete cascade, event_type text not null check (event_type in ('LOT_CREATED','BENCHMARK_GENERATED','RECYCLER_MATCHED','OFFER_SUBMITTED','OFFER_ACCEPTED','HANDOVER_CONFIRMED','PAYMENT_RECORDED')), actor_id uuid references public.profiles(id), timestamp timestamptz not null default now(), latitude numeric(10,7), longitude numeric(10,7), metadata jsonb not null default '{}'::jsonb);

create index lots_collector_created_idx on public.lots (collector_id, created_at desc);
create index lots_status_material_idx on public.lots (status, material_id);
create index offers_lot_status_idx on public.offers (lot_id, status);
create index traceability_lot_time_idx on public.traceability_events (lot_id, timestamp);
create index benchmark_lookup_idx on public.price_benchmarks (material_id, location, effective_date desc) where active;

create or replace function public.current_profile_role() returns text language sql stable security definer set search_path = public as $$ select role from public.profiles where id = auth.uid() $$;
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;
create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path = public as $$
declare requested_role text := new.raw_user_meta_data ->> 'role';
begin
  if requested_role not in ('collector','recycler') then requested_role := 'collector'; end if;
  insert into public.profiles (id,name,phone,role) values (new.id,coalesce(new.raw_user_meta_data ->> 'name',''),new.phone,requested_role);
  if requested_role = 'recycler' then
    insert into public.recyclers (profile_id,business_name,location,service_area) values (new.id,coalesce(new.raw_user_meta_data ->> 'business_name','Recycler'),coalesce(new.raw_user_meta_data ->> 'location',''),coalesce(new.raw_user_meta_data ->> 'service_area',''));
  end if;
  return new;
end;
$$;
create trigger auth_user_profile_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.assign_lot_reference() returns trigger language plpgsql set search_path = public as $$
begin
  if new.reference_id is null or new.reference_id = '' then new.reference_id := 'LOT-' || to_char(now(),'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4)); end if;
  return new;
end;
$$;
create trigger lots_assign_reference before insert on public.lots for each row execute function public.assign_lot_reference();

create or replace function public.record_lot_created() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.traceability_events (lot_id,event_type,actor_id) values (new.id,'LOT_CREATED',new.collector_id);
  return new;
end;
$$;
create trigger lots_trace_created after insert on public.lots for each row execute function public.record_lot_created();

create or replace function public.record_offer_submitted() returns trigger language plpgsql security definer set search_path = public as $$
declare actor uuid;
begin
  select profile_id into actor from public.recyclers where id = new.recycler_id;
  update public.lots set status = 'offers_received' where id = new.lot_id and status in ('available','matching','offers_received');
  insert into public.traceability_events (lot_id,event_type,actor_id,metadata) values (new.lot_id,'OFFER_SUBMITTED',actor,jsonb_build_object('offer_id',new.id));
  return new;
end;
$$;
create trigger offers_trace_submitted after insert on public.offers for each row execute function public.record_offer_submitted();

create or replace function public.accept_offer(p_offer_id uuid) returns public.offers language plpgsql security definer set search_path = public as $$
declare chosen public.offers; owner_id uuid; lot_state text;
begin
  select * into chosen from public.offers where id = p_offer_id;
  if not found then raise exception 'Offer not found'; end if;
  select collector_id,status into owner_id,lot_state from public.lots where id = chosen.lot_id for update;
  if owner_id <> auth.uid() or public.current_profile_role() <> 'collector' then raise exception 'Not authorized to accept this offer'; end if;
  if chosen.status <> 'pending' or lot_state not in ('available','matching','offers_received') then raise exception 'This lot is no longer accepting offers'; end if;
  update public.offers set status = case when id = p_offer_id then 'accepted' else 'rejected' end where lot_id = chosen.lot_id and status = 'pending';
  update public.lots set status = 'offer_accepted' where id = chosen.lot_id;
  insert into public.traceability_events (lot_id,event_type,actor_id,metadata) values (chosen.lot_id,'OFFER_ACCEPTED',auth.uid(),jsonb_build_object('offer_id',p_offer_id,'recycler_id',chosen.recycler_id,'offer_value',chosen.offer_value));
  select * into chosen from public.offers where id = p_offer_id;
  return chosen;
end;
$$;

create or replace function public.confirm_handover(p_lot_id uuid,p_confirmed_weight numeric,p_latitude numeric default null,p_longitude numeric default null) returns public.handovers language plpgsql security definer set search_path = public as $$
declare assigned_recycler public.recyclers; accepted_offer public.offers; new_handover public.handovers;
begin
  if p_confirmed_weight is null or p_confirmed_weight <= 0 then raise exception 'Confirmed weight must be greater than zero'; end if;
  select * into assigned_recycler from public.recyclers where profile_id = auth.uid() and active and authorization_status = 'verified';
  if not found or public.current_profile_role() <> 'recycler' then raise exception 'Verified recycler access required'; end if;
  select o.* into accepted_offer from public.offers o join public.lots l on l.id = o.lot_id where o.lot_id = p_lot_id and o.recycler_id = assigned_recycler.id and o.status = 'accepted' and l.status = 'offer_accepted' for update of l;
  if not found then raise exception 'No accepted offer is assigned to this recycler'; end if;
  insert into public.handovers (lot_id,offer_id,confirmed_weight,final_value,latitude,longitude,recycler_confirmation,status)
  values (p_lot_id,accepted_offer.id,p_confirmed_weight,accepted_offer.offer_value,p_latitude,p_longitude,true,'confirmed') returning * into new_handover;
  update public.lots set status = 'completed' where id = p_lot_id;
  insert into public.payments (lot_id,handover_id,amount,status) values (p_lot_id,new_handover.id,accepted_offer.offer_value,'pending');
  insert into public.traceability_events (lot_id,event_type,actor_id,latitude,longitude,metadata)
  values (p_lot_id,'HANDOVER_CONFIRMED',auth.uid(),p_latitude,p_longitude,jsonb_build_object('handover_id',new_handover.id,'confirmed_weight',p_confirmed_weight,'final_value',accepted_offer.offer_value,'handover_timestamp',new_handover.handover_timestamp));
  return new_handover;
end;
$$;

create or replace function public.record_lot_event(p_lot_id uuid,p_event_type text,p_metadata jsonb default '{}'::jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_event_type not in ('BENCHMARK_GENERATED','RECYCLER_MATCHED') then raise exception 'Unsupported event type'; end if;
  if not exists (select 1 from public.lots where id = p_lot_id and collector_id = auth.uid()) then raise exception 'Not authorized to record this event'; end if;
  if not exists (select 1 from public.traceability_events where lot_id = p_lot_id and event_type = p_event_type) then
    insert into public.traceability_events (lot_id,event_type,actor_id,metadata) values (p_lot_id,p_event_type,auth.uid(),coalesce(p_metadata,'{}'::jsonb));
  end if;
end;
$$;

create or replace function public.record_payment_status(p_payment_id uuid,p_status text) returns public.payments language plpgsql security definer set search_path = public as $$
declare payment_row public.payments; authorized boolean;
begin
  if p_status not in ('pending','paid','failed') then raise exception 'Invalid payment status'; end if;
  select * into payment_row from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  select public.current_profile_role() = 'admin' or exists (select 1 from public.offers o join public.recyclers r on r.id = o.recycler_id where o.lot_id = payment_row.lot_id and o.status = 'accepted' and r.profile_id = auth.uid()) into authorized;
  if not authorized then raise exception 'Not authorized to update this payment'; end if;
  update public.payments set status = p_status, paid_at = case when p_status = 'paid' then coalesce(paid_at,now()) else null end where id = p_payment_id returning * into payment_row;
  insert into public.traceability_events (lot_id,event_type,actor_id,metadata) values (payment_row.lot_id,'PAYMENT_RECORDED',auth.uid(),jsonb_build_object('payment_id',p_payment_id,'status',p_status,'amount',payment_row.amount));
  return payment_row;
end;
$$;

do $$ declare target_table text; begin
  foreach target_table in array array['profiles','lots','price_benchmarks','recyclers','offers'] loop
    execute format('create trigger %I_touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',target_table,target_table);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.lots enable row level security;
alter table public.price_benchmarks enable row level security;
alter table public.recyclers enable row level security;
alter table public.recycler_materials enable row level security;
alter table public.offers enable row level security;
alter table public.handovers enable row level security;
alter table public.payments enable row level security;
alter table public.traceability_events enable row level security;

revoke insert,delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (name,phone) on public.profiles to authenticated;
create policy "profiles readable by owner or admin" on public.profiles for select to authenticated using (id = auth.uid() or public.current_profile_role() = 'admin');
create policy "profiles editable by owner or admin" on public.profiles for update to authenticated using (id = auth.uid() or public.current_profile_role() = 'admin') with check (id = auth.uid() or public.current_profile_role() = 'admin');

create policy "active materials readable" on public.materials for select to authenticated using (active or public.current_profile_role() = 'admin');
create policy "admin manages materials" on public.materials for all to authenticated using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');
create policy "active benchmarks readable" on public.price_benchmarks for select to authenticated using (active or public.current_profile_role() = 'admin');
create policy "admin manages benchmarks" on public.price_benchmarks for all to authenticated using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');

create policy "collectors read own lots" on public.lots for select to authenticated using (collector_id = auth.uid() or public.current_profile_role() = 'admin');
create policy "collectors create own lots" on public.lots for insert to authenticated with check (collector_id = auth.uid() and public.current_profile_role() = 'collector' and status in ('draft','pending_sync','available'));
create policy "collectors update own open lots" on public.lots for update to authenticated
  using ((collector_id = auth.uid() and status in ('draft','pending_sync','available')) or public.current_profile_role() = 'admin')
  with check ((collector_id = auth.uid() and public.current_profile_role() = 'collector' and status in ('draft','pending_sync','available')) or public.current_profile_role() = 'admin');
create policy "verified compatible recyclers read available lots" on public.lots for select to authenticated using (
  public.current_profile_role() = 'recycler' and status in ('available','matching','offers_received') and exists (
    select 1 from public.recyclers r join public.recycler_materials rm on rm.recycler_id = r.id
    where r.profile_id = auth.uid() and r.active and r.authorization_status = 'verified' and rm.material_id = lots.material_id
  ));
create policy "admin manages lots" on public.lots for all to authenticated using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');

create policy "recycler directory readable" on public.recyclers for select to authenticated using (profile_id = auth.uid() or public.current_profile_role() = 'admin' or (active and authorization_status = 'verified'));
create policy "recycler requests verification" on public.recyclers for insert to authenticated with check (profile_id = auth.uid() and public.current_profile_role() = 'recycler' and authorization_status = 'pending' and not active);
create policy "admin manages recyclers" on public.recyclers for all to authenticated using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');
create policy "recycler materials visible to relevant users" on public.recycler_materials for select to authenticated using (
  public.current_profile_role() = 'admin' or exists (select 1 from public.recyclers r where r.id = recycler_id and (r.profile_id = auth.uid() or (r.active and r.authorization_status = 'verified'))));
create policy "admin manages recycler materials" on public.recycler_materials for all to authenticated using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');

create policy "offers visible to participants or admin" on public.offers for select to authenticated using (
  public.current_profile_role() = 'admin' or exists (select 1 from public.lots l where l.id = lot_id and l.collector_id = auth.uid())
  or exists (select 1 from public.recyclers r where r.id = recycler_id and r.profile_id = auth.uid()));
create policy "eligible recycler submits pending offer" on public.offers for insert to authenticated with check (
  status = 'pending' and exists (select 1 from public.recyclers r join public.recycler_materials rm on rm.recycler_id = r.id
  join public.lots l on l.id = offers.lot_id and l.material_id = rm.material_id
  where r.id = offers.recycler_id and r.profile_id = auth.uid() and r.active and r.authorization_status = 'verified' and l.status in ('available','matching','offers_received')));

create policy "handovers visible to participants or admin" on public.handovers for select to authenticated using (
  public.current_profile_role() = 'admin' or exists (select 1 from public.lots l where l.id = lot_id and l.collector_id = auth.uid())
  or exists (select 1 from public.offers o join public.recyclers r on r.id = o.recycler_id where o.id = offer_id and r.profile_id = auth.uid()));
create policy "payments visible to participants or admin" on public.payments for select to authenticated using (
  public.current_profile_role() = 'admin' or exists (select 1 from public.lots l where l.id = lot_id and l.collector_id = auth.uid())
  or exists (select 1 from public.offers o join public.recyclers r on r.id = o.recycler_id where o.lot_id = payments.lot_id and r.profile_id = auth.uid()));
create policy "traceability visible to participants or admin" on public.traceability_events for select to authenticated using (
  public.current_profile_role() = 'admin' or exists (select 1 from public.lots l where l.id = lot_id and l.collector_id = auth.uid())
  or exists (select 1 from public.offers o join public.recyclers r on r.id = o.recycler_id where o.lot_id = traceability_events.lot_id and r.profile_id = auth.uid()));

grant execute on function public.accept_offer(uuid) to authenticated;
grant execute on function public.confirm_handover(uuid,numeric,numeric,numeric) to authenticated;
grant execute on function public.record_lot_event(uuid,text,jsonb) to authenticated;
grant execute on function public.record_payment_status(uuid,text) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('e-waste-images','e-waste-images',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false,file_size_limit = 5242880,allowed_mime_types = excluded.allowed_mime_types;
create policy "collector uploads lot images to own folder" on storage.objects for insert to authenticated with check (bucket_id = 'e-waste-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "participants view lot images" on storage.objects for select to authenticated using (
  bucket_id = 'e-waste-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.current_profile_role() = 'admin' or exists (
    select 1 from public.lots l join public.recycler_materials rm on rm.material_id = l.material_id join public.recyclers r on r.id = rm.recycler_id
    where l.photo_url = storage.objects.name and r.profile_id = auth.uid() and r.active and r.authorization_status = 'verified')));
create policy "collector deletes own lot images" on storage.objects for delete to authenticated using (bucket_id = 'e-waste-images' and (storage.foldername(name))[1] = auth.uid()::text);

insert into public.materials (name,description) values
  ('PCB','Printed circuit boards and electronic boards'),('Cables','Copper and mixed electrical cables'),
  ('Mobile/Electronics','Mobile phones and small electronics'),('Computer Components','Computer parts and peripherals'),('Other E-Waste','Other end-of-life electronic items')
on conflict (name) do nothing;
insert into public.price_benchmarks (material_id,minimum_price,maximum_price,unit,location,effective_date,source,active)
select m.id,p.minimum_price,p.maximum_price,'kg','Delhi NCR',current_date,'Demo benchmark data - not a live market price',true
from (values ('PCB',220::numeric,280::numeric),('Cables',190::numeric,255::numeric),('Mobile/Electronics',90::numeric,160::numeric),('Computer Components',120::numeric,210::numeric),('Other E-Waste',35::numeric,80::numeric)) as p(material_name,minimum_price,maximum_price)
join public.materials m on m.name = p.material_name
where not exists (select 1 from public.price_benchmarks b where b.material_id = m.id and b.location = 'Delhi NCR' and b.source = 'Demo benchmark data - not a live market price');