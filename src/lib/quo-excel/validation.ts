// Validasi total revisi: Sub Total di Excel vs jumlah baris item (qty × harga jual), dan SUMMARY vs semua area.
// Dipakai parser (saat upload) dan halaman proyek (setelah pilihan "dihitung" diubah). Aturan yang sama
// dicerminkan di fungsi database refresh_revision_totals() — yang menentukan boleh tidaknya Ajukan Approval.
// Tanpa dependensi supaya bisa dijalankan langsung oleh Node (scripts/check-quo-parse.mjs).

export type RowRef = { row: number; code: string }

export type AreaCheckData = {
  area: string
  sheet: string
  option_no: number
  /** Nilai Sub Total yang tertulis di Excel (null bila tidak terbaca). */
  excel_subtotal: number | null
  /** Rumus Sub Total di Excel, mis. "SUM(Y32:Y59)" (null bila nilai statis / tidak terbaca). */
  sum_formula: string | null
  /** Baris item yang dihargai tetapi di luar rentang rumus Sub Total (null bila rumus tidak bisa dibaca). */
  rows_outside: RowRef[] | null
  /** Baris yang kolom TOTAL PRICE di Excel-nya tidak sama dengan qty × harga jual. */
  rows_total_mismatch?: (RowRef & { excel_total: number; computed: number })[] | null
}

export type SummaryCheckData = {
  sheet: string
  sub_total: number | null
  grand_total: number | null
  /**
   * rows   — SUMMARY punya Sub Total (sebelum Delivery & PPN): dibandingkan dengan jumlah baris item semua area.
   * static — SUMMARY hanya punya Grand Total: dibandingkan dengan jumlah Grand Total semua sheet area (Excel).
   */
  mode: "rows" | "static"
  compare_value: number
  areas_grand_total: number | null
  static_mismatch: boolean
}

export type Validasi = {
  currency: "IDR" | "USD"
  tolerance: number
  areas: AreaCheckData[]
  summary: SummaryCheckData | null
  /** Rangkuman harga di bawah Sub Total (opsi 1); disalin ke kolom quotation_revisions saat upload. */
  rangkuman?: Rangkuman | null
}

/** Baris di bawah Sub Total di Excel (opsi 1). Null = tidak ada / tidak terbaca. */
export type Rangkuman = {
  /** Asal angka: nama sheet SUMMARY, atau daftar sheet area yang footer-nya dijumlahkan. */
  sumber: string
  sub_total: number | null
  delivery: number | null
  /** Delivery ditulis "Excluded" (umumnya proyek export). */
  delivery_excluded: boolean
  total_after_delivery: number | null
  dpp_lainnya: number | null
  vat: number | null
  grand_total: number | null
}

/** Cek DPP Lainnya = 11/12 × Total After Delivery dan VAT = 12% × DPP (lokal); export tanpa VAT. */
export function checkRangkuman(r: Rangkuman, currency: "IDR" | "USD"): string[] {
  const money = (n: number) => formatValidationMoney(n, currency)
  const tol = currency === "USD" ? 0.01 : 1
  const out: string[] = []
  if (currency === "IDR") {
    if (r.total_after_delivery != null && r.dpp_lainnya != null) {
      const expected = (r.total_after_delivery * 11) / 12
      if (Math.abs(r.dpp_lainnya - expected) > tol) {
        out.push(
          `DPP Lainnya di Excel ${money(r.dpp_lainnya)}, seharusnya 11/12 × Total After Delivery = ${money(expected)} ` +
            `(selisih ${money(Math.abs(r.dpp_lainnya - expected))}).`,
        )
      }
    }
    if (r.dpp_lainnya != null && r.vat != null) {
      const expected = r.dpp_lainnya * 0.12
      if (Math.abs(r.vat - expected) > tol) {
        out.push(
          `VAT 12% di Excel ${money(r.vat)}, seharusnya 12% × DPP = ${money(expected)} ` +
            `(selisih ${money(Math.abs(r.vat - expected))}).`,
        )
      }
    }
  } else {
    if (r.vat != null && Math.abs(r.vat) > tol) {
      out.push(`Proyek export seharusnya tanpa VAT, tetapi Excel berisi VAT ${money(r.vat)}.`)
    }
    if (!r.delivery_excluded && r.delivery != null && Math.abs(r.delivery) > tol) {
      out.push(`Delivery proyek export biasanya "Excluded", tetapi Excel berisi ${money(r.delivery)}.`)
    }
  }
  return out
}

export type CountableItem = {
  area: string | null
  option_no: number
  dihitung: boolean
  qty: number | null
  harga_jual_unit: number | null
}

export type AreaResult = AreaCheckData & { computed: number; diff: number; mismatch: boolean }
export type SummaryResult = SummaryCheckData & { computed: number; diff: number; mismatch: boolean }

export type ValidationResult = {
  areas: AreaResult[]
  summary: SummaryResult | null
  hasDiscrepancy: boolean
  messages: string[]
}

export function lineTotal(i: Pick<CountableItem, "qty" | "harga_jual_unit">) {
  return i.qty != null && i.harga_jual_unit != null ? Number(i.qty) * Number(i.harga_jual_unit) : null
}

export function sumCounted(items: CountableItem[], area: string | null, optionNo: number) {
  return items
    .filter((i) => i.dihitung && i.option_no === optionNo && (area == null || i.area === area))
    .reduce((s, i) => s + (lineTotal(i) ?? 0), 0)
}

export function formatValidationMoney(n: number, currency: "IDR" | "USD") {
  return currency === "USD"
    ? `USD ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
    : `Rp ${Math.round(n).toLocaleString("id-ID")}`
}

export function evaluateValidation(v: Validasi, items: CountableItem[]): ValidationResult {
  const money = (n: number) => formatValidationMoney(n, v.currency)
  const multiOption = v.areas.some((a) => a.option_no === 2)
  const messages: string[] = []

  const areas: AreaResult[] = v.areas.map((a) => {
    const computed = sumCounted(items, a.area, a.option_no)
    const diff = a.excel_subtotal == null ? 0 : computed - a.excel_subtotal
    const mismatch = a.excel_subtotal != null && Math.abs(diff) > v.tolerance
    if (mismatch) {
      const label = `${a.area}${multiOption ? ` (opsi ${a.option_no})` : ""}`
      let msg =
        `${label}: Sub Total Excel ${money(a.excel_subtotal as number)}, jumlah baris ${money(computed)}, ` +
        `selisih ${money(Math.abs(diff))}.`
      msg += a.sum_formula ? ` Rumus Sub Total di Excel: =${a.sum_formula}.` : " Sub Total di Excel berupa nilai statis."
      if (a.rows_outside?.length) {
        msg += ` Baris di luar rentang: ${a.rows_outside.map((r) => `${r.row} (${r.code})`).join(", ")}.`
      }
      if (a.rows_total_mismatch?.length) {
        msg += ` Total Excel ≠ qty × harga di baris: ${a.rows_total_mismatch
          .map((r) => `${r.row} (${r.code}): Excel ${money(r.excel_total)}, qty × harga ${money(r.computed)}`)
          .join("; ")}.`
      }
      messages.push(msg)
    }
    return { ...a, computed, diff, mismatch }
  })

  let summary: SummaryResult | null = null
  if (v.summary) {
    const s = v.summary
    if (s.mode === "rows") {
      const computed = sumCounted(items, null, 1)
      const diff = computed - s.compare_value
      const mismatch = Math.abs(diff) > v.tolerance
      if (mismatch) {
        messages.push(
          `${s.sheet}: Sub Total ${money(s.compare_value)}` +
            (s.grand_total != null ? ` (Grand Total ${money(s.grand_total)} setelah Delivery & PPN)` : "") +
            `, jumlah baris semua area ${money(computed)}, selisih ${money(Math.abs(diff))}.`,
        )
      }
      summary = { ...s, computed, diff, mismatch }
    } else {
      const computed = s.areas_grand_total ?? 0
      const diff = computed - s.compare_value
      if (s.static_mismatch) {
        messages.push(
          `${s.sheet}: Grand Total ${money(s.compare_value)}, jumlah Grand Total semua sheet area ${money(computed)}, ` +
            `selisih ${money(Math.abs(diff))}.`,
        )
      }
      summary = { ...s, computed, diff, mismatch: s.static_mismatch }
    }
  }

  return {
    areas,
    summary,
    hasDiscrepancy: areas.some((a) => a.mismatch) || !!summary?.mismatch,
    messages,
  }
}

/** Rentang baris yang dirujuk rumus untuk satu kolom, mis. "SUM(Y22:Y30,Y32:Y59)" → [[22,30],[32,59]]. */
export function formulaRowRanges(formula: string, columnLetter: string): [number, number][] | null {
  const ranges: [number, number][] = []
  const re = /\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?/g
  for (const m of formula.toUpperCase().matchAll(re)) {
    const [, c1, r1, c2, r2] = m
    if (c1 !== columnLetter || (c2 && c2 !== columnLetter)) continue
    const a = Number(r1)
    const b = r2 ? Number(r2) : a
    ranges.push([Math.min(a, b), Math.max(a, b)])
  }
  return ranges.length ? ranges : null
}
