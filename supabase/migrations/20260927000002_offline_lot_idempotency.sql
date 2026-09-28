alter table public.lots add column offline_id uuid unique;

create policy "collector replaces own lot image" on storage.objects for update to authenticated
  using (bucket_id = 'e-waste-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'e-waste-images' and (storage.foldername(name))[1] = auth.uid()::text);