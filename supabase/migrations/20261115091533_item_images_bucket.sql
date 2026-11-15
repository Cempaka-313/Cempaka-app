-- Foto item dari Excel (keputusan Reza, 2026-11-15).
-- Bucket privat `item-images`: gambar yang diekstrak dari sheet area saat upload revisi (kolom PICTURE → tipe
-- 'produk', kolom FINISH/COLOR → 'detail'), dikompres maks ~800px (webp). Path: <project_id>/rev-<rev_no>/<nama>.webp.
-- project_item_images.url menyimpan path di bucket ini. Baca: semua user aktif; tulis/hapus: estimator, manajer,
-- owner, admin (sama dengan write_item_images).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy item_images_read on storage.objects
  for select to authenticated
  using (bucket_id = 'item-images' and (select public.app_role()) is not null);

create policy item_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'item-images'
    and (select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin'])
  );

create policy item_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'item-images'
    and (select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin'])
  );
