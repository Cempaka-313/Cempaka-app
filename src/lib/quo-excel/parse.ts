// Pembaca file QUO_INT Cempaka (.xlsx) untuk upload revisi. Hanya membaca — file tidak diubah.
//
// Sumber data:
// - Sheet area (setiap sheet yang header-nya cocok dengan template QUO: B19 "CODE", D19 "DESCRIPTION",
//   R19 "TOTAL ORDER QTY", X20 "PRICE", Y20 "TOTAL PRICE"). Nama area = nama sheet tanpa kode proyek.
//   Kolom: B kode, D deskripsi, F/G/H/I dimensi, P material usulan, R qty, S unit, U/V konsumsi kain,
//   X harga jual/unit, Y total harga, AZ cost/unit setelah diskon (blok COST OK).
// - Sheet REKAP: HPP/unit, harga jual/unit hasil BOM, dan status per kode item (dicocokkan lewat kode).
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
  /** Total harga jual baris (kolom Y, atau qty × harga bila Y kosong). Null bila baris tidak dihargai. */
  total_jual: number | null
  /** HPP baris = hpp_unit × qty. */
  total_hpp: number | null
  excluded: boolean
}

export type AreaSummary = {
  sheet: string
  area: string
  itemCount: number
  totalJual: number
  totalHpp: number
  /** Nilai Sub Total yang tertulis di sheet (bisa beda bila rentang rumus SUM tidak mencakup semua baris). */
  sheetSubTotal: number | null
}

export type ParseResult = {
  lines: ParsedLine[]
  areas: AreaSummary[]
  totalJual: number
  totalHpp: number
  /** Rasio (0.25 = 25%), dihitung dari baris yang punya harga jual dan HPP. */
  gpm: number | null
  pricedCount: number
  hppCount: number
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

const XLSX_START_ROW = 21
const MAX_TEXT = 2000

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

function num(v: CellValue): number | null {
  if (v.kind === "num") return v.v
  if (v.kind === "text") {
    const t = v.v.trim()
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  }
  return null
}

function clip(s: string | null): string | null {
  return s && s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) : s
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s/&(-])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase())
}

function isAreaSheet(ws: Worksheet) {
  const t = (addr: string) => (text(read(ws.getCell(addr))) ?? "").toUpperCase()
  return (
    t("B19") === "CODE" &&
    t("D19") === "DESCRIPTION" &&
    t("R19").startsWith("TOTAL ORDER QTY") &&
    t("X20") === "PRICE" &&
    t("Y20") === "TOTAL PRICE"
  )
}

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

export async function parseQuoWorkbook(
  data: ArrayBuffer | Uint8Array,
  opts: { projectCode?: string | null } = {},
): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook()
  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    await wb.xlsx.load(bytes as unknown as ArrayBuffer)
  } catch {
    throw new QuoParseError("File tidak bisa dibaca sebagai .xlsx. Pastikan file disimpan dari Excel dalam format .xlsx.")
  }

  const areaSheets = wb.worksheets.filter(isAreaSheet)
  if (!areaSheets.length) {
    throw new QuoParseError(
      "Tidak ditemukan sheet area dengan format template QUO_INT (header CODE / DESCRIPTION / TOTAL ORDER QTY di baris 19–20).",
    )
  }

  const rekap = readRekap(wb.getWorksheet("REKAP"))
  const warnings: string[] = []
  const lines: ParsedLine[] = []
  const areas: AreaSummary[] = []
  let noCache = 0
  let errorCells = 0

  const first = areaSheets[0]
  const quoNumber = text(read(first.getCell("D2")))
  const revisiLabel = text(read(first.getCell("D5")))

  for (const ws of areaSheets) {
    const area = areaName(ws.name, opts.projectCode)
    const seen = new Set<string>()
    let tipe: string | null = null
    let parentCode: string | null = null
    let sheetSubTotal: number | null = null
    const areaLines: ParsedLine[] = []

    for (let r = XLSX_START_ROW; r <= ws.rowCount; r++) {
      const c = (col: string) => read(ws.getCell(`${col}${r}`))
      const a = c("A")
      const aText = text(a) ?? ""
      const xText = text(c("X")) ?? ""
      if (/^remarks/i.test(aText) || /^sub total/i.test(xText)) {
        sheetSubTotal = num(c("Y"))
        break
      }

      const desc = text(c("D"))
      if (!desc) continue

      // Baris judul kelompok, mis. "G. FIXED FURNITURE" (sel A–E digabung).
      if (a.kind === "text" && num(a) == null && text(c("B")) === aText) {
        tipe = titleCase(aText.replace(/^[A-Z]\.\s*/, "")) || null
        parentCode = null
        continue
      }

      const notes: string[] = []
      let check = false
      const isMain = num(a) != null

      let code = text(c("B"))
      if (code) {
        code = code.replace(/\s+/g, " ").trim()
      } else {
        const base: string = parentCode ?? `BARIS-${r}`
        code = /^top\b/i.test(desc) ? `${base}/TOP` : `${base}/SUB`
        if (!/^top\b/i.test(desc)) {
          check = true
          notes.push("Kode tidak ada di Excel; dibuat otomatis.")
        }
      }
      if (isMain) parentCode = code
      let uniqueCode = code
      for (let k = 2; seen.has(normCode(uniqueCode)); k++) uniqueCode = `${code}-${k}`
      if (uniqueCode !== code) {
        check = true
        notes.push(`Kode ${code} muncul lebih dari sekali di ${area}; disimpan sebagai ${uniqueCode}.`)
      }
      seen.add(normCode(uniqueCode))

      const tracked: [string, CellValue][] = [
        ["qty (R)", c("R")],
        ["harga jual (X)", c("X")],
        ["total (Y)", c("Y")],
        ["cost (AZ)", c("AZ")],
      ]
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

      const excluded = [c("E"), c("O"), c("P")].some((v) => /not included/i.test(text(v) ?? ""))

      // Baris kain (fabric) tidak mengisi R; jumlahnya di kolom U (total konsumsi) dengan unit di V.
      const qty = num(c("R")) ?? num(c("U"))
      const unit = (text(c("S")) || text(c("V"))) ?? null
      const harga = excluded ? null : num(c("X"))

      const rk = rekap.get(normCode(uniqueCode)) ?? rekap.get(normCode(code))
      const costSheet = num(c("AZ"))
      let hpp = rk?.hpp ?? null
      if (hpp == null) hpp = costSheet
      else if (costSheet != null && Math.abs(costSheet - hpp) > 1) {
        check = true
        notes.push(`HPP REKAP ${rupiah(hpp)} beda dengan cost di sheet ${rupiah(costSheet)}.`)
      }
      if (rk?.status && !/^ok$/i.test(rk.status)) {
        check = true
        notes.push(
          `REKAP: ${rk.status}${rk.jual != null && harga != null && Math.abs(rk.jual - harga) > 1 ? ` (harga REKAP ${rupiah(rk.jual)})` : ""}.`,
        )
      }

      let totalJual: number | null = null
      let totalHpp: number | null = null
      if (!excluded && harga != null && qty != null) {
        totalJual = num(c("Y")) ?? harga * qty
        if (hpp != null) totalHpp = hpp * qty
        else {
          check = true
          notes.push("HPP tidak ditemukan (REKAP maupun kolom cost).")
        }
      } else if (!excluded && (harga == null || qty == null)) {
        check = true
        notes.push(harga == null ? "Harga jual kosong." : "Qty kosong.")
      }

      const line: ParsedLine = {
        sheet: ws.name,
        row: r,
        area,
        item_code: uniqueCode,
        option_no: 1,
        nama_item: clip(desc),
        tipe,
        deskripsi: clip(text(c("P")) ?? text(c("O"))),
        dimensi: formatDim(num(c("F")), num(c("G")), num(c("H")), num(c("I"))),
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
      }
      areaLines.push(line)
    }

    const totalJual = areaLines.reduce((s, l) => s + (l.total_jual ?? 0), 0)
    const totalHpp = areaLines.reduce((s, l) => s + (l.total_hpp ?? 0), 0)
    if (sheetSubTotal != null && Math.abs(sheetSubTotal - totalJual) > 1) {
      warnings.push(
        `${area}: Sub Total di sheet ${rupiah(sheetSubTotal)} beda dengan jumlah baris item ${rupiah(totalJual)} — cek rentang rumus SUM Sub Total.`,
      )
    }
    areas.push({ sheet: ws.name, area, itemCount: areaLines.length, totalJual, totalHpp, sheetSubTotal })
    lines.push(...areaLines)
  }

  if (!lines.length) throw new QuoParseError("Tidak ada baris item yang terbaca di sheet area.")

  const priced = lines.filter((l) => l.total_jual != null)
  const withHpp = priced.filter((l) => l.total_hpp != null)
  const totalJual = priced.reduce((s, l) => s + (l.total_jual ?? 0), 0)
  const totalHpp = withHpp.reduce((s, l) => s + (l.total_hpp ?? 0), 0)
  const jualCovered = withHpp.reduce((s, l) => s + (l.total_jual ?? 0), 0)
  const gpm = jualCovered > 0 ? (jualCovered - totalHpp) / jualCovered : null

  if (withHpp.length < priced.length) {
    warnings.push(
      `${priced.length - withHpp.length} dari ${priced.length} baris berharga tidak punya HPP; GPM dihitung dari ${withHpp.length} baris yang lengkap.`,
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
