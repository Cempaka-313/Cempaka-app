"use client"

import { useActionState, useState, useTransition } from "react"
import { chooseCountedItem, setDiscrepancyReason, type ValidationActionState } from "./validation-actions"

export type DoubleCountOption = { id: number; code: string; nama: string | null; harga: string; dihitung: boolean }

// Pilihan baris mana yang dijumlahkan untuk satu pasangan kemungkinan hitung dobel.
export function DoubleCountChoice({
  projectId,
  options,
  canEdit,
}: {
  projectId: number
  options: DoubleCountOption[]
  canEdit: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>()
  const name = `dobel-${options.map((o) => o.id).join("-")}`

  function choose(id: number) {
    setError(undefined)
    startTransition(async () => {
      const res = await chooseCountedItem(projectId, id)
      if (res.error) setError(res.error)
    })
  }

  return (
    <fieldset disabled={!canEdit || pending} className={pending ? "opacity-60" : ""}>
      <legend className="sr-only">Baris yang dijumlahkan</legend>
      <div className="flex flex-col gap-1">
        {options.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name={name}
              checked={o.dihitung}
              onChange={() => choose(o.id)}
              className="mt-0.5 accent-brand"
            />
            <span>
              <span className="font-mono">{o.code}</span> — {o.nama ?? "—"} · {o.harga}
              {o.dihitung && <span className="ml-1 rounded bg-emerald-100 px-1 text-emerald-800">dijumlahkan</span>}
            </span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-rose-600">{error}</p>}
    </fieldset>
  )
}

// Form alasan "selisih disengaja" (membuka blokir Ajukan Approval untuk revisi ini).
export function DiscrepancyReasonForm({ projectId, revisionId }: { projectId: number; revisionId: number }) {
  const [state, action, pending] = useActionState<ValidationActionState, FormData>(
    setDiscrepancyReason.bind(null, projectId, revisionId),
    {},
  )
  return (
    <form action={action} className="space-y-1">
      <label className="block font-medium text-zinc-700" htmlFor={`alasan-${revisionId}`}>
        Alasan selisih disengaja
      </label>
      <textarea
        id={`alasan-${revisionId}`}
        name="alasan"
        rows={2}
        required
        placeholder="Mis. Sub Total Excel sengaja hanya Loose Furniture; Fixed Furniture ditawarkan terpisah."
        className="w-full rounded border border-zinc-300 px-2 py-1 text-sm focus:border-brand focus:outline-none"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-rose-600">{state.error}</span>
        <button disabled={pending} className="rounded bg-brand px-3 py-1 text-xs font-medium text-white disabled:opacity-60">
          {pending ? "Menyimpan…" : "Simpan alasan"}
        </button>
      </div>
    </form>
  )
}
