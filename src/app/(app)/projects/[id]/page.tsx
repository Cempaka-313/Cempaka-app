import Link from "next/link"
import { Fragment } from "react"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { currencyLabel, formatAmount, formatDateTime, formatMoney, formatPercent } from "@/lib/format"
import { StatusBar } from "./status-bar"
import { CommentForm } from "./comment-form"
import { UploadRevision } from "./upload-revision"
import { DownloadExcel } from "./download-excel"
import { ClampText } from "./clamp-text"
import { RevisionCompare } from "./revision-compare"
import { RevisionValidation } from "./revision-validation"
import { PriceSummary } from "./price-summary"
import { EDIT_ROLES, hasRole } from "@/lib/status"
import { diffItems } from "@/lib/quo-excel/diff"

export default async function ProjectDetailPage({ params }: PageProps<"/projects/[id]">) {
  await connection()
  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id)) notFound()

  const supabase = await createClient()

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, project_code, nama_proyek, klien, jenis, status, quo_number, kurs_usd, tanggal, catatan, current_revision_id, sales:profiles!projects_sales_id_fkey(nama), holder:profiles!projects_holder_id_fkey(nama)",
    )
    .eq("id", id)
    .maybeSingle()
  if (!project) notFound()

  let itemsQuery = supabase
    .from("project_items")
    .select("id, item_code, nama_item, tipe, area, dimensi, qty, unit, option_no, hpp_unit, harga_jual_unit, perlu_dicek, asumsi, catatan, deskripsi, dihitung, dobel_grup")
    .eq("project_id", id)
    .order("id")
  itemsQuery = project.current_revision_id
    ? itemsQuery.eq("revision_id", project.current_revision_id)
    : itemsQuery.is("revision_id", null)

  const [{ data: items }, { data: revisions }, { data: activities }, { data: role }, { count: fileCount }] =
    await Promise.all([
      itemsQuery,
      supabase
        .from("quotation_revisions")
        .select(
          "id, rev_no, sumber, total_hpp, total_jual, gpm, catatan, excel_path, created_at, validasi, selisih, selisih_alasan, selisih_at, sub_total_excel, delivery, delivery_excluded, total_after_delivery, dpp_lainnya, vat, grand_total, rangkuman_sumber, pembuat:profiles!quotation_revisions_dibuat_oleh_fkey(nama), penyetuju_selisih:profiles!quotation_revisions_selisih_oleh_fkey(nama)",
        )
        .eq("project_id", id)
        .order("rev_no", { ascending: false }),
      supabase
        .from("activity_log")
        .select("id, aksi, objek, nilai_lama, nilai_baru, alasan, created_at, user:profiles!activity_log_user_id_fkey(nama)")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.rpc("app_role"),
      supabase.from("project_files").select("id", { count: "exact", head: true }).eq("project_id", id),
    ])

  const currentRev = revisions?.find((r) => r.id === project.current_revision_id)
  const prevRev = currentRev ? revisions?.find((r) => r.rev_no < currentRev.rev_no) : undefined
  const { data: prevItems } = prevRev
    ? await supabase
        .from("project_items")
        .select("area, item_code, option_no, nama_item, qty, unit, harga_jual_unit, hpp_unit")
        .eq("revision_id", prevRev.id)
    : { data: null }
  const diff = currentRev && prevRev && prevItems ? diffItems(prevItems, items ?? []) : null
  const canUpload = hasRole(role, EDIT_ROLES) && !["completed", "cancelled"].includes(project.status)
  const approvalBlocked =
    currentRev?.selisih && !currentRev.selisih_alasan
      ? `Ajukan Approval diblok: masih ada selisih total di Rev ${currentRev.rev_no} — lihat panel Validasi total.`
      : null
  const perluDicek = items?.filter((i) => i.perlu_dicek).length ?? 0

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav className="text-sm text-zinc-500">
            <Link href="/" className="hover:text-brand">
              Proyek
            </Link>{" "}
            / <span className="text-zinc-800">{project.project_code}</span>
          </nav>
          <StatusBar projectId={project.id} status={project.status} role={role ?? null} approvalBlocked={approvalBlocked} />
        </div>

        <section className="rounded border border-zinc-200 bg-white">
          {/* Smart buttons */}
          <div className="flex flex-wrap justify-end gap-px border-b border-zinc-200 bg-zinc-200">
            <SmartButton label="Item" value={items?.length ?? 0} href="#items" />
            <SmartButton label="Revisi" value={revisions?.length ?? 0} href="#revisi" />
            <SmartButton label="File" value={fileCount ?? 0} />
            <SmartButton label="Perlu dicek" value={perluDicek} warn={perluDicek > 0} href="#items" />
          </div>

          <div className="p-4">
            <h1 className="text-2xl font-semibold">{project.nama_proyek}</h1>
            <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
              <Field label="Klien" value={project.klien} />
              <Field label="No. Quotation" value={project.quo_number} />
              <Field label="Jenis" value={project.jenis === "export" ? "Export (USD, tanpa PPN)" : "Lokal (IDR, PPN 12%)"} />
              {project.jenis === "export" && (
                <Field label="Kurs USD" value={project.kurs_usd ? formatMoney(project.kurs_usd, "lokal") : "Belum diisi"} />
              )}
              <Field label="Sales" value={project.sales?.nama} />
              <Field label="Pemegang" value={project.holder?.nama} />
              <Field label="Tanggal" value={project.tanggal} />
              <Field label="Revisi aktif" value={currentRev ? `Rev ${currentRev.rev_no}` : "—"} />
            </dl>
            {currentRev && (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                <Stat label="Total HPP" value={formatMoney(currentRev.total_hpp, project.jenis)} />
                <Stat label="Total jual" value={formatMoney(currentRev.total_jual, project.jenis)} />
                <Stat label="GPM" value={formatPercent(currentRev.gpm)} />
              </div>
            )}
            {currentRev && <PriceSummary rev={currentRev} jenis={project.jenis} className="mt-3" />}
            {project.catatan && <p className="mt-3 whitespace-pre-line text-sm text-zinc-600">{project.catatan}</p>}
          </div>
        </section>

        <section id="revisi" className="rounded border border-zinc-200 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-200 px-4 py-2">
            <h2 className="font-semibold">Riwayat revisi</h2>
            {canUpload && <UploadRevision projectId={project.id} />}
          </div>
          <ul className="divide-y divide-zinc-100 text-sm">
            {(revisions ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
                <span className="font-semibold">Rev {r.rev_no}</span>
                {r.id === project.current_revision_id && (
                  <span className="rounded bg-emerald-100 px-1.5 text-xs text-emerald-800">aktif</span>
                )}
                <span className="text-zinc-500">{r.sumber}</span>
                <span>{formatMoney(r.total_jual, project.jenis)}</span>
                <span className="text-zinc-500">GPM {formatPercent(r.gpm)}</span>
                {r.grand_total != null && (
                  <span className="text-zinc-500">Grand Total {formatMoney(r.grand_total, project.jenis)}</span>
                )}
                {r.excel_path && <DownloadExcel projectId={project.id} revisionId={r.id} />}
                <span className="ml-auto text-xs text-zinc-500">
                  {r.pembuat?.nama ?? "—"} · {formatDateTime(r.created_at)}
                </span>
                {r.grand_total != null && (
                  <details className="w-full text-xs text-zinc-600">
                    <summary className="cursor-pointer text-zinc-500">Rangkuman harga</summary>
                    <PriceSummary rev={r} jenis={project.jenis} compact className="mt-1 max-w-md" />
                  </details>
                )}
                {r.catatan && (
                  <details className="w-full text-xs text-zinc-600">
                    <summary className="cursor-pointer text-zinc-500">Catatan</summary>
                    <p className="mt-1 whitespace-pre-line">{r.catatan}</p>
                  </details>
                )}
              </li>
            ))}
            {!revisions?.length && <li className="px-4 py-6 text-center text-zinc-500">Belum ada revisi.</li>}
          </ul>
        </section>

        {currentRev && (
          <RevisionValidation
            projectId={project.id}
            revision={currentRev}
            items={items ?? []}
            jenis={project.jenis}
            canEdit={hasRole(role, EDIT_ROLES)}
          />
        )}

        <section id="items" className="rounded border border-zinc-200 bg-white">
          <h2 className="border-b border-zinc-200 px-4 py-2 font-semibold">Item</h2>
          {/* Desktop (lg+): tabel muat penuh, lebar kolom dalam persen, header sticky terhadap halaman.
              HP: tabel boleh lebih lebar dari layar → scroll horizontal di dalam kotak ini; kotak juga scroll
              vertikal supaya header sticky tetap terlihat. */}
          <div className="max-h-[75vh] overflow-auto lg:max-h-none lg:overflow-visible">
            <table className="w-full min-w-[720px] table-fixed text-xs lg:min-w-0">
              <colgroup>
                <col className="w-[9%]" />
                <col className="w-[18%]" />
                <col className="w-[26%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
                <col className="w-[7%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="text-left text-xs text-zinc-500">
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:border-b [&>th]:border-zinc-200 [&>th]:bg-zinc-50 [&>th]:px-2 [&>th]:py-2 [&>th]:font-medium">
                  <th>Kode</th>
                  <th>Nama</th>
                  <th>Material by Cempaka</th>
                  <th>Area</th>
                  <th>Dimensi</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">HPP/unit ({currencyLabel(project.jenis)})</th>
                  <th className="text-right">Jual/unit ({currencyLabel(project.jenis)})</th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((it, i) => {
                  const prev = i > 0 ? items?.[i - 1] : undefined
                  const newGroup = it.tipe && (it.tipe !== prev?.tipe || it.area !== prev?.area)
                  return (
                    <Fragment key={it.id}>
                      {newGroup && (
                        <tr className="bg-zinc-50/70">
                          <td colSpan={8} className="px-2 py-1.5 text-xs font-semibold text-zinc-600">
                            {it.tipe}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t border-zinc-100 align-top [&>td]:px-2 [&>td]:py-2.5">
                        <td className="font-mono [overflow-wrap:anywhere]">
                          {it.item_code}
                          {(it.option_no === 2 || it.perlu_dicek || it.catatan || !it.dihitung) && (
                            <div className="mt-1 flex flex-wrap gap-1 font-sans">
                              {it.option_no === 2 && <span className="rounded bg-zinc-200 px-1">Opsi 2</span>}
                              {it.catatan && <span className="rounded bg-zinc-100 px-1 text-zinc-600">{it.catatan}</span>}
                              {!it.dihitung && (
                                <span title="Tidak dijumlahkan ke total (kemungkinan hitung dobel)" className="rounded bg-zinc-200 px-1 text-zinc-600 line-through">
                                  total
                                </span>
                              )}
                              {it.perlu_dicek && (
                                <span
                                  title={it.asumsi ?? undefined}
                                  className="cursor-help rounded bg-amber-200 px-1 text-amber-900"
                                >
                                  cek
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <ClampText text={it.nama_item} className="text-sm text-zinc-900" />
                        </td>
                        <td>
                          <ClampText text={it.deskripsi} className="text-zinc-600" />
                        </td>
                        <td>
                          <span title={it.area ?? undefined} className="line-clamp-2 [overflow-wrap:anywhere]">
                            {it.area ?? "—"}
                          </span>
                        </td>
                        <td>
                          <span title={it.dimensi ?? undefined} className="line-clamp-2 [overflow-wrap:anywhere]">
                            {it.dimensi ?? "—"}
                          </span>
                        </td>
                        <td className="text-right tabular-nums [overflow-wrap:anywhere]">
                          {it.qty ?? "—"} {it.unit}
                        </td>
                        <td className="text-right tabular-nums [overflow-wrap:anywhere]">
                          {formatAmount(it.hpp_unit, project.jenis)}
                        </td>
                        <td className="text-right tabular-nums [overflow-wrap:anywhere]">
                          {formatAmount(it.harga_jual_unit, project.jenis)}
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
                {!items?.length && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-zinc-500">
                      Belum ada item.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {diff && currentRev && prevRev && (
          <RevisionCompare before={prevRev} after={currentRev} diff={diff} jenis={project.jenis} />
        )}
      </div>

      {/* Chatter */}
      <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
        <h2 className="font-semibold">Aktivitas</h2>
        <CommentForm projectId={project.id} />
        <ul className="space-y-3 text-sm">
          {(activities ?? []).map((a) => (
            <li key={a.id} className="rounded bg-white p-3 shadow-sm">
              <div className="flex justify-between text-xs text-zinc-500">
                <span className="font-medium text-zinc-800">{a.user?.nama ?? "Sistem"}</span>
                <span>{formatDateTime(a.created_at)}</span>
              </div>
              <p className="mt-1">
                {a.aksi === "komentar" ? (
                  a.alasan
                ) : a.nilai_lama || a.nilai_baru ? (
                  <>
                    {a.objek ?? a.aksi}: <span className="text-zinc-500">{a.nilai_lama ?? "—"}</span> →{" "}
                    <span className="font-medium">{a.nilai_baru ?? "—"}</span>
                    {a.alasan && <span className="block text-zinc-600">{a.alasan}</span>}
                  </>
                ) : (
                  <>
                    {a.aksi}
                    {a.alasan && `: ${a.alasan}`}
                  </>
                )}
              </p>
            </li>
          ))}
          {!activities?.length && <li className="text-zinc-500">Belum ada aktivitas.</li>}
        </ul>
      </aside>
    </div>
  )
}

function SmartButton({ label, value, href, warn }: { label: string; value: number; href?: string; warn?: boolean }) {
  const body = (
    <>
      <span className={`text-base font-semibold ${warn ? "text-amber-700" : ""}`}>{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </>
  )
  const cls = "flex min-w-24 flex-col items-center bg-white px-4 py-2 hover:bg-zinc-50"
  return href ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-zinc-500">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-zinc-50 p-2">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  )
}
