"use client"

import { useState } from "react"

export type ActivityEntry = {
  id: number
  nama: string
  /** Aksi singkat, mis. "upload Rev 2", "berkomentar". */
  ringkas: string
  /** Detail panjang (nama file, alasan, isi komentar) — tampil saat entri diklik. */
  detail: string | null
  created_at: string
}

const VISIBLE = 5
const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
]

function relative(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit)
  }
  return "baru saja"
}

const absolute = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Makassar" })

// Panel aktivitas ringkas: 5 terbaru, "Lihat semua (N)"; satu baris per entri, detail saat diklik.
export function ActivityPanel({ entries, total }: { entries: ActivityEntry[]; total: number }) {
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState<number | null>(null)
  const shown = all ? entries : entries.slice(0, VISIBLE)

  if (!entries.length) return <p className="text-xs text-zinc-500">Belum ada aktivitas.</p>

  return (
    <div className="flex min-h-0 flex-col gap-1">
      <ul className={`divide-y divide-zinc-100 rounded bg-white text-xs shadow-sm ${all ? "min-h-0 overflow-y-auto" : ""}`}>
        {shown.map((a) => {
          const expanded = open === a.id
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : a.id)}
                aria-expanded={expanded}
                disabled={!a.detail}
                className="flex w-full items-baseline gap-1.5 px-2 py-1.5 text-left enabled:hover:bg-zinc-50"
              >
                <span className="shrink-0 font-medium text-zinc-800">{a.nama}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-600">{a.ringkas}</span>
                <time
                  dateTime={a.created_at}
                  title={absolute.format(new Date(a.created_at))}
                  suppressHydrationWarning
                  className="shrink-0 text-zinc-400"
                >
                  {relative(a.created_at)}
                </time>
              </button>
              {expanded && a.detail && (
                <p className="whitespace-pre-line px-2 pb-2 text-zinc-600 [overflow-wrap:anywhere]">{a.detail}</p>
              )}
            </li>
          )
        })}
      </ul>
      {total > VISIBLE && (
        <button type="button" onClick={() => setAll(!all)} className="self-start text-xs text-brand hover:underline">
          {all ? "Tampilkan 5 terbaru" : `Lihat semua (${total})`}
        </button>
      )}
      {all && total > entries.length && (
        <p className="text-xs text-zinc-400">Menampilkan {entries.length} aktivitas terbaru dari {total}.</p>
      )}
    </div>
  )
}
