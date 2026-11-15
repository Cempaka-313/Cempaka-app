-- Rangkuman harga per revisi (keputusan Reza, 2026-11-15).
-- Baris di bawah Sub Total di Excel (opsi 1): Delivery & Installation, Total After Delivery & Installation,
-- DPP Lainnya, VAT 12%, Grand Total. Lokal: dari sheet SUMMARY bila ada, selain itu footer sheet area.
-- Export: Delivery "Excluded" (delivery_excluded), tanpa VAT.
-- Tambahan di luar lima kolom utama: sub_total_excel (Sub Total yang tertulis di Excel, pasangan rangkuman ini;
-- total_jual tetap jumlah baris item), delivery_excluded, dan rangkuman_sumber (sheet asal angka).
-- create_quotation_revision() (signature sama) mengisi kolom ini dari p_validasi -> 'rangkuman'.

alter table public.quotation_revisions
  add column sub_total_excel numeric,
  add column delivery numeric,
  add column delivery_excluded boolean not null default false,
  add column total_after_delivery numeric,
  add column dpp_lainnya numeric,
  add column vat numeric,
  add column grand_total numeric,
  add column rangkuman_sumber text;

create or replace function public.create_quotation_revision(
  p_project_id bigint,
  p_excel_path text,
  p_catatan text,
  p_items jsonb,
  p_log text,
  p_validasi jsonb
)
returns table (revision_id bigint, rev_no integer, selisih boolean)
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
  v_selisih boolean;
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

  insert into quotation_revisions (
    project_id, rev_no, excel_path, kurs_usd, sumber, dibuat_oleh, catatan, validasi,
    sub_total_excel, delivery, delivery_excluded, total_after_delivery, dpp_lainnya, vat, grand_total, rangkuman_sumber
  )
  values (
    p_project_id, v_rev_no, p_excel_path, v_kurs, 'upload_excel', v_uid, p_catatan, p_validasi,
    (p_validasi -> 'rangkuman' ->> 'sub_total')::numeric,
    (p_validasi -> 'rangkuman' ->> 'delivery')::numeric,
    coalesce((p_validasi -> 'rangkuman' ->> 'delivery_excluded')::boolean, false),
    (p_validasi -> 'rangkuman' ->> 'total_after_delivery')::numeric,
    (p_validasi -> 'rangkuman' ->> 'dpp_lainnya')::numeric,
    (p_validasi -> 'rangkuman' ->> 'vat')::numeric,
    (p_validasi -> 'rangkuman' ->> 'grand_total')::numeric,
    p_validasi -> 'rangkuman' ->> 'sumber'
  )
  returning id into v_rev_id;

  insert into project_items (
    project_id, revision_id, area, item_code, option_no, nama_item, tipe, deskripsi, dimensi,
    qty, unit, hpp_unit, harga_jual_unit, perlu_dicek, asumsi, catatan, dihitung, dobel_grup
  )
  select
    p_project_id, v_rev_id, x.area, x.item_code, coalesce(x.option_no, 1), x.nama_item, x.tipe, x.deskripsi, x.dimensi,
    x.qty, x.unit, x.hpp_unit, x.harga_jual_unit, coalesce(x.perlu_dicek, false), x.asumsi, x.catatan,
    coalesce(x.dihitung, true), x.dobel_grup
  from jsonb_to_recordset(p_items) as x(
    area text, item_code text, option_no smallint, nama_item text, tipe text, deskripsi text, dimensi text,
    qty numeric, unit text, hpp_unit numeric, harga_jual_unit numeric, perlu_dicek boolean, asumsi text, catatan text,
    dihitung boolean, dobel_grup text
  );

  v_selisih := public.refresh_revision_totals(v_rev_id);

  update projects set current_revision_id = v_rev_id, updated_at = now() where id = p_project_id;

  insert into activity_log (project_id, user_id, aksi, objek, nilai_lama, nilai_baru, alasan)
  values (
    p_project_id, v_uid, 'upload_revisi', 'revisi',
    case when v_rev_no > 1 then 'Rev ' || (v_rev_no - 1) end, 'Rev ' || v_rev_no, p_log
  );

  return query select v_rev_id, v_rev_no, v_selisih;
end;
$$;
