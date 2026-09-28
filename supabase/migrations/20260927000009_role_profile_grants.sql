revoke all on table public.collector_profiles from anon, authenticated;
revoke all on table public.recycler_profiles from anon, authenticated;
grant select on table public.collector_profiles, public.recycler_profiles to authenticated;