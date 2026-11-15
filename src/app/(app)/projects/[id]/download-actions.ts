"use server"

import { createClient } from "@/lib/supabase/server"
import { QUO_BUCKET } from "@/lib/quo-excel/storage"

export type DownloadResult = { url?: string; error?: string }

const SIGNED_URL_SECONDS = 60

// Signed URL dibuat saat tombol diklik (bukan saat halaman dirender) supaya tidak kedaluwarsa
// walau halaman lama terbuka. Akses tetap lewat RLS: revisi dan file hanya terbaca oleh user aktif.
export async function getRevisionDownloadUrl(projectId: number, revisionId: number): Promise<DownloadResult> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims.sub) return { error: "Sesi berakhir, silakan login ulang." }

  const { data: rev } = await supabase
    .from("quotation_revisions")
    .select("rev_no, excel_path, catatan, project:projects!quotation_revisions_project_id_fkey(project_code)")
    .eq("id", revisionId)
    .eq("project_id", projectId)
    .maybeSingle()
  if (!rev) return { error: "Revisi tidak ditemukan." }
  if (!rev.excel_path) return { error: "Revisi ini tidak punya file Excel." }

  // Nama file asli dicatat di baris pertama catatan revisi ("File: ...") saat upload.
  const original = rev.catatan?.match(/^File: (.+\.xlsx)\s*$/im)?.[1]?.trim()
  const fileName = original || `${rev.project?.project_code ?? "QUO"}-Rev${rev.rev_no}.xlsx`

  const { data, error } = await supabase.storage
    .from(QUO_BUCKET)
    .createSignedUrl(rev.excel_path, SIGNED_URL_SECONDS, { download: fileName })
  if (error || !data) return { error: `File tidak bisa diunduh: ${error?.message ?? "tidak ditemukan"}` }
  return { url: data.signedUrl }
}
