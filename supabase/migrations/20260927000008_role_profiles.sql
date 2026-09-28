create table public.collector_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  service_location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recycler_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  business_name text not null,
  location text not null default '',
  service_area text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.collector_profiles enable row level security;
alter table public.recycler_profiles enable row level security;

create policy "collector reads own role profile" on public.collector_profiles for select to authenticated
  using (id = auth.uid() and public.current_profile_role() = 'collector' or public.current_profile_role() = 'admin');
create policy "recycler reads own role profile" on public.recycler_profiles for select to authenticated
  using (id = auth.uid() and public.current_profile_role() = 'recycler' or public.current_profile_role() = 'admin');

create trigger collector_profiles_touch_updated_at before update on public.collector_profiles
  for each row execute function public.touch_updated_at();
create trigger recycler_profiles_touch_updated_at before update on public.recycler_profiles
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
  requested_name text := coalesce(new.raw_user_meta_data ->> 'name', '');
  requested_phone text := coalesce(new.phone, new.raw_user_meta_data ->> 'phone');
  requested_business text := coalesce(new.raw_user_meta_data ->> 'business_name', 'Recycler');
  requested_location text := coalesce(new.raw_user_meta_data ->> 'location', '');
  requested_service_area text := coalesce(new.raw_user_meta_data ->> 'service_area', '');
begin
  if requested_role not in ('collector', 'recycler') then
    requested_role := 'collector';
  end if;

  insert into public.profiles (id, name, phone, role)
  values (new.id, requested_name, requested_phone, requested_role);

  if requested_role = 'collector' then
    insert into public.collector_profiles (id, service_location)
    values (new.id, nullif(btrim(new.raw_user_meta_data ->> 'service_location'), ''));
  else
    insert into public.recycler_profiles (id, business_name, location, service_area)
    values (new.id, requested_business, requested_location, requested_service_area);

    insert into public.recyclers (profile_id, business_name, location, service_area)
    values (new.id, requested_business, requested_location, requested_service_area);
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;