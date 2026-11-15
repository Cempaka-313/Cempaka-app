"use client"

import { useState, useTransition } from "react"
import { getRevisionDownloadUrl } from "./download-actions"

// Unduh file Excel asli sebuah revisi lewat signed URL yang dibuat saat diklik.
export function DownloadExcel({ projectId, revisionId }: { projectId: number; revisionId: number }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()

  function onClick() {
    setError(undefined)
    startTransition(async () => {
      const res = await getRevisionDownloadUrl(projectId, revisionId)
      if (res.url) window.location.assign(res.url)
      else setError(res.error)
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={onClick}
        className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending ? "Menyiapkan…" : "Download Excel"}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  )
}
