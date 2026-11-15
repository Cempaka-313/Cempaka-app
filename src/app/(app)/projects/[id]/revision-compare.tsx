import { formatMoney, formatPercent } from "@/lib/format"
import { isEmptyDiff, type ChangedItem, type DiffItem, type RevisionDiff } from "@/lib/quo-excel/diff"

type Rev = { rev_no: number; total_jual: number | null; total_hpp: number | null; gpm: number | null }

// Perbandingan revisi aktif dengan revisi sebelumnya: total, GPM, dan daftar item yang berubah.
export function RevisionCompare({ before, after, diff, jenis }: { before: Rev; after: Rev; diff: RevisionDiff; jenis: string }) {
  const money = (v: number | null) => formatMoney(v, jenis)
  const gpmDelta = before.gpm != null && after.gpm != null ? (after.gpm - before.gpm) * 100 : null

  return (
    <section id="perbandingan" className="rounded border border-zinc-200 bg-white">
      <h2 className="border-b border-zinc-200 px-4 py-2 font-semibold">
        Perbandingan Rev {after.rev_no} vs Rev {before.rev_no}
      </h2>
      <div className="grid gap-2 p-4 text-sm sm:grid-cols-3">
        <Delta label="Total jual" before={money(before.total_jual)} after={money(after.total_jual)} changed={before.total_jual !== after.total_jual} />
        <Delta label="Total HPP" before={money(before.total_hpp)} after={money(after.total_hpp)} changed={before.total_hpp !== after.total_hpp} />
        <Delta
          label="GPM"
          before={formatPercent(before.gpm)}
          after={formatPercent(after.gpm)}
          changed={gpmDelta != null && Math.abs(gpmDelta) >= 0.05}
          note={gpmDelta != null && Math.abs(gpmDelta) >= 0.05 ? `${gpmDelta > 0 ? "+" : ""}${gpmDelta.toLocaleString("id-ID", { maximumFractionDigits: 1 })} poin` : undefined}
          tone={gpmDelta == null ? undefined : gpmDelta < 0 ? "down" : "up"}
        />
      </div>
      <div className="flex flex-wrap gap-2 px-4 pb-3 text-xs">
        <Chip label="Item baru" n={diff.added.length} cls="bg-emerald-100 text-emerald-800" />
        <Chip label="Item hilang" n={diff.removed.length} cls="bg-rose-100 text-rose-800" />
        <Chip label="Qty berubah" n={diff.qtyChanged.length} cls="bg-sky-100 text-sky-800" />
        <Chip label="Harga berubah" n={diff.priceChanged.length} cls="bg-amber-100 text-amber-800" />
      </div>
      {isEmptyDiff(diff) ? (
        <p className="px-4 pb-4 text-sm text-zinc-500">Tidak ada perubahan item.</p>
      ) : (
        <div className="divide-y divide-zinc-100 border-t border-zinc-100 text-sm">
          <ItemList title="Item baru" items={diff.added} jenis={jenis} />
          <ItemList title="Item hilang" items={diff.removed} jenis={jenis} />
          <ChangeList title="Qty berubah" rows={diff.qtyChanged} render={(i) => `${i.qty ?? "—"} ${i.unit ?? ""}`} />
          <ChangeList
            title="Harga berubah"
            rows={diff.priceChanged}
            render={(i) => `Jual ${money(i.harga_jual_unit)} · HPP ${money(i.hpp_unit)}`}
          />
        </div>
      )}
    </section>
  )
}

function Delta(props: { label: string; before: string; after: string; changed: boolean; note?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded bg-zinc-50 p-2">
      <div className="text-xs text-zinc-500">{props.label}</div>
      <div className="text-zinc-500 line-through decoration-zinc-300">{props.changed ? props.before : ""}</div>
      <div className="font-semibold">
        {props.after}
        {props.note && (
          <span className={`ml-1 text-xs ${props.tone === "down" ? "text-rose-600" : "text-emerald-700"}`}>({props.note})</span>
        )}
      </div>
    </div>
  )
}

function Chip({ label, n, cls }: { label: string; n: number; cls: string }) {
  return <span className={`rounded px-2 py-0.5 ${n ? cls : "bg-zinc-100 text-zinc-500"}`}>{label}: {n}</span>
}

function label(i: DiffItem) {
  return (
    <>
      <span className="font-mono text-xs">{i.item_code}</span>
      {i.area && <span className="ml-1 text-xs text-zinc-500">({i.area})</span>}
      {i.option_no === 2 && <span className="ml-1 rounded bg-zinc-200 px-1 text-xs">Opsi 2</span>}
      <span className="ml-2">{i.nama_item ?? "—"}</span>
    </>
  )
}

function ItemList({ title, items, jenis }: { title: string; items: DiffItem[]; jenis: string }) {
  if (!items.length) return null
  return (
    <details className="px-4 py-2" open={items.length <= 10}>
      <summary className="cursor-pointer font-medium">
        {title} ({items.length})
      </summary>
      <ul className="mt-1 space-y-1">
        {items.map((i) => (
          <li key={`${i.area}|${i.item_code}|${i.option_no}`} className="flex flex-wrap justify-between gap-x-4">
            <span>{label(i)}</span>
            <span className="text-zinc-600">
              {i.qty ?? "—"} {i.unit} × {formatMoney(i.harga_jual_unit, jenis)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

function ChangeList({ title, rows, render }: { title: string; rows: ChangedItem[]; render: (i: DiffItem) => string }) {
  if (!rows.length) return null
  return (
    <details className="px-4 py-2" open={rows.length <= 10}>
      <summary className="cursor-pointer font-medium">
        {title} ({rows.length})
      </summary>
      <ul className="mt-1 space-y-1">
        {rows.map(({ before, after }) => (
          <li key={`${after.area}|${after.item_code}|${after.option_no}`} className="flex flex-wrap justify-between gap-x-4">
            <span>{label(after)}</span>
            <span>
              <span className="text-zinc-500">{render(before)}</span> → <span className="font-medium">{render(after)}</span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
