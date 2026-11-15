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

// Validasi transisi + peran, update status, activity_log, dan approvals semuanya dilakukan
// atomik oleh RPC change_project_status di database (update status langsung ditolak trigger).
export async function changeStatus(projectId: number, next: ProjectStatus, reason?: string): Promise<ActionState> {
  if (!PROJECT_STATUSES.includes(next)) return { error: "Status tidak dikenal." }
  const trimmed = reason?.trim() || null
  if (next === "cancelled" && !trimmed) return { error: "Alasan pembatalan wajib diisi." }

  const { supabase, userId } = await currentUserId()
  if (!userId) return { error: "Sesi berakhir, silakan login ulang." }

  const { error } = await supabase.rpc("change_project_status", {
    p_project_id: projectId,
    p_next: next,
    p_reason: trimmed,
  })
  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/")
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
