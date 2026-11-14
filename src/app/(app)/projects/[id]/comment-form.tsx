"use client"

import { useActionState, useEffect, useRef } from "react"
import { addComment, type ActionState } from "./actions"

export function CommentForm({ projectId }: { projectId: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addComment.bind(null, projectId), {})
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!pending && !state.error) ref.current?.reset()
  }, [pending, state])

  return (
    <form ref={ref} action={action} className="space-y-2">
      <textarea
        name="komentar"
        rows={2}
        placeholder="Tulis komentar…"
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-rose-600">{state.error}</span>
        <button disabled={pending} className="rounded bg-brand px-3 py-1 text-sm text-white disabled:opacity-60">
          {pending ? "Mengirim…" : "Kirim"}
        </button>
      </div>
    </form>
  )
}
