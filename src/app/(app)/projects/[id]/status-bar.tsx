"use client"

import { useState, useTransition } from "react"
import {
  PROJECT_STATUSES,
  STATUS_LABEL,
  allowedTransitions,
  canCancel,
  type ProjectStatus,
  type StatusTransition,
} from "@/lib/status"
import { changeStatus } from "./actions"

// Status bar gaya Odoo: tahapan hanya penanda (tidak bisa diklik). Perpindahan status lewat
// tombol aksi sesuai peran; aturan sebenarnya ditegakkan RPC change_project_status di database.
export function StatusBar({ projectId, status, role }: { projectId: number; status: string; role: string | null }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const flow = PROJECT_STATUSES.filter((s) => s !== "cancelled")
  const actions = allowedTransitions(status, role)
  const showCancel = canCancel(status, role)

  function run(next: ProjectStatus, reason?: string) {
    setError(undefined)
    startTransition(async () => {
      const res = await changeStatus(projectId, next, reason)
      if (res.error) setError(res.error)
    })
  }

  function onAction(t: StatusTransition) {
    if (t.reason) {
      const r = prompt(`${t.label} — catatan${t.reason === "required" ? " (wajib)" : " (opsional)"}:`)
      if (r === null) return
      if (t.reason === "required" && !r.trim()) return setError("Catatan wajib diisi.")
      run(t.to, r)
    } else {
      if (!confirm(`${t.label}? Status menjadi ${STATUS_LABEL[t.to]}.`)) return
      run(t.to)
    }
  }

  function onCancel() {
    const r = prompt("Alasan pembatalan proyek (wajib):")
    if (r === null) return
    if (!r.trim()) return setError("Alasan pembatalan wajib diisi.")
    run("cancelled", r)
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {actions.map((t) => (
          <button
            key={t.to}
            type="button"
            disabled={pending}
            onClick={() => onAction(t)}
            className={`rounded px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
              t.variant === "primary"
                ? "bg-brand text-white hover:opacity-90"
                : "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {t.label}
          </button>
        ))}
        {showCancel && (
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded px-2 py-1.5 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
          >
            Batalkan
          </button>
        )}
        <ol
          aria-label="Status proyek"
          className={`flex overflow-x-auto rounded border border-zinc-300 bg-white text-xs ${pending ? "opacity-60" : ""}`}
        >
          {flow.map((s) => (
            <li
              key={s}
              aria-current={s === status ? "step" : undefined}
              className={`whitespace-nowrap border-r border-zinc-200 px-3 py-1.5 last:border-r-0 ${
                s === status ? "bg-brand font-semibold text-white" : "text-zinc-500"
              }`}
            >
              {STATUS_LABEL[s]}
            </li>
          ))}
        </ol>
        {status === "cancelled" && (
          <span className="rounded bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">
            {STATUS_LABEL.cancelled}
          </span>
        )}
      </div>
      {error && <p className="text-right text-xs text-rose-600">{error}</p>}
    </div>
  )
}
