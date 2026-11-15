// Uji parser QUO_INT dan perbandingan revisi pada file lokal (mis. di samples/, yang tidak ikut ke git).
// Pemakaian: node scripts/check-quo-parse.mjs <file.xlsx> [kode-proyek] [kurs-usd] [--expect-selisih=AREA1,AREA2]
// --expect-selisih: gagal bila area yang disebut tidak memunculkan peringatan selisih Sub Total.
// Butuh Node >= 23.6 (menjalankan .ts langsung).

import { readFile } from "node:fs/promises"
import assert from "node:assert/strict"
import { parseQuoWorkbook, toItemRows } from "../src/lib/quo-excel/parse.ts"
import { diffItems, itemKey, summarizeDiff } from "../src/lib/quo-excel/diff.ts"
import { checkRangkuman, evaluateValidation } from "../src/lib/quo-excel/validation.ts"

const args = process.argv.slice(2)
const expectSelisih = args
  .find((a) => a.startsWith("--expect-selisih="))
  ?.slice("--expect-selisih=".length)
  .split(",")
  .map((a) => a.trim())
  .filter(Boolean)
const [file, projectCode = null, kurs = null] = args.filter((a) => !a.startsWith("--"))
if (!file) {
  console.error("Pemakaian: node scripts/check-quo-parse.mjs <file.xlsx> [kode-proyek] [kurs-usd]")
  process.exit(1)
}

const res = await parseQuoWorkbook(await readFile(file), { projectCode, kursUsd: kurs ? Number(kurs) : null })
const rp = (n) =>
  n == null
    ? "—"
    : res.currency === "USD"
      ? `USD ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
      : `Rp ${Math.round(n).toLocaleString("id-ID")}`

console.log(`QUO: ${res.quoNumber ?? "—"} | Revisi: ${res.revisiLabel ?? "—"} | Mata uang: ${res.currency} | Opsi: ${res.option2 ? 2 : 1}`)
for (const a of res.areas) {
  console.log(
    `Area "${a.area}" (sheet "${a.sheet}"): ${a.itemCount} item, jual ${rp(a.totalJual)}, HPP ${rp(a.totalHpp)}, Sub Total sheet ${rp(a.sheetSubTotal)}` +
      (a.totalJualOpt2 != null ? `, jual opsi 2 ${rp(a.totalJualOpt2)}` : ""),
  )
}
console.log(
  `Total: jual ${rp(res.totalJual)}, HPP ${rp(res.totalHpp)}, GPM ${res.gpm == null ? "—" : (res.gpm * 100).toFixed(1) + "%"} ` +
    `(HPP lengkap ${res.hppCount}/${res.pricedCount} baris berharga)`,
)
const flagged = res.lines.filter((l) => l.perlu_dicek)
console.log(`Perlu dicek: ${flagged.length} dari ${res.lines.length} baris`)
const rk = res.rangkuman
console.log(
  rk
    ? `Rangkuman (${rk.sumber}): Sub Total ${rp(rk.sub_total)}, Delivery ${rk.delivery_excluded ? "Excluded" : rp(rk.delivery)}, ` +
        `Total After D&I ${rp(rk.total_after_delivery)}, DPP ${rp(rk.dpp_lainnya)}, VAT ${rp(rk.vat)}, Grand Total ${rp(rk.grand_total)}`
    : "Rangkuman: (tidak terbaca)",
)
console.log("Selisih total:")
for (const e of res.errors) console.log("  !", e)
console.log("Peringatan:")
for (const w of res.warnings) console.log("  -", w)
console.log("Contoh baris:")
for (const l of res.lines.slice(0, 6)) {
  console.log(
    `  [${l.area}] ${l.item_code}${l.option_no === 2 ? " (opsi 2)" : ""} | ${l.nama_item?.slice(0, 40)} | ${l.tipe} | qty ${l.qty} ${l.unit ?? ""} | jual ${rp(l.harga_jual_unit)} | HPP ${rp(l.hpp_unit)}${l.perlu_dicek ? " | CEK: " + l.asumsi : ""}`,
  )
}

// Invarian parser
const keys = res.lines.map(itemKey)
assert.equal(new Set(keys).size, keys.length, "kunci (area, kode, opsi) harus unik")
assert.ok(res.areas.every((a) => a.itemCount > 0), "setiap area harus punya item")
const sumJual = res.lines.filter((l) => l.option_no === 1 && l.dihitung).reduce((s, l) => s + (l.total_jual ?? 0), 0)
assert.ok(Math.abs(sumJual - res.totalJual) < 0.01, "total jual revisi = jumlah baris opsi 1")
if (res.option2) {
  const sum2 = res.lines.filter((l) => l.option_no === 2 && l.dihitung).reduce((s, l) => s + (l.total_jual ?? 0), 0)
  assert.ok(Math.abs(sum2 - res.option2.totalJual) < 0.01, "total opsi 2 = jumlah baris opsi 2")
}
assert.ok(res.lines.every((l) => l.item_code && l.area), "setiap baris punya kode dan area")
assert.ok(res.lines.every((l) => !l.excluded || l.total_jual == null), "baris Not Included tidak dihitung")
const opt1Keys = new Set(res.lines.filter((l) => l.option_no === 1).map((l) => itemKey({ ...l, option_no: 1 })))
assert.ok(
  res.lines.filter((l) => l.option_no === 2).every((l) => opt1Keys.has(itemKey({ ...l, option_no: 1 }))),
  "setiap baris opsi 2 punya pasangan opsi 1",
)
assert.ok(res.lines.every((l) => l.option_no === 1 || l.option_no === 2), "maksimal 2 opsi per item")

// Validasi total
const again = evaluateValidation(res.validasi, res.lines)
assert.equal(again.hasDiscrepancy, res.hasDiscrepancy, "evaluasi ulang validasi konsisten")
assert.deepEqual(again.messages, res.errors, "pesan selisih konsisten")
for (const d of res.doubleCounts) {
  const pair = res.lines.filter((l) => l.area === d.area && l.option_no === d.option_no && l.dobel_grup === d.setCode)
  assert.equal(pair.filter((l) => l.dihitung).length, 1, `hitung dobel ${d.setCode}: tepat satu baris dijumlahkan`)
}
for (const area of expectSelisih ?? []) {
  assert.ok(
    res.errors.some((e) => e.startsWith(`${area}`) && e.includes("Sub Total Excel")),
    `area ${area} harus memunculkan peringatan selisih`,
  )
}

// Rangkuman harga
assert.ok(rk && rk.grand_total != null, "rangkuman harga (Grand Total) terbaca")
const ok = { sumber: "uji", sub_total: 1000, delivery: 100, delivery_excluded: false, total_after_delivery: 1200, dpp_lainnya: 1100, vat: 132, grand_total: 1332 }
assert.equal(checkRangkuman(ok, "IDR").length, 0, "DPP/VAT benar → tanpa peringatan")
const wrong = checkRangkuman({ ...ok, dpp_lainnya: 1200, vat: 120 }, "IDR")
assert.ok(wrong.some((w) => w.startsWith("DPP")) && wrong.some((w) => w.startsWith("VAT")), "DPP/VAT salah → peringatan")
assert.ok(checkRangkuman({ ...ok, vat: 10, delivery_excluded: true }, "USD").some((w) => /tanpa VAT/.test(w)), "export ber-VAT → peringatan")

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
