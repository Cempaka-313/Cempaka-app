-- Tulis ke BOM (project_materials) dan foto item: estimator/manajer/owner (keputusan Reza, 2026-11-14).
create policy write_project_materials on public.project_materials
  for all to authenticated
  using ((select public.app_role()) = any (array['estimator', 'manajer', 'owner']))
  with check ((select public.app_role()) = any (array['estimator', 'manajer', 'owner']));
create policy write_item_images on public.project_item_images
  for all to authenticated
  using ((select public.app_role()) = any (array['estimator', 'manajer', 'owner']))
  with check ((select public.app_role()) = any (array['estimator', 'manajer', 'owner']));
