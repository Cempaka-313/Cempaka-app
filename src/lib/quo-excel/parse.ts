// Pembaca file QUO_INT Cempaka (.xlsx) untuk upload revisi. Hanya membaca — file tidak diubah.
//
// Sumber data:
// - Sheet area: setiap sheet yang punya baris header dengan kolom D = "DESCRIPTION" (baris 17–19 tergantung
//   versi template). Kolom dikenali dari teks header — bukan posisi tetap — karena tiap versi template
//   menggeser kolom. Pencarian dibatasi sampai kolom REMARK supaya blok VARIATION di kanannya tidak terbaca.
//   Nama area = nama sheet tanpa kode proyek.
//     kode            CODE / ITEM CODE              qty     TOTAL ORDER QTY / QTY
//     deskripsi item  DESCRIPTION                   unit    UNIT
//     material opsi 1 PROPOSE MATERIAL / MATERIAL PROPOSAL OPTION 1 / MATERIAL OPT. 1 / MATERIAL By Cempaka
//     material opsi 2 MATERIAL PROPOSAL OPTION 2 / MATERIAL OPT. 2 / MATERIAL OPTION 2 …
//     harga           grup header UNIT PRICE / PRICE / OPTION 1 (opsi 1) atau … OPTION 2 … (opsi 2),
//                     sub-header PRICE / UNIT COST (per unit) dan TOTAL PRICE / TOTAL COST (total)
//     cost            blok "COST OK": kolom "IDR" terakhir (setelah diskon)
//   Proyek 2 opsi (kolom harga opsi 2 ada) menghasilkan dua baris per item: option_no 1 dan 2.
// - Sheet REKAP: HPP/unit (IDR), harga jual/unit hasil BOM, dan status per kode item.
//
// Angka diambil dari nilai tersimpan (cached value) hasil hitung Excel. Rumus yang belum pernah dihitung
// Excel tidak punya nilai; barisnya ditandai perlu dicek.
//
// File ini sengaja hanya bergantung pada exceljs supaya bisa dijalankan langsung dengan Node
// (scripts/check-quo-parse.mjs).

import * as excelNs from "exceljs"

type ExcelModule = typeof excelNs
type Worksheet = excelNs.Worksheet
type Cell = excelNs.Cell

// Node (ESM → CJS) menaruh modul di `.default`; bundler Next menaruhnya langsung di namespace.
const ExcelJS: ExcelModule = (excelNs as unknown as { default?: ExcelModule }).default ?? excelNs

export type ParsedItem = {
  area: string
  item_code: string
  option_no: number
  nama_item: string | null
  tipe: string | null
  deskripsi: string | null
  dimensi: string | null
  qty: number | null
  unit: string | null
  hpp_unit: number | null
  harga_jual_unit: number | null
  perlu_dicek: boolean
  asumsi: string | null
  catatan: string | null
}

export type ParsedLine = ParsedItem & {
  sheet: string
  row: number
  /** Total harga jual baris (kolom total, atau qty × harga bila total kosong). Null bila baris tidak dihargai. */
  total_jual: number | null
  /** HPP baris = hpp_unit × qty. */
  total_hpp: number | null
  excluded: boolean
}

export type AreaSummary = {
  sheet: string
  area: string
  /** Jumlah item (baris Excel); item 2 opsi dihitung sekali. */
  itemCount: number
  /** Total & Sub Total di bawah ini untuk opsi 1. */
  totalJual: number
  totalHpp: number
  /** Nilai Sub Total yang tertulis di sheet (bisa beda bila rentang rumus SUM tidak mencakup semua baris). */
  sheetSubTotal: number | null
  /** Total jual opsi 2, null bila sheet hanya 1 opsi. */
  totalJualOpt2: number | null
}

export type ParseResult = {
  lines: ParsedLine[]
  areas: AreaSummary[]
  /** Total, HPP, dan GPM revisi dihitung dari opsi 1. */
  totalJual: number
  totalHpp: number
  /** Rasio (0.25 = 25%), dihitung dari baris opsi 1 yang punya harga jual dan HPP. */
  gpm: number | null
  pricedCount: number
  hppCount: number
  /** Ringkasan opsi 2, null bila file hanya 1 opsi. */
  option2: { totalJual: number; pricedCount: number } | null
  /** Mata uang harga jual menurut header kolom harga ("(USD)" → USD). */
  currency: "IDR" | "USD"
  quoNumber: string | null
  revisiLabel: string | null
  warnings: string[]
}

export class QuoParseError extends Error {}

type CellValue =
  | { kind: "empty" }
  | { kind: "num"; v: number }
  | { kind: "text"; v: string }
  | { kind: "nocache" }
  | { kind: "error"; v: string }

const MAX_TEXT = 2000
const MAX_MATERIAL = 4000

function read(cell: Cell): CellValue {
  return fromRaw(cell.value as unknown)
}

function fromRaw(x: unknown): CellValue {
  if (x === null || x === undefined || x === "") return { kind: "empty" }
  if (typeof x === "number") return Number.isFinite(x) ? { kind: "num", v: x } : { kind: "error", v: "#NUM!" }
  if (typeof x === "string") return x.trim() ? { kind: "text", v: x } : { kind: "empty" }
  if (typeof x === "boolean") return { kind: "text", v: x ? "TRUE" : "FALSE" }
  if (x instanceof Date) return { kind: "text", v: x.toISOString().slice(0, 10) }
  if (typeof x === "object") {
    const o = x as Record<string, unknown>
    if ("formula" in o || "sharedFormula" in o) {
      return "result" in o && o.result !== undefined ? fromRaw(o.result) : { kind: "nocache" }
    }
    if ("error" in o) return { kind: "error", v: String(o.error) }
    if (Array.isArray(o.richText)) {
      const t = (o.richText as { text?: string }[]).map((r) => r.text ?? "").join("")
      return t.trim() ? { kind: "text", v: t } : { kind: "empty" }
    }
    if (typeof o.text === "string") return o.text.trim() ? { kind: "text", v: o.text } : { kind: "empty" }
  }
  return { kind: "empty" }
}

function text(v: CellValue): string | null {
  if (v.kind === "text") return v.v.replace(/\s+/g, " ").trim() || null
  if (v.kind === "num") return String(v.v)
  return null
}

/** Seperti text(), tetapi baris baru dipertahankan (untuk material yang ditulis per baris). */
function multiline(v: CellValue): string | null {
  if (v.kind !== "text") return text(v)
  const lines = v.v
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
  return lines.length ? lines.join("\n") : null
}

function num(v: CellValue): number | null {
  if (v.kind === "num") return v.v
  if (v.kind === "text") {
    const t = v.v.trim()
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  }
  return null
}

function clip(s: string | null, max = MAX_TEXT): string | null {
  return s && s.length > max ? s.slice(0, max) : s
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s/&(-])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase())
}

// ---------------------------------------------------------------------------------------------------------
// Deteksi kolom dari header

type PriceCols = { unit: number; total: number | null }

type Layout = {
  headerRow: number
  firstDataRow: number
  no: number | null
  code: number
  desc: number
  picture: number | null
  clientMaterial: number | null
  material1: number | null
  material2: number | null
  dims: { w: number | null; d: number | null; h: number | null; sh: number | null }
  qty: number
  unit: number | null
  fabricQty: number | null
  fabricUnit: number | null
  price1: PriceCols
  price2: PriceCols | null
  cost: number | null
  currency: "IDR" | "USD"
}

const up = (ws: Worksheet, r: number, c: number) => (text(read(ws.getCell(r, c))) ?? "").toUpperCase()

function findHeaderRow(ws: Worksheet) {
  for (let r = 1; r <= Math.min(60, ws.rowCount); r++) if (up(ws, r, 4) === "DESCRIPTION") return r
  return 0
}

function detectLayout(ws: Worksheet): Layout | null {
  const hr = findHeaderRow(ws)
  if (!hr) return null
  const sub = hr + 1
  const lastCol = Math.min(ws.columnCount, 120)

  // Batas kanan tabel quotation: kolom REMARK pertama.
  let end = lastCol
  for (let c = 1; c <= lastCol; c++) {
    if (up(ws, hr, c).startsWith("REMARK")) {
      end = c - 1
      break
    }
  }

  const find = (re: RegExp, from = 1) => {
    for (let c = from; c <= end; c++) if (re.test(up(ws, hr, c))) return c
    return null
  }

  const code = find(/^(ITEM )?CODE$/)
  const desc = 4
  const qty = find(/^(TOTAL ORDER )?QTY$/)
  if (!code || !qty) return null

  const dimCols: number[] = []
  const fabricCols: number[] = []
  for (let c = 1; c <= end; c++) {
    const h = up(ws, hr, c)
    if (h.startsWith("PRODUCT DIMENSION")) dimCols.push(c)
    if (h.startsWith("FABRIC CONSUMPTION")) fabricCols.push(c)
  }
  const dimOf = (label: string) => dimCols.find((c) => up(ws, sub, c) === label) ?? null

  // Material: opsi 1 eksplisit lebih diutamakan daripada "PROPOSE MATERIAL" generik.
  const material1 =
    find(/^MATERIAL PROPOSAL OPTION 1|^MATERIAL OPT(ION|\.)? ?1\b/) ??
    find(/^PROPOSE(D)? MATERIAL|^MATERIAL BY CEMPAKA/)
  const material2 = find(/^MATERIAL PROPOSAL OPTION 2|^MATERIAL OPT(ION|\.)? ?2\b/)

  // Grup harga: header grup di baris hr, sub-header di baris hr+1.
  const groups = new Map<1 | 2, PriceCols>()
  let currency: "IDR" | "USD" = "IDR"
  for (let c = 1; c <= end; c++) {
    const g = up(ws, hr, c)
    const s = up(ws, sub, c)
    if (!g || g.startsWith("TARGET")) continue
    const opt: 1 | 2 | null = /OPTION 2|OPT\.? ?2/.test(g)
      ? 2
      : /OPTION 1|OPT\.? ?1/.test(g) || /^(UNIT )?PRICE$/.test(g)
        ? 1
        : null
    if (!opt) continue
    const isUnit = /^(UNIT )?(PRICE|COST)\b/.test(s) && !s.startsWith("TOTAL")
    const isTotal = /^TOTAL (PRICE|COST)\b/.test(s)
    const cur = groups.get(opt)
    if (isUnit && !cur) groups.set(opt, { unit: c, total: null })
    else if (isTotal && cur && cur.total == null) cur.total = c
    if ((isUnit || isTotal) && s.includes("(USD)")) currency = "USD"
  }
  const price1 = groups.get(1)
  if (!price1) return null

  // Cost setelah diskon: kolom "IDR" terakhir di blok "COST OK" (beberapa baris di atas header).
  let cost: number | null = null
  for (let c = end + 1; c <= lastCol; c++) {
    let inBlock = false
    for (let r = Math.max(1, hr - 5); r < hr; r++) if (up(ws, r, c) === "COST OK") inBlock = true
    if (inBlock && up(ws, hr, c) === "IDR") cost = c
  }

  return {
    headerRow: hr,
    firstDataRow: hr + 2,
    no: find(/^NO\.?$/),
    code,
    desc,
    picture: find(/^(PICTURE|IMAGE)$/),
    clientMaterial: find(/^MATERIAL BY CLIENT$|^MATERIAL$/),
    material1,
    material2,
    dims: { w: dimOf("W"), d: dimOf("D"), h: dimOf("H"), sh: dimOf("SH") },
    qty,
    unit: find(/^UNIT$/, qty),
    fabricQty: fabricCols[1] ?? null,
    fabricUnit: fabricCols[2] ?? null,
    price1,
    price2: groups.get(2) ?? null,
    cost,
    currency,
  }
}

// ---------------------------------------------------------------------------------------------------------

type RekapRow = { hpp: number | null; jual: number | null; status: string | null }

function readRekap(ws: Worksheet | undefined): Map<string, RekapRow> {
  const map = new Map<string, RekapRow>()
  if (!ws) return map
  let headerRow = 0
  for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
    if ((text(read(ws.getCell(r, 1))) ?? "").toLowerCase() === "kode item") {
      headerRow = r
      break
    }
  }
  if (!headerRow) return map
  const cols: Record<string, number> = {}
  ws.getRow(headerRow).eachCell((cell, col) => {
    const h = (text(read(cell)) ?? "").toLowerCase()
    if (h.startsWith("hpp / unit")) cols.hpp = col
    else if (h.startsWith("harga jual / unit (idr)")) cols.jual = col
    else if (h === "status") cols.status = col
  })
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const code = text(read(ws.getCell(r, 1)))
    if (!code) continue
    map.set(normCode(code), {
      hpp: cols.hpp ? num(read(ws.getCell(r, cols.hpp))) : null,
      jual: cols.jual ? num(read(ws.getCell(r, cols.jual))) : null,
      status: cols.status ? text(read(ws.getCell(r, cols.status))) : null,
    })
  }
  return map
}

function normCode(code: string) {
  return code.replace(/\s+/g, " ").trim().toUpperCase()
}

function areaName(sheet: string, projectCode?: string | null) {
  const name = sheet.replace(/\s+/g, " ").trim()
  if (projectCode) {
    const pc = projectCode.trim().toUpperCase()
    if (name.toUpperCase().startsWith(pc + " ")) {
      const rest = name.slice(pc.length).trim()
      if (rest) return rest
    }
  }
  return name
}

function formatDim(w: number | null, d: number | null, h: number | null, sh: number | null) {
  const parts = [w, d, h].map((n) => (n == null ? "-" : String(n)))
  if (w == null && d == null && h == null) return null
  return `${parts.join(" x ")} mm${sh != null ? ` (SH ${sh})` : ""}`
}

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`
const money = (n: number, currency: "IDR" | "USD") =>
  currency === "USD" ? `USD ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : rupiah(n)

export async function parseQuoWorkbook(
  data: ArrayBuffer | Uint8Array,
  opts: { projectCode?: string | null; kursUsd?: number | null } = {},
): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook()
  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    await wb.xlsx.load(bytes as unknown as ArrayBuffer)
  } catch {
    throw new QuoParseError("File tidak bisa dibaca sebagai .xlsx. Pastikan file disimpan dari Excel dalam format .xlsx.")
  }

  const areaSheets = wb.worksheets
    .map((ws) => ({ ws, layout: detectLayout(ws) }))
    .filter((x): x is { ws: Worksheet; layout: Layout } => x.layout != null)
  if (!areaSheets.length) {
    throw new QuoParseError(
      "Tidak ditemukan sheet area dengan format template QUO_INT (header DESCRIPTION, CODE, QTY, dan kolom harga).",
    )
  }

  const currency: "IDR" | "USD" = areaSheets.some((s) => s.layout.currency === "USD") ? "USD" : "IDR"
  const kurs = opts.kursUsd != null && opts.kursUsd > 1 ? opts.kursUsd : null
  // HPP di REKAP / blok cost selalu IDR. Untuk harga USD, HPP dikonversi dengan kurs proyek.
  const toPriceCurrency = (idr: number | null) =>
    idr == null ? null : currency === "USD" ? (kurs ? idr / kurs : null) : idr

  const rekap = readRekap(wb.getWorksheet("REKAP"))
  const warnings: string[] = []
  const lines: ParsedLine[] = []
  const areas: AreaSummary[] = []
  let noCache = 0
  let errorCells = 0

  const first = areaSheets[0].ws
  const quoNumber = text(read(first.getCell("D2")))
  const revisiLabel = text(read(first.getCell("D5")))

  for (const { ws, layout: L } of areaSheets) {
    const area = areaName(ws.name, opts.projectCode)
    const seen = new Set<string>()
    let tipe: string | null = null
    let parentCode: string | null = null
    let sheetSubTotal: number | null = null
    let itemCount = 0
    const areaLines: ParsedLine[] = []

    for (let r = L.firstDataRow; r <= ws.rowCount; r++) {
      const c = (col: number | null): CellValue => (col ? read(ws.getCell(r, col)) : { kind: "empty" })
      const a = c(1)
      const aText = text(a) ?? ""
      const footer = [L.price1.unit - 1, L.price1.unit].some((col) => /^sub total/i.test(text(c(col)) ?? ""))
      if (/^remarks/i.test(aText) || footer) {
        sheetSubTotal = num(c(L.price1.total))
        break
      }

      const desc = text(c(L.desc))
      if (!desc) continue

      // Baris judul kelompok, mis. "G. FIXED FURNITURE" (sel A–E digabung).
      if (a.kind === "text" && num(a) == null && text(c(2)) === aText) {
        tipe = titleCase(aText.replace(/^[A-Z]\.\s*/, "")) || null
        parentCode = null
        continue
      }

      itemCount++
      const baseNotes: string[] = []
      let baseCheck = false

      let code = text(c(L.code))
      const isMain = L.no ? num(c(L.no)) != null : !!code
      if (code) {
        code = code.replace(/\s+/g, " ").trim()
      } else {
        const base: string = parentCode ?? `BARIS-${r}`
        code = /^top\b/i.test(desc) ? `${base}/TOP` : `${base}/SUB`
        if (!/^top\b/i.test(desc)) {
          baseCheck = true
          baseNotes.push("Kode tidak ada di Excel; dibuat otomatis.")
        }
      }
      if (isMain) parentCode = code
      let uniqueCode = code
      for (let k = 2; seen.has(normCode(uniqueCode)); k++) uniqueCode = `${code}-${k}`
      if (uniqueCode !== code) {
        baseCheck = true
        baseNotes.push(`Kode ${code} muncul lebih dari sekali di ${area}; disimpan sebagai ${uniqueCode}.`)
      }
      seen.add(normCode(uniqueCode))

      const excluded = [L.picture, L.clientMaterial, L.material1, L.material2].some((col) =>
        /not included/i.test(text(c(col)) ?? ""),
      )

      // Baris kain (fabric) tidak mengisi qty; jumlahnya di kolom total konsumsi dengan unit di sebelahnya.
      const qty = num(c(L.qty)) ?? num(c(L.fabricQty))
      const unit = (text(c(L.unit)) || text(c(L.fabricUnit))) ?? null
      const rk = rekap.get(normCode(uniqueCode)) ?? rekap.get(normCode(code))

      const options: { no: 1 | 2; price: PriceCols; material: number | null }[] = [
        { no: 1, price: L.price1, material: L.material1 },
      ]
      if (L.price2) options.push({ no: 2, price: L.price2, material: L.material2 })

      for (const opt of options) {
        const notes = [...baseNotes]
        let check = baseCheck

        const label = (name: string, col: number | null) => (col ? `${name} (${ws.getColumn(col).letter})` : name)
        const single = !L.price2
        const tracked: [string, CellValue][] = [
          [label("qty", L.qty), c(L.qty)],
          [label(single ? "harga jual" : `harga opsi ${opt.no}`, opt.price.unit), c(opt.price.unit)],
          [label(single ? "total" : `total opsi ${opt.no}`, opt.price.total), c(opt.price.total)],
        ]
        if (opt.no === 1) tracked.push([label("cost", L.cost), c(L.cost)])
        for (const [label, v] of tracked) {
          if (v.kind === "nocache") {
            noCache++
            check = true
            notes.push(`Rumus ${label} belum punya nilai tersimpan.`)
          } else if (v.kind === "error") {
            errorCells++
            check = true
            notes.push(`Error ${v.v} di ${label}.`)
          }
        }

        const harga = excluded ? null : num(c(opt.price.unit))

        // HPP hanya tersedia satu per item (REKAP / blok cost) → dipakai untuk opsi 1.
        let hpp: number | null = null
        if (opt.no === 1) {
          const costSheet = num(c(L.cost))
          let hppIdr = rk?.hpp ?? null
          if (hppIdr == null) hppIdr = costSheet
          else if (costSheet != null && Math.abs(costSheet - hppIdr) > 1) {
            check = true
            notes.push(`HPP REKAP ${rupiah(hppIdr)} beda dengan cost di sheet ${rupiah(costSheet)}.`)
          }
          hpp = toPriceCurrency(hppIdr)
          if (rk?.status && !/^ok$/i.test(rk.status)) {
            check = true
            const showRekap = currency === "IDR" && rk.jual != null && harga != null && Math.abs(rk.jual - harga) > 1
            notes.push(`REKAP: ${rk.status}${showRekap ? ` (harga REKAP ${rupiah(rk.jual as number)})` : ""}.`)
          }
        }

        let totalJual: number | null = null
        let totalHpp: number | null = null
        if (!excluded && harga != null && qty != null) {
          totalJual = num(c(opt.price.total)) ?? harga * qty
          if (hpp != null) totalHpp = hpp * qty
          else if (opt.no === 1) {
            check = true
            notes.push(
              currency === "USD" && !kurs
                ? "HPP (IDR) belum dikonversi ke USD: kurs proyek belum diisi."
                : "HPP tidak ditemukan (REKAP maupun kolom cost).",
            )
          }
        } else if (!excluded && (harga == null || qty == null)) {
          check = true
          notes.push(harga == null ? (opt.no === 2 ? "Harga opsi 2 kosong." : "Harga jual kosong.") : "Qty kosong.")
        }

        areaLines.push({
          sheet: ws.name,
          row: r,
          area,
          item_code: uniqueCode,
          option_no: opt.no,
          nama_item: clip(desc),
          tipe,
          deskripsi: clip(multiline(c(opt.material)), MAX_MATERIAL),
          dimensi: formatDim(num(c(L.dims.w)), num(c(L.dims.d)), num(c(L.dims.h)), num(c(L.dims.sh))),
          qty,
          unit,
          hpp_unit: excluded ? null : hpp,
          harga_jual_unit: harga,
          perlu_dicek: excluded ? false : check,
          asumsi: excluded ? null : notes.length ? clip(notes.join(" ")) : null,
          catatan: excluded ? "Not Included" : null,
          total_jual: totalJual,
          total_hpp: totalHpp,
          excluded,
        })
      }
    }

    const opt1 = areaLines.filter((l) => l.option_no === 1)
    const totalJual = opt1.reduce((s, l) => s + (l.total_jual ?? 0), 0)
    const totalHpp = opt1.reduce((s, l) => s + (l.total_hpp ?? 0), 0)
    const totalJualOpt2 = L.price2
      ? areaLines.filter((l) => l.option_no === 2).reduce((s, l) => s + (l.total_jual ?? 0), 0)
      : null
    if (sheetSubTotal != null && Math.abs(sheetSubTotal - totalJual) > (currency === "USD" ? 0.01 : 1)) {
      warnings.push(
        `${area}: Sub Total ${L.price2 ? "opsi 1 " : ""}di sheet ${money(sheetSubTotal, currency)} beda dengan jumlah baris item ${money(totalJual, currency)} — cek rentang rumus SUM Sub Total.`,
      )
    }
    areas.push({ sheet: ws.name, area, itemCount, totalJual, totalHpp, sheetSubTotal, totalJualOpt2 })
    lines.push(...areaLines)
  }

  if (!lines.length) throw new QuoParseError("Tidak ada baris item yang terbaca di sheet area.")

  const opt1 = lines.filter((l) => l.option_no === 1)
  const priced = opt1.filter((l) => l.total_jual != null)
  const withHpp = priced.filter((l) => l.total_hpp != null)
  const totalJual = priced.reduce((s, l) => s + (l.total_jual ?? 0), 0)
  const totalHpp = withHpp.reduce((s, l) => s + (l.total_hpp ?? 0), 0)
  const jualCovered = withHpp.reduce((s, l) => s + (l.total_jual ?? 0), 0)
  const gpm = jualCovered > 0 ? (jualCovered - totalHpp) / jualCovered : null

  const opt2Lines = lines.filter((l) => l.option_no === 2)
  const option2 = opt2Lines.length
    ? {
        totalJual: opt2Lines.reduce((s, l) => s + (l.total_jual ?? 0), 0),
        pricedCount: opt2Lines.filter((l) => l.total_jual != null).length,
      }
    : null

  if (withHpp.length < priced.length) {
    warnings.push(
      `${priced.length - withHpp.length} dari ${priced.length} baris berharga tidak punya HPP; GPM dihitung dari ${withHpp.length} baris yang lengkap.`,
    )
  }
  if (currency === "USD" && !kurs) {
    warnings.push("Harga dalam USD tetapi kurs proyek belum diisi; HPP (IDR) tidak dikonversi dan GPM tidak dihitung.")
  }
  if (option2) {
    warnings.push(
      `Proyek 2 opsi: total, HPP, dan GPM revisi dihitung dari opsi 1. Total jual opsi 2 ${money(option2.totalJual, currency)}; HPP opsi 2 tidak tersedia di Excel.`,
    )
  }
  if (noCache) {
    warnings.push(
      `${noCache} sel rumus (qty/harga/cost) tidak punya nilai tersimpan — buka file di Excel lalu Save sebelum upload supaya rumus dihitung.`,
    )
  }
  if (errorCells) warnings.push(`${errorCells} sel berisi error Excel (mis. #REF!) di kolom qty/harga/cost.`)
  if (!rekap.size) warnings.push("Sheet REKAP tidak ditemukan atau kosong; HPP diambil dari kolom cost di sheet area.")

  return {
    lines,
    areas,
    totalJual,
    totalHpp,
    gpm,
    pricedCount: priced.length,
    hppCount: withHpp.length,
    option2,
    currency,
    quoNumber,
    revisiLabel,
    warnings,
  }
}

export function toItemRows(lines: ParsedLine[]): ParsedItem[] {
  return lines.map((l) => ({
    area: l.area,
    item_code: l.item_code,
    option_no: l.option_no,
    nama_item: l.nama_item,
    tipe: l.tipe,
    deskripsi: l.deskripsi,
    dimensi: l.dimensi,
    qty: l.qty,
    unit: l.unit,
    hpp_unit: l.hpp_unit,
    harga_jual_unit: l.harga_jual_unit,
    perlu_dicek: l.perlu_dicek,
    asumsi: l.asumsi,
    catatan: l.catatan,
  }))
}
