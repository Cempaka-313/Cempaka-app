// Material usulan Cempaka (kolom PROPOSE MATERIAL / MATERIAL PROPOSAL OPTION n) di bawah nama item.
// Teks pendek tampil langsung; teks panjang atau multi-baris bisa dibuka-tutup.
const SHORT = 120

export function ItemMaterial({ text }: { text: string | null }) {
  if (!text) return null
  const firstLine = text.split("\n")[0]
  if (text.length <= SHORT && !text.includes("\n")) {
    return <div className="mt-0.5 text-xs text-zinc-600">{text}</div>
  }
  const preview = firstLine.length > SHORT ? `${firstLine.slice(0, SHORT)}…` : firstLine
  return (
    <details className="group mt-0.5 text-xs text-zinc-600">
      <summary className="cursor-pointer list-none">
        <span className="group-open:hidden">
          {preview} <span className="text-brand">selengkapnya</span>
        </span>
        <span className="hidden text-brand group-open:inline">sembunyikan</span>
      </summary>
      <p className="mt-0.5 whitespace-pre-line">{text}</p>
    </details>
  )
}
