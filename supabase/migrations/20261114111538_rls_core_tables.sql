-- Aturan akses (RLS) untuk tabel inti yang sebelumnya terkunci tanpa policy.
-- Baca: semua user aktif yang punya profil (app_role() IS NOT NULL).
-- Tulis: sesuai keputusan Reza, 2026-11-14.

-- ===== Baca =====
create policy read_all on public.projects
  for select to authenticated using ((select public.app_role()) is not null);
create policy read_all on public.project_items
  for select to authenticated using ((select public.app_role()) is not null);
create policy read_all on public.project_item_images
  for select to authenticated using ((select public.app_role()) is not null);
create policy read_all on public.project_materials
  for select to authenticated using ((select public.app_role()) is not null);
create policy read_all on public.materials
  for select to authenticated using ((select public.app_role()) is not null);
create policy read_all on public.material_price_history
  for select to authenticated using ((select public.app_role()) is not null);

-- ===== projects =====
-- Insert: sales boleh membuat proyek baru, plus estimator/manajer/owner.
create policy insert_projects on public.projects
  for insert to authenticated
  with check ((select public.app_role()) = any (array['sales', 'estimator', 'manajer', 'owner']));
-- Update: hanya estimator/manajer/owner. (Tidak ada policy delete: proyek dibatalkan via status 'cancelled'.)
create policy update_projects on public.projects
  for update to authenticated
  using ((select public.app_role()) = any (array['estimator', 'manajer', 'owner']))
  with check ((select public.app_role()) = any (array['estimator', 'manajer', 'owner']));

-- ===== project_items: semua tulis hanya estimator/manajer/owner =====
create policy write_items on public.project_items
  for all to authenticated
  using ((select public.app_role()) = any (array['estimator', 'manajer', 'owner']))
  with check ((select public.app_role()) = any (array['estimator', 'manajer', 'owner']));

-- ===== materials & material_price_history: tulis estimator/manajer/owner =====
create policy write_materials on public.materials
  for all to authenticated
  using ((select public.app_role()) = any (array['estimator', 'manajer', 'owner']))
  with check ((select public.app_role()) = any (array['estimator', 'manajer', 'owner']));
create policy write_price_history on public.material_price_history
  for all to authenticated
  using ((select public.app_role()) = any (array['estimator', 'manajer', 'owner']))
  with check ((select public.app_role()) = any (array['estimator', 'manajer', 'owner']));
