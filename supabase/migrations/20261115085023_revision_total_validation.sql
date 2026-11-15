-- Validasi total saat upload revisi Excel (keputusan Reza, 2026-11-15).
--
-- 1. project_items.dihitung / dobel_grup: baris komponen yang harganya sama dengan baris paket/set di atasnya
--    (kemungkinan hitung dobel) bisa dikeluarkan dari total; pengguna memilih baris mana yang dihitung.
-- 2. quotation_revisions.validasi: Sub Total Excel per area/opsi (+ rumus SUM, baris di luar rentang) dan
--    angka SUMMARY dari file. selisih = ada area atau SUMMARY yang tidak sama dengan jumlah baris item.
--    Aturan sama dengan src/lib/quo-excel/validation.ts.
-- 3. refresh_revision_totals(): hitung ulang total_jual / total_hpp / gpm (opsi 1, baris dihitung, qty × harga)
--    dan status selisih dari item.
-- 4. choose_counted_item(): pilih baris yang dihitung dalam satu grup hitung dobel (revisi aktif saja).
-- 5. set_revision_discrepancy_reason(): alasan "selisih disengaja" (estimator, manajer, owner, admin).
-- 6. change_project_status(): costing -> internal_review ditolak selama revisi aktif selisih tanpa alasan.
-- 7. create_quotation_revision(): versi baru — totals dihitung di database, menerima validasi.

alter table public.project_items
  add column dihitung boolean not null default true,
  add column dobel_grup text;

alter table public.quotation_revisions
  add column validasi jsonb,
  add column selisih boolean not null default false,
  add column selisih_alasan text,
  add column selisih_oleh uuid references public.profiles (id),
  add column selisih_at timestamptz;

create or replace function public.refresh_revision_totals(p_revision_id bigint)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v jsonb;
  v_tol numeric;
  v_sel boolean := false;
  a jsonb;
  v_sum numeric;
  v_all numeric;
begin
  update quotation_revisions r set
    total_jual = t.jual,
    total_hpp = t.hpp,
    gpm = case when t.jual_cov > 0 then (t.jual_cov - t.hpp) / t.jual_cov end
  from (
    select
      coalesce(sum(i.qty * i.harga_jual_unit), 0) as jual,
      coalesce(sum(i.qty * i.hpp_unit) filter (where i.hpp_unit is not null), 0) as hpp,
      coalesce(sum(i.qty * i.harga_jual_unit) filter (where i.hpp_unit is not null), 0) as jual_cov
    from project_items i
    where i.revision_id = p_revision_id and i.option_no = 1 and i.dihitung
      and i.qty is not null and i.harga_jual_unit is not null
  ) t
  where r.id = p_revision_id
  returning r.validasi, r.total_jual into v, v_all;

  if v is not null then
    v_tol := coalesce((v ->> 'tolerance')::numeric, 1);
    for a in select * from jsonb_array_elements(coalesce(v -> 'areas', '[]'::jsonb)) loop
      continue when a ->> 'excel_subtotal' is null;
      select coalesce(sum(i.qty * i.harga_jual_unit), 0) into v_sum
      from project_items i
      where i.revision_id = p_revision_id and i.area = a ->> 'area'
        and i.option_no = (a ->> 'option_no')::int and i.dihitung
        and i.qty is not null and i.harga_jual_unit is not null;
      if abs(v_sum - (a ->> 'excel_subtotal')::numeric) > v_tol then
        v_sel := true;
      end if;
    end loop;

    if jsonb_typeof(v -> 'summary') = 'object' then
      if v -> 'summary' ->> 'mode' = 'rows' then
        if abs(v_all - (v -> 'summary' ->> 'compare_value')::numeric) > v_tol then
          v_sel := true;
        end if;
      elsif coalesce((v -> 'summary' ->> 'static_mismatch')::boolean, false) then
        v_sel := true;
      end if;
    end if;
  end if;

  update quotation_revisions set selisih = v_sel where id = p_revision_id;
  return v_sel;
end;
$$;

revoke all on function public.refresh_revision_totals(bigint) from public, anon;
grant execute on function public.refresh_revision_totals(bigint) to authenticated;

create or replace function public.choose_counted_item(p_item_id bigint)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text := public.app_role();
  v_uid uuid := auth.uid();
  v_item record;
  v_current bigint;
  v_rev_no integer;
begin
  if v_uid is null or v_role is null then
    raise exception 'Sesi tidak valid.' using errcode = '42501';
  end if;
  if not (v_role = any (array['estimator', 'manajer', 'owner', 'admin'])) then
    raise exception 'Peran % tidak boleh mengubah baris yang dihitung.', v_role using errcode = '42501';
  end if;

  select i.id, i.project_id, i.revision_id, i.area, i.option_no, i.item_code, i.dobel_grup into v_item
  from project_items i where i.id = p_item_id;
  if not found or v_item.dobel_grup is null then
    raise exception 'Item bukan bagian dari pasangan hitung dobel.' using errcode = '22023';
  end if;

  select p.current_revision_id into v_current from projects p where p.id = v_item.project_id for update;
  if v_current is distinct from v_item.revision_id then
    raise exception 'Hanya revisi aktif yang bisa diubah; riwayat revisi tidak ditimpa.' using errcode = '22023';
  end if;

  update project_items set dihitung = (id = p_item_id)
  where revision_id = v_item.revision_id and area is not distinct from v_item.area
    and option_no = v_item.option_no and dobel_grup = v_item.dobel_grup;

  select rev_no into v_rev_no from quotation_revisions where id = v_item.revision_id;
  insert into activity_log (project_id, user_id, aksi, objek, nilai_baru, alasan)
  values (
    v_item.project_id, v_uid, 'pilih_hitung_dobel', v_item.dobel_grup, v_item.item_code,
    'Rev ' || v_rev_no || coalesce(' · ' || v_item.area, '') || ': yang dijumlahkan ' || v_item.item_code
  );

  return public.refresh_revision_totals(v_item.revision_id);
end;
$$;

revoke all on function public.choose_counted_item(bigint) from public, anon;
grant execute on function public.choose_counted_item(bigint) to authenticated;

create or replace function public.set_revision_discrepancy_reason(p_revision_id bigint, p_reason text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text := public.app_role();
  v_uid uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_rev record;
begin
  if v_uid is null or v_role is null then
    raise exception 'Sesi tidak valid.' using errcode = '42501';
  end if;
  if not (v_role = any (array['estimator', 'manajer', 'owner', 'admin'])) then
    raise exception 'Peran % tidak boleh mengisi alasan selisih.', v_role using errcode = '42501';
  end if;
  if v_reason is null then
    raise exception 'Alasan selisih disengaja wajib diisi.' using errcode = '22023';
  end if;

  select r.id, r.project_id, r.rev_no, r.selisih into v_rev from quotation_revisions r where r.id = p_revision_id;
  if not found then
    raise exception 'Revisi tidak ditemukan.' using errcode = 'P0002';
  end if;
  if not v_rev.selisih then
    raise exception 'Revisi ini tidak punya selisih total.' using errcode = '22023';
  end if;

  update quotation_revisions
  set selisih_alasan = v_reason, selisih_oleh = v_uid, selisih_at = now()
  where id = p_revision_id;

  insert into activity_log (project_id, user_id, aksi, objek, nilai_baru, alasan)
  values (v_rev.project_id, v_uid, 'selisih_disengaja', 'revisi', 'Rev ' || v_rev.rev_no, v_reason);
end;
$$;

revoke all on function public.set_revision_discrepancy_reason(bigint, text) from public, anon;
grant execute on function public.set_revision_discrepancy_reason(bigint, text) to authenticated;

drop function public.create_quotation_revision(bigint, text, numeric, numeric, numeric, text, jsonb, text);

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

  insert into quotation_revisions (project_id, rev_no, excel_path, kurs_usd, sumber, dibuat_oleh, catatan, validasi)
  values (p_project_id, v_rev_no, p_excel_path, v_kurs, 'upload_excel', v_uid, p_catatan, p_validasi)
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

revoke all on function public.create_quotation_revision(bigint, text, text, jsonb, text, jsonb) from public, anon;
grant execute on function public.create_quotation_revision(bigint, text, text, jsonb, text, jsonb) to authenticated;

create or replace function public.change_project_status(p_project_id bigint, p_next text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.app_role();
  v_uid uuid := auth.uid();
  v_old text;
  v_rev bigint;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_allowed text[];
  v_aksi text := 'ubah_status';
begin
  if v_uid is null or v_role is null then
    raise exception 'Sesi tidak valid.' using errcode = '42501';
  end if;

  select status, current_revision_id into v_old, v_rev
  from projects where id = p_project_id for update;
  if not found then
    raise exception 'Proyek tidak ditemukan.' using errcode = 'P0002';
  end if;
  if v_old = p_next then
    return;
  end if;

  if p_next = 'cancelled' then
    v_allowed := array['estimator', 'manajer', 'owner', 'admin'];
    if v_reason is null then
      raise exception 'Alasan pembatalan wajib diisi.' using errcode = '22023';
    end if;
  elsif v_old = 'costing' and p_next = 'internal_review' then
    v_allowed := array['estimator', 'admin'];
    v_aksi := 'ajukan_approval';
    if exists (
      select 1 from quotation_revisions r
      where r.id = v_rev and r.selisih and r.selisih_alasan is null
    ) then
      raise exception 'Masih ada selisih total di revisi aktif. Isi alasan "selisih disengaja" dulu sebelum mengajukan approval.'
        using errcode = '22023';
    end if;
  elsif v_old = 'internal_review' and p_next = 'awaiting_client' then
    v_allowed := array['manajer', 'owner', 'admin'];
    v_aksi := 'approve';
  elsif v_old = 'internal_review' and p_next = 'costing' and v_role = any (array['manajer', 'owner', 'admin']) then
    v_allowed := array['manajer', 'owner', 'admin'];
    v_aksi := 'minta_revisi';
  elsif v_old = 'awaiting_client' and p_next = 'confirmed' then
    v_allowed := array['estimator', 'manajer', 'owner', 'admin'];
  elsif v_old = 'confirmed' and p_next = 'completed' then
    v_allowed := array['manajer', 'owner', 'admin'];
  elsif p_next = 'costing' then
    v_allowed := array['estimator', 'manajer', 'owner', 'admin'];
    v_aksi := 'reset_status';
    if v_reason is null then
      raise exception 'Alasan reset status wajib diisi.' using errcode = '22023';
    end if;
  else
    raise exception 'Perubahan status % -> % tidak diizinkan.', v_old, p_next using errcode = '22023';
  end if;

  if not (v_role = any (v_allowed)) then
    raise exception 'Peran % tidak boleh mengubah status % -> %.', v_role, v_old, p_next using errcode = '42501';
  end if;

  perform set_config('app.status_change', 'on', true);
  update projects set status = p_next, updated_at = now() where id = p_project_id;
  perform set_config('app.status_change', 'off', true);

  insert into activity_log (project_id, user_id, aksi, objek, nilai_lama, nilai_baru, alasan)
  values (p_project_id, v_uid, v_aksi, 'status', v_old, p_next, v_reason);

  if v_aksi in ('approve', 'minta_revisi') and v_rev is not null then
    insert into approvals (revision_id, approver_id, peran, keputusan, komentar)
    values (v_rev, v_uid, v_role, v_aksi, v_reason);
  end if;
end;
$$;

revoke all on function public.change_project_status(bigint, text, text) from public, anon;
grant execute on function public.change_project_status(bigint, text, text) to authenticated;
