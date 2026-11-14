"use client"

import { useActionState } from "react"
import { login, type LoginState } from "./actions"

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {})

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-100 px-4">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-semibold text-brand">Cempaka</h1>
          <p className="text-sm text-zinc-500">Masuk ke aplikasi costing</p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded border border-zinc-300 px-3 py-2 focus:border-brand focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded border border-zinc-300 px-3 py-2 focus:border-brand focus:outline-none"
          />
        </label>

        {state.error && <p className="text-sm text-rose-600">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-brand py-2 font-medium text-white disabled:opacity-60"
        >
          {pending ? "Memproses…" : "Masuk"}
        </button>
      </form>
    </main>
  )
}
