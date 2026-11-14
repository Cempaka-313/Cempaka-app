import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { formatDateTime, formatMoney, formatPercent } from "@/lib/format"
import { StatusBar } from "./status-bar"
import { CommentForm } from "./comment-form"
import { EDIT_ROLES, hasRole } from "@/lib/status"

export default async function ProjectDetailPage({ params }: PageProps<"/projects/[id]">) {
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
    .select("id, item_code, nama_item, tipe, area, dimensi, qty, unit, option_no, hpp_unit, harga_jual_unit, perlu_dicek")
    .eq("project_id", id)
    .order("item_code")
    .order("option_no")
  itemsQuery = project.current_revision_id
    ? itemsQuery.eq("revision_id", project.current_revision_id)
    : itemsQuery.is("revision_id", null)

  const [{ data: items }, { data: revisions }, { data: activities }, { data: role }, { count: fileCount }] =
    await Promise.all([
      itemsQuery,
      supabase
        .from("quotation_revisions")
        .select("id, rev_no, sumber, total_hpp, total_jual, gpm, catatan, created_at, pembuat:profiles!quotation_revisions_dibuat_oleh_fkey(nama)")
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

  const canEdit = hasRole(role, EDIT_ROLES)
  const currentRev = revisions?.find((r) => r.id === project.current_revision_id)
  const perluDicek = items?.filter((i) => i.perlu_dicek).length ?? 0

  return (
    <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav className="text-sm text-zinc-500">
            <Link href="/" className="hover:text-brand">
              Proyek
            </Link>{" "}
            / <span className="text-zinc-800">{project.project_code}</span>
          </nav>
          <StatusBar projectId={project.id} status={project.status} canEdit={canEdit} />
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
            {project.catatan && <p className="mt-3 whitespace-pre-line text-sm text-zinc-600">{project.catatan}</p>}
          </div>
        </section>

        <section id="items" className="rounded border border-zinc-200 bg-white">
          <h2 className="border-b border-zinc-200 px-4 py-2 font-semibold">Item</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Kode</th>
                  <th className="px-3 py-2">Nama</th>
                  <th className="px-3 py-2">Area</th>
                  <th className="px-3 py-2">Dimensi</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">HPP/unit</th>
                  <th className="px-3 py-2 text-right">Jual/unit</th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((it) => (
                  <tr key={it.id} className="border-t border-zinc-100">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                      {it.item_code}
                      {it.option_no === 2 && <span className="ml-1 rounded bg-zinc-200 px-1">Opsi 2</span>}
                      {it.perlu_dicek && <span className="ml-1 rounded bg-amber-200 px-1 text-amber-900">cek</span>}
                    </td>
                    <td className="px-3 py-2">
                      {it.nama_item ?? "—"}
                      {it.tipe && <div className="text-xs text-zinc-500">{it.tipe}</div>}
                    </td>
                    <td className="px-3 py-2">{it.area ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">{it.dimensi ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {it.qty ?? "—"} {it.unit}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{formatMoney(it.hpp_unit, project.jenis)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{formatMoney(it.harga_jual_unit, project.jenis)}</td>
                  </tr>
                ))}
                {!items?.length && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                      Belum ada item.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="revisi" className="rounded border border-zinc-200 bg-white">
          <h2 className="border-b border-zinc-200 px-4 py-2 font-semibold">Riwayat revisi</h2>
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
                <span className="ml-auto text-xs text-zinc-500">
                  {r.pembuat?.nama ?? "—"} · {formatDateTime(r.created_at)}
                </span>
              </li>
            ))}
            {!revisions?.length && <li className="px-4 py-6 text-center text-zinc-500">Belum ada revisi.</li>}
          </ul>
        </section>
      </div>

      {/* Chatter */}
      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
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
