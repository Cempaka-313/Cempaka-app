"use client"

import { useLayoutEffect, useRef, useState } from "react"

// Material usulan Cempaka (kolom PROPOSE MATERIAL / MATERIAL PROPOSAL OPTION n) di bawah nama item.
// Tampil maksimal 2 baris dengan ellipsis; "selengkapnya" muncul hanya bila teks memang terpotong.
export function ItemMaterial({ text }: { text: string | null }) {
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

  if (!text) return null
  return (
    <div className="mt-0.5 text-xs text-zinc-600">
      <p ref={ref} className={`whitespace-pre-line break-words ${open ? "" : "line-clamp-2"}`}>
        {text}
      </p>
      {(clamped || open) && (
        <button type="button" onClick={() => setOpen(!open)} className="text-brand hover:underline">
          {open ? "sembunyikan" : "selengkapnya"}
        </button>
      )}
    </div>
  )
}
