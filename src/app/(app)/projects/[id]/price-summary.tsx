import { formatMoney } from "@/lib/format"
import { checkRangkuman } from "@/lib/quo-excel/validation"

type Rev = {
  sub_total_excel: number | null
  delivery: number | null
  delivery_excluded: boolean
  total_after_delivery: number | null
  dpp_lainnya: number | null
  vat: number | null
  grand_total: number | null
  rangkuman_sumber: string | null
}

// Rangkuman harga revisi seperti di bawah Sub Total di Excel: Delivery, Total After Delivery, DPP, VAT, Grand Total.
// Lokal: DPP = 11/12 × Total After Delivery, VAT = 12% × DPP — angka Excel yang beda dari hitungan diberi peringatan.
// Export: Delivery "Excluded", tanpa VAT.
export function PriceSummary({
  rev,
  jenis,
  compact = false,
  className = "",
}: {
  rev: Rev
  jenis: string
  compact?: boolean
  className?: string
}) {
  const hasData = [rev.sub_total_excel, rev.delivery, rev.total_after_delivery, rev.dpp_lainnya, rev.vat, rev.grand_total]
    .some((v) => v != null) || rev.delivery_excluded
  if (!hasData) return null

  const exportProject = jenis === "export"
  const money = (v: number | null) => formatMoney(v, jenis)
  const warnings = checkRangkuman(
    {
      sumber: rev.rangkuman_sumber ?? "",
      sub_total: rev.sub_total_excel,
      delivery: rev.delivery,
      delivery_excluded: rev.delivery_excluded,
      total_after_delivery: rev.total_after_delivery,
      dpp_lainnya: rev.dpp_lainnya,
      vat: rev.vat,
      grand_total: rev.grand_total,
    },
    exportProject ? "USD" : "IDR",
  )
  const flag = (re: RegExp) => warnings.some((w) => re.test(w))

  const rows: { label: string; value: string; warn?: boolean }[] = [
    { label: "Sub Total (Excel)", value: money(rev.sub_total_excel) },
    { label: "Delivery & Installation", value: rev.delivery_excluded ? "Excluded" : money(rev.delivery) },
    { label: "Total After Delivery & Installation", value: money(rev.total_after_delivery) },
  ]
  if (exportProject) {
    rows.push({ label: "VAT", value: rev.vat ? money(rev.vat) : "Tanpa VAT", warn: flag(/VAT/) })
  } else {
    rows.push(
      { label: "DPP Lainnya (11/12)", value: money(rev.dpp_lainnya), warn: flag(/^DPP/) },
      { label: "VAT 12%", value: money(rev.vat), warn: flag(/^VAT/) },
    )
  }

  return (
    <div className={`rounded border border-zinc-200 ${compact ? "text-xs" : "text-sm"} ${className}`}>
      <dl className="divide-y divide-zinc-100">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4 px-3 py-1">
            <dt className="text-zinc-500">{r.label}</dt>
            <dd className={`tabular-nums ${r.warn ? "font-medium text-amber-700" : ""}`}>
              {r.warn && <span aria-label="beda dari hitungan">⚠ </span>}
              {r.value}
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 bg-zinc-50 px-3 py-1.5 font-semibold">
          <dt>Grand Total</dt>
          <dd className="tabular-nums">{money(rev.grand_total)}</dd>
        </div>
      </dl>
      {(warnings.length > 0 || rev.rangkuman_sumber) && (
        <div className="space-y-0.5 border-t border-zinc-100 px-3 py-1.5 text-xs">
          {warnings.map((w) => (
            <p key={w} className="text-amber-700">
              {w}
            </p>
          ))}
          {rev.rangkuman_sumber && <p className="text-zinc-400">Sumber: sheet {rev.rangkuman_sumber}</p>}
        </div>
      )}
    </div>
  )
}
