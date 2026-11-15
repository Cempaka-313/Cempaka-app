"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export type ValidationActionState = { error?: string }

// Pilih baris yang dijumlahkan dalam satu pasangan kemungkinan hitung dobel (paket vs komponen).
// RPC choose_counted_item mengecek peran & revisi aktif, menulis activity_log, dan menghitung ulang total/selisih.
export async function chooseCountedItem(projectId: number, itemId: number): Promise<ValidationActionState> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("choose_counted_item", { p_item_id: itemId })
  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/")
  return {}
}

// Alasan "selisih disengaja" supaya Ajukan Approval tidak diblok; tercatat di activity_log oleh RPC.
export async function setDiscrepancyReason(
  projectId: number,
  revisionId: number,
  _prev: ValidationActionState,
  formData: FormData,
): Promise<ValidationActionState> {
  const reason = String(formData.get("alasan") ?? "").trim()
  if (!reason) return { error: "Alasan wajib diisi." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("set_revision_discrepancy_reason", {
    p_revision_id: revisionId,
    p_reason: reason,
  })
  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}`)
  return {}
}
