import Link from "next/link"
import { connection } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { PROJECT_STATUSES, STATUS_COLOR, STATUS_LABEL, type ProjectStatus } from "@/lib/status"

// Tampilan kanban proyek per status (gaya Odoo).
export default async function ProjectsKanbanPage() {
  await connection()
  const supabase = await createClient()
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, project_code, nama_proyek, klien, jenis, status, quo_number, updated_at")
    .order("updated_at", { ascending: false })

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Proyek</h1>
        <span className="text-sm text-zinc-500">{projects?.length ?? 0} proyek</span>
      </div>

      {error && (
        <p className="mb-3 rounded bg-rose-100 px-3 py-2 text-sm text-rose-800">
          Gagal memuat proyek: {error.message}
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {PROJECT_STATUSES.map((status) => {
          const items = (projects ?? []).filter((p) => p.status === status)
          return (
            <section key={status} className="w-72 shrink-0">
              <header className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">{STATUS_LABEL[status]}</h2>
                <span className="text-xs text-zinc-500">{items.length}</span>
              </header>
              <div className="space-y-2">
                {items.map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="block rounded border border-zinc-200 bg-white p-3 shadow-sm hover:border-brand">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium leading-tight">{p.nama_proyek}</h3>
                      <span className="text-xs uppercase text-zinc-500">{p.jenis}</span>
                    </div>
                    <p className="text-sm text-zinc-600">{p.klien ?? "—"}</p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-zinc-500">{p.quo_number ?? p.project_code}</span>
                      <span className={`rounded px-1.5 py-0.5 ${STATUS_COLOR[p.status as ProjectStatus]}`}>
                        {STATUS_LABEL[p.status as ProjectStatus] ?? p.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
