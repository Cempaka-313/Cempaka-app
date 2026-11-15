// Perbandingan item antar-revisi. Item dicocokkan lewat (area, kode item, opsi).
// Tanpa dependensi supaya bisa dipakai di server action, halaman, dan skrip uji Node.

export type DiffItem = {
  area: string | null
  item_code: string
  option_no: number
  nama_item: string | null
  qty: number | null
  unit: string | null
  harga_jual_unit: number | null
  hpp_unit: number | null
}

export type ChangedItem = { before: DiffItem; after: DiffItem }

export type RevisionDiff = {
  added: DiffItem[]
  removed: DiffItem[]
  qtyChanged: ChangedItem[]
  /** Harga jual/unit atau HPP/unit berubah. */
  priceChanged: ChangedItem[]
}

const EPS = 0.005

export function itemKey(i: Pick<DiffItem, "area" | "item_code" | "option_no">) {
  return `${(i.area ?? "").trim().toUpperCase()}|${i.item_code.trim().toUpperCase()}|${i.option_no}`
}

function differs(a: number | null, b: number | null) {
  if (a == null || b == null) return (a == null) !== (b == null)
  return Math.abs(Number(a) - Number(b)) > EPS
}

export function diffItems(prev: DiffItem[], next: DiffItem[]): RevisionDiff {
  const before = new Map(prev.map((i) => [itemKey(i), i]))
  const after = new Map(next.map((i) => [itemKey(i), i]))
  const diff: RevisionDiff = { added: [], removed: [], qtyChanged: [], priceChanged: [] }

  for (const [key, a] of after) {
    const b = before.get(key)
    if (!b) {
      diff.added.push(a)
      continue
    }
    if (differs(b.qty, a.qty)) diff.qtyChanged.push({ before: b, after: a })
    if (differs(b.harga_jual_unit, a.harga_jual_unit) || differs(b.hpp_unit, a.hpp_unit)) {
      diff.priceChanged.push({ before: b, after: a })
    }
  }
  for (const [key, b] of before) if (!after.has(key)) diff.removed.push(b)
  return diff
}

export function isEmptyDiff(d: RevisionDiff) {
  return !d.added.length && !d.removed.length && !d.qtyChanged.length && !d.priceChanged.length
}

export function summarizeDiff(d: RevisionDiff) {
  if (isEmptyDiff(d)) return "tidak ada perubahan item"
  const parts: string[] = []
  if (d.added.length) parts.push(`${d.added.length} item baru`)
  if (d.removed.length) parts.push(`${d.removed.length} item hilang`)
  if (d.qtyChanged.length) parts.push(`${d.qtyChanged.length} qty berubah`)
  if (d.priceChanged.length) parts.push(`${d.priceChanged.length} harga berubah`)
  return parts.join(", ")
}
