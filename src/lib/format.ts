export function formatMoney(value: number | null | undefined, jenis: string) {
  if (value == null) return "—"
  const usd = jenis === "export"
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: usd ? "USD" : "IDR",
    maximumFractionDigits: usd ? 2 : 0,
  }).format(value)
}

export function formatPercent(value: number | null | undefined) {
  if (value == null) return "—"
  // gpm disimpan sebagai rasio (0.25) atau persen (25); tampilkan apa adanya bila > 1.
  const pct = Math.abs(value) <= 1 ? value * 100 : value
  return `${pct.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Makassar",
  }).format(new Date(value))
}
