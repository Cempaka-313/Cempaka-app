"use client"

import { useState, useTransition } from "react"
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/status"
import { changeStatus } from "./actions"

// Status bar gaya Odoo: tahapan berurutan, `cancelled` terpisah di ujung.
export function StatusBar({ projectId, status, canEdit }: { projectId: number; status: string; canEdit: boolean }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const flow = PROJECT_STATUSES.filter((s) => s !== "cancelled")

  function go(next: ProjectStatus) {
    if (!canEdit || next === status) return
    if (next === "cancelled" && !confirm("Batalkan proyek ini?")) return
    setError(undefined)
    startTransition(async () => {
      const res = await changeStatus(projectId, next)
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <ol className={`flex overflow-x-auto rounded border border-zinc-300 bg-white text-xs ${pending ? "opacity-60" : ""}`}>
          {flow.map((s) => (
            <li key={s}>
              <button
                type="button"
                disabled={!canEdit || pending}
                onClick={() => go(s)}
                className={`whitespace-nowrap border-r border-zinc-200 px-3 py-1.5 last:border-r-0 ${
                  s === status ? "bg-brand font-semibold text-white" : "text-zinc-600 enabled:hover:bg-zinc-100"
                }`}
              >
                {s}
              </button>
            </li>
          ))}
        </ol>
        {status === "cancelled" ? (
          <span className="rounded bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">cancelled</span>
        ) : (
          canEdit && (
            <button
              type="button"
              disabled={pending}
              onClick={() => go("cancelled")}
              className="rounded px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
            >
              Batalkan
            </button>
          )
        )}
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}
