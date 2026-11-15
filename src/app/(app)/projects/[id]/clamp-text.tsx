"use client"

import { useLayoutEffect, useRef, useState } from "react"

// Teks dipotong maksimal 2 baris dengan ellipsis; "selengkapnya" muncul hanya bila teks memang terpotong.
// Dipakai di tabel Item supaya teks panjang tidak melebarkan kolom atau membuat baris setinggi layar.
export function ClampText({ text, className = "" }: { text: string | null; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [open, setOpen] = useState(false)
  const [clamped, setClamped] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || open) return
    const check = () => setClamped(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text, open])

  if (!text) return <span className="text-zinc-400">—</span>
  return (
    <div className={className}>
      <p ref={ref} className={`whitespace-pre-line [overflow-wrap:anywhere] ${open ? "" : "line-clamp-2"}`}>
        {text}
      </p>
      {(clamped || open) && (
        <button type="button" onClick={() => setOpen(!open)} className="text-xs text-brand hover:underline">
          {open ? "sembunyikan" : "selengkapnya"}
        </button>
      )}
    </div>
  )
}
