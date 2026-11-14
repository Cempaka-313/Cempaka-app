-- Peran baru "admin" (keputusan Reza, 2026-11-14):
-- * Akses penuh ke semua data, termasuk approval seperti owner.
-- * HANYA admin: kelola user (tambah/nonaktifkan/ubah peran), upload template QUO, ubah default_settings.

-- 1. Izinkan nilai 'admin' di profiles.peran
alter table public.profiles drop constraint profiles_peran_check;
alter table public.profiles add constraint profiles_peran_check
  check (peran = any (array['sales', 'estimator', 'pic_proyek', 'purchasing', 'manajer', 'owner', 'finance', 'admin']));

-- 2. Tambahkan admin ke semua policy tulis yang sudah ada
alter policy insert_projects on public.projects
  with check ((select public.app_role()) = any (array['sales', 'estimator', 'manajer', 'owner', 'admin']));
alter policy update_projects on public.projects
  using ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']))
  with check ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']));

alter policy write_items on public.project_items
  using ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']))
  with check ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']));
alter policy write_item_images on public.project_item_images
  using ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']))
  with check ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']));
alter policy write_project_materials on public.project_materials
  using ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']))
  with check ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']));
alter policy write_materials on public.materials
  using ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']))
  with check ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']));
alter policy write_price_history on public.material_price_history
  using ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']))
  with check ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']));

alter policy write_files on public.project_files
  using ((select public.app_role()) = any (array['sales', 'estimator', 'manajer', 'owner', 'admin']))
  with check ((select public.app_role()) = any (array['sales', 'estimator', 'manajer', 'owner', 'admin']));
alter policy write_settings on public.project_settings
  using ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']))
  with check ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']));
alter policy write_revisions on public.quotation_revisions
  using ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']))
  with check ((select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin']));

-- Approval: admin setara owner
alter policy write_approvals on public.approvals
  with check ((select public.app_role()) = any (array['manajer', 'owner', 'admin']) and approver_id = auth.uid());

-- 3. Khusus admin: template QUO dan default_settings (manajer/owner tidak lagi bisa menulis)
alter policy write_templates on public.quo_templates
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');
alter policy write_defaults on public.default_settings
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- 4. Khusus admin: kelola user di profiles (tambah, nonaktifkan via aktif=false, ubah peran).
-- Tidak ada policy delete: user dinonaktifkan, bukan dihapus, agar riwayat tetap utuh.
create policy admin_insert_profiles on public.profiles
  for insert to authenticated
  with check ((select public.app_role()) = 'admin');
create policy admin_update_profiles on public.profiles
  for update to authenticated
  using ((select public.app_role()) = 'admin')
  with check ((select public.app_role()) = 'admin');

-- 5. Jadikan Reza admin
update public.profiles set peran = 'admin' where lower(email) = 'reza@cempaka.biz';
