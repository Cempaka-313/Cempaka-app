// Uji parser QUO_INT dan perbandingan revisi pada file lokal (mis. di samples/, yang tidak ikut ke git).
// Pemakaian: node scripts/check-quo-parse.mjs <file.xlsx> [kode-proyek]
// Butuh Node >= 23.6 (menjalankan .ts langsung).

import { readFile } from "node:fs/promises"
import assert from "node:assert/strict"
import { parseQuoWorkbook, toItemRows } from "../src/lib/quo-excel/parse.ts"
import { diffItems, itemKey, summarizeDiff } from "../src/lib/quo-excel/diff.ts"

const [file, projectCode = null] = process.argv.slice(2)
if (!file) {
  console.error("Pemakaian: node scripts/check-quo-parse.mjs <file.xlsx> [kode-proyek]")
  process.exit(1)
}

const rp = (n) => (n == null ? "—" : `Rp ${Math.round(n).toLocaleString("id-ID")}`)
const res = await parseQuoWorkbook(await readFile(file), { projectCode })

console.log(`QUO: ${res.quoNumber ?? "—"} | Revisi: ${res.revisiLabel ?? "—"}`)
for (const a of res.areas) {
  console.log(
    `Area "${a.area}" (sheet "${a.sheet}"): ${a.itemCount} baris, jual ${rp(a.totalJual)}, HPP ${rp(a.totalHpp)}, Sub Total sheet ${rp(a.sheetSubTotal)}`,
  )
}
console.log(
  `Total: jual ${rp(res.totalJual)}, HPP ${rp(res.totalHpp)}, GPM ${res.gpm == null ? "—" : (res.gpm * 100).toFixed(1) + "%"} ` +
    `(HPP lengkap ${res.hppCount}/${res.pricedCount} baris berharga)`,
)
const flagged = res.lines.filter((l) => l.perlu_dicek)
console.log(`Perlu dicek: ${flagged.length} dari ${res.lines.length} baris`)
console.log("Peringatan:")
for (const w of res.warnings) console.log("  -", w)
console.log("Contoh baris:")
for (const l of res.lines.slice(0, 6)) {
  console.log(
    `  [${l.area}] ${l.item_code} | ${l.nama_item?.slice(0, 40)} | ${l.tipe} | qty ${l.qty} ${l.unit ?? ""} | jual ${rp(l.harga_jual_unit)} | HPP ${rp(l.hpp_unit)}${l.perlu_dicek ? " | CEK: " + l.asumsi : ""}`,
  )
}

// Invarian parser
const keys = res.lines.map(itemKey)
assert.equal(new Set(keys).size, keys.length, "kunci (area, kode, opsi) harus unik")
assert.ok(res.areas.every((a) => a.itemCount > 0), "setiap area harus punya item")
const sumJual = res.lines.reduce((s, l) => s + (l.total_jual ?? 0), 0)
assert.ok(Math.abs(sumJual - res.totalJual) < 1, "total jual = jumlah baris")
assert.ok(res.lines.every((l) => l.item_code && l.area), "setiap baris punya kode dan area")
assert.ok(res.lines.every((l) => !l.excluded || l.total_jual == null), "baris Not Included tidak dihitung")

// Perbandingan revisi
const rows = toItemRows(res.lines)
assert.equal(summarizeDiff(diffItems(rows, rows)), "tidak ada perubahan item")
const next = rows.slice(1).map((r) => ({ ...r }))
next[0].qty = (next[0].qty ?? 0) + 1
next[1].harga_jual_unit = (next[1].harga_jual_unit ?? 0) + 1000
next.push({ ...rows[0], item_code: "UJI-BARU" })
const d = diffItems(rows, next)
assert.equal(d.added.length, 1)
assert.equal(d.removed.length, 1)
assert.equal(d.qtyChanged.length, 1)
assert.equal(d.priceChanged.length, 1)
console.log("Diff uji:", summarizeDiff(d))
console.log("OK — semua pemeriksaan lolos.")
