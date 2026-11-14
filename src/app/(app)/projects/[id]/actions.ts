"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/status"

export type ActionState = { error?: string }

async function currentUserId() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return { supabase, userId: data?.claims.sub }
}

export async function changeStatus(projectId: number, next: ProjectStatus): Promise<ActionState> {
  if (!PROJECT_STATUSES.includes(next)) return { error: "Status tidak dikenal." }
  const { supabase, userId } = await currentUserId()
  if (!userId) return { error: "Sesi berakhir, silakan login ulang." }

  const { data: project } = await supabase.from("projects").select("status").eq("id", projectId).single()
  if (!project) return { error: "Proyek tidak ditemukan." }
  if (project.status === next) return {}

  // RLS hanya mengizinkan estimator/manajer/owner; bila ditolak, tidak ada baris yang berubah.
  const { data: updated, error } = await supabase
    .from("projects")
    .update({ status: next, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select("id")
  if (error) return { error: error.message }
  if (!updated?.length) return { error: "Anda tidak punya izin mengubah status proyek ini." }

  await supabase.from("activity_log").insert({
    project_id: projectId,
    user_id: userId,
    aksi: "ubah_status",
    objek: "status",
    nilai_lama: project.status,
    nilai_baru: next,
  })

  revalidatePath(`/projects/${projectId}`)
  return {}
}

export async function addComment(projectId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const text = String(formData.get("komentar") ?? "").trim()
  if (!text) return { error: "Komentar kosong." }
  const { supabase, userId } = await currentUserId()
  if (!userId) return { error: "Sesi berakhir, silakan login ulang." }

  const { error } = await supabase.from("activity_log").insert({
    project_id: projectId,
    user_id: userId,
    aksi: "komentar",
    alasan: text,
  })
  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}`)
  return {}
}
