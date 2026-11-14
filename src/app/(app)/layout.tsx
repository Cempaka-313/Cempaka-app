import Link from "next/link"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { ROLE_LABEL } from "@/lib/status"
import { logout } from "../login/actions"

// Shell statis (header + nav) di-prerender; bagian yang membaca sesi di-stream lewat <Suspense>.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-100">
      <header className="flex items-center gap-4 bg-brand px-4 py-2 text-white">
        <Link href="/" className="font-semibold">
          Cempaka
        </Link>
        <nav className="flex gap-3 text-sm text-white/80">
          <Link href="/" className="hover:text-white">
            Proyek
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <Suspense fallback={<span className="text-white/60">…</span>}>
            <UserMenu />
          </Suspense>
        </div>
      </header>

      <main className="flex-1">
        <Suspense fallback={<p className="p-4 text-sm text-zinc-500">Memuat…</p>}>{children}</Suspense>
      </main>
    </div>
  )
}

async function UserMenu() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims.sub

  const { data: profile } = userId
    ? await supabase.from("profiles").select("nama, peran").eq("id", userId).maybeSingle()
    : { data: null }

  return (
    <>
      <span className={profile ? "hidden sm:inline" : "rounded bg-amber-300 px-2 py-0.5 text-amber-950"}>
        {profile
          ? `${profile.nama} · ${ROLE_LABEL[profile.peran] ?? profile.peran}`
          : "Profil belum dibuat"}
      </span>
      <form action={logout}>
        <button className="rounded bg-white/15 px-2 py-1 hover:bg-white/25">Keluar</button>
      </form>
    </>
  )
}
