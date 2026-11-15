"use client"

import { useRef, useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { newUploadPath, QUO_BUCKET, QUO_MAX_BYTES, XLSX_MIME } from "@/lib/quo-excel/storage"
import { importRevisionExcel, type UploadResult } from "./upload-actions"

// Upload file QUO_INT hasil edit di Excel → tersimpan sebagai revisi baru (riwayat tidak ditimpa).
export function UploadRevision({ projectId }: { projectId: number }) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [stage, setStage] = useState<string>()
  const [result, setResult] = useState<UploadResult>()

  function onFile(file: File | undefined) {
    if (input.current) input.current.value = ""
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".xlsx")) return setResult({ error: "Pilih file .xlsx (template QUO_INT)." })
    if (file.size > QUO_MAX_BYTES) return setResult({ error: "File lebih dari 20 MB." })

    setResult(undefined)
    startTransition(async () => {
      setStage("Mengupload file…")
      const path = newUploadPath(projectId)
      const { error } = await createClient().storage.from(QUO_BUCKET).upload(path, file, { contentType: XLSX_MIME })
      if (error) {
        setStage(undefined)
        setResult({ error: `Upload gagal: ${error.message}` })
        return
      }
      setStage("Membaca Excel & menyimpan revisi…")
      const res = await importRevisionExcel(projectId, path, file.name)
      setStage(undefined)
      setResult(res)
    })
  }

  return (
    <div className="space-y-1">
      <input
        ref={input}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => input.current?.click()}
        className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending ? (stage ?? "Memproses…") : "Upload Rev Excel"}
      </button>
      {result?.error && <p className="max-w-md text-xs text-rose-600">{result.error}</p>}
      {result?.revNo != null && (
        <div className="max-w-md rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
          <p className="font-semibold">
            Rev {result.revNo} tersimpan — {result.summary}.
          </p>
          {!!result.errors?.length && (
            <ul className="mt-1 list-disc space-y-0.5 rounded bg-rose-50 py-1 pl-5 pr-2 font-medium text-rose-700">
              {result.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {!!result.warnings?.length && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-800">
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
