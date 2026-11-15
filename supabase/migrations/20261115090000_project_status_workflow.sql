-- Alur status proyek (keputusan Reza, 2026-11-15). Status tidak boleh diubah bebas:
--   costing         -> internal_review : "Ajukan Approval"   (estimator, admin)
--   internal_review -> awaiting_client : approve            (manajer, owner, admin)
--   internal_review -> costing         : "Minta Revisi"     (manajer, owner, admin)
--   awaiting_client -> confirmed       :                    (estimator, manajer, owner, admin)
--   confirmed       -> completed       :                    (manajer, owner, admin)
--   (status apa pun)-> cancelled       : wajib alasan       (estimator, manajer, owner, admin)
-- Satu-satunya jalan mengubah status adalah RPC change_project_status(); fungsi ini
-- memvalidasi, mengubah status, menulis activity_log, dan mencatat approvals bila ada revisi aktif.
-- Trigger menolak UPDATE status langsung (mis. dari API) yang tidak lewat RPC.

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
  elsif v_old = 'internal_review' and p_next = 'awaiting_client' then
    v_allowed := array['manajer', 'owner', 'admin'];
    v_aksi := 'approve';
  elsif v_old = 'internal_review' and p_next = 'costing' then
    v_allowed := array['manajer', 'owner', 'admin'];
    v_aksi := 'minta_revisi';
  elsif v_old = 'awaiting_client' and p_next = 'confirmed' then
    v_allowed := array['estimator', 'manajer', 'owner', 'admin'];
  elsif v_old = 'confirmed' and p_next = 'completed' then
    v_allowed := array['manajer', 'owner', 'admin'];
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

create or replace function public.guard_project_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.status_change', true), 'off') <> 'on' then
    raise exception 'Status proyek hanya bisa diubah lewat change_project_status().' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger trg_guard_project_status
  before update of status on public.projects
  for each row execute function public.guard_project_status();
