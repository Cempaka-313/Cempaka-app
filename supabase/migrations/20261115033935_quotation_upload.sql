-- Upload revisi Excel QUO_INT (keputusan Reza, 2026-11-15).
--
-- 1. project_items menyimpan item per revisi. Kode yang sama boleh muncul di area (sheet) berbeda dan di
--    revisi berbeda, jadi unik per (project, revisi, area, kode, opsi). NULLS NOT DISTINCT supaya baris lama
--    tanpa revisi/area tetap unik per proyek seperti sebelumnya.
-- 2. Bucket privat `quotation-files` untuk file .xlsx; path: <project_id>/<nama-unik>.xlsx.
--    Baca: semua user aktif. Upload/hapus: estimator, manajer, owner, admin (sama dengan write_revisions).
-- 3. RPC create_quotation_revision(): satu transaksi untuk revisi baru (rev_no berikutnya, sumber upload_excel),
--    item-itemnya, current_revision_id proyek, dan activity_log. SECURITY INVOKER: RLS tetap berlaku.

alter table public.project_items drop constraint project_items_project_item_unique;
alter table public.project_items
  add constraint project_items_revision_item_unique
  unique nulls not distinct (project_id, revision_id, area, item_code, option_no);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quotation-files', 'quotation-files', false, 20971520,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do nothing;

create policy quotation_files_read on storage.objects
  for select to authenticated
  using (bucket_id = 'quotation-files' and (select public.app_role()) is not null);

create policy quotation_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'quotation-files'
    and (select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin'])
  );

create policy quotation_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'quotation-files'
    and (select public.app_role()) = any (array['estimator', 'manajer', 'owner', 'admin'])
  );

create or replace function public.create_quotation_revision(
  p_project_id bigint,
  p_excel_path text,
  p_total_hpp numeric,
  p_total_jual numeric,
  p_gpm numeric,
  p_catatan text,
  p_items jsonb,
  p_log text
)
returns table (revision_id bigint, rev_no integer)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_role text := public.app_role();
  v_uid uuid := auth.uid();
  v_status text;
  v_kurs numeric;
  v_rev_no integer;
  v_rev_id bigint;
begin
  if v_uid is null or v_role is null then
    raise exception 'Sesi tidak valid.' using errcode = '42501';
  end if;
  if not (v_role = any (array['estimator', 'manajer', 'owner', 'admin'])) then
    raise exception 'Peran % tidak boleh mengupload revisi.', v_role using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Tidak ada item untuk disimpan.' using errcode = '22023';
  end if;

  select p.status, p.kurs_usd into v_status, v_kurs
  from projects p where p.id = p_project_id for update;
  if not found then
    raise exception 'Proyek tidak ditemukan.' using errcode = 'P0002';
  end if;
  if v_status in ('completed', 'cancelled') then
    raise exception 'Proyek berstatus %, revisi tidak bisa ditambahkan.', v_status using errcode = '22023';
  end if;

  select coalesce(max(r.rev_no), 0) + 1 into v_rev_no
  from quotation_revisions r where r.project_id = p_project_id;

  insert into quotation_revisions (project_id, rev_no, excel_path, total_hpp, total_jual, gpm, kurs_usd, sumber, dibuat_oleh, catatan)
  values (p_project_id, v_rev_no, p_excel_path, p_total_hpp, p_total_jual, p_gpm, v_kurs, 'upload_excel', v_uid, p_catatan)
  returning id into v_rev_id;

  insert into project_items (
    project_id, revision_id, area, item_code, option_no, nama_item, tipe, deskripsi, dimensi,
    qty, unit, hpp_unit, harga_jual_unit, perlu_dicek, asumsi, catatan
  )
  select
    p_project_id, v_rev_id, x.area, x.item_code, coalesce(x.option_no, 1), x.nama_item, x.tipe, x.deskripsi, x.dimensi,
    x.qty, x.unit, x.hpp_unit, x.harga_jual_unit, coalesce(x.perlu_dicek, false), x.asumsi, x.catatan
  from jsonb_to_recordset(p_items) as x(
    area text, item_code text, option_no smallint, nama_item text, tipe text, deskripsi text, dimensi text,
    qty numeric, unit text, hpp_unit numeric, harga_jual_unit numeric, perlu_dicek boolean, asumsi text, catatan text
  );

  update projects set current_revision_id = v_rev_id, updated_at = now() where id = p_project_id;

  insert into activity_log (project_id, user_id, aksi, objek, nilai_lama, nilai_baru, alasan)
  values (
    p_project_id, v_uid, 'upload_revisi', 'revisi',
    case when v_rev_no > 1 then 'Rev ' || (v_rev_no - 1) end, 'Rev ' || v_rev_no, p_log
  );

  return query select v_rev_id, v_rev_no;
end;
$$;

revoke all on function public.create_quotation_revision(bigint, text, numeric, numeric, numeric, text, jsonb, text) from public, anon;
grant execute on function public.create_quotation_revision(bigint, text, numeric, numeric, numeric, text, jsonb, text) to authenticated;
