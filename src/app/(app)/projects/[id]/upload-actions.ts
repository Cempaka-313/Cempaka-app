"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { EDIT_ROLES, hasRole } from "@/lib/status"
import { parseQuoWorkbook, QuoParseError, toItemRows } from "@/lib/quo-excel/parse"
import { diffItems, summarizeDiff } from "@/lib/quo-excel/diff"
import { isValidUploadPath, QUO_BUCKET, QUO_MAX_BYTES } from "@/lib/quo-excel/storage"
import type { Json } from "@/types/database"

export type UploadResult = {
  error?: string
  revNo?: number
  summary?: string
  warnings?: string[]
}

// File sudah di-upload browser langsung ke Storage (menghindari batas body Server Action 1MB).
// Di sini file diunduh, dibaca, lalu revisi + item + activity_log disimpan atomik lewat RPC
// create_quotation_revision. Bila gagal, file yang baru di-upload dihapus lagi.
export async function importRevisionExcel(projectId: number, path: string, fileName: string): Promise<UploadResult> {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims.sub) return { error: "Sesi berakhir, silakan login ulang." }
  if (!isValidUploadPath(projectId, path)) return { error: "Lokasi file tidak valid." }

  const storage = supabase.storage.from(QUO_BUCKET)
  const discard = async (error: string): Promise<UploadResult> => {
    await storage.remove([path])
    return { error }
  }

  const { data: role } = await supabase.rpc("app_role")
  if (!hasRole(role, EDIT_ROLES)) return discard("Anda tidak punya izin mengupload revisi.")

  const { data: project } = await supabase
    .from("projects")
    .select("id, project_code, jenis, kurs_usd, current_revision_id")
    .eq("id", projectId)
    .maybeSingle()
  if (!project) return discard("Proyek tidak ditemukan.")

  const { data: blob, error: dlError } = await storage.download(path)
  if (dlError || !blob) return discard(`File tidak bisa diambil dari storage: ${dlError?.message ?? "kosong"}`)
  if (blob.size > QUO_MAX_BYTES) return discard("File lebih dari 20 MB.")

  let parsed
  try {
    parsed = await parseQuoWorkbook(await blob.arrayBuffer(), {
      projectCode: project.project_code,
      kursUsd: project.kurs_usd,
    })
  } catch (e) {
    return discard(e instanceof QuoParseError ? e.message : "Gagal membaca file Excel.")
  }
  const expected = project.jenis === "export" ? "USD" : "IDR"
  if (parsed.currency !== expected) {
    parsed.warnings.unshift(
      `Harga di file dalam ${parsed.currency}, tetapi proyek berjenis ${project.jenis === "export" ? "Export (USD)" : "Lokal (IDR)"} — periksa jenis proyek atau file.`,
    )
  }

  const items = toItemRows(parsed.lines)
  let compare = "revisi pertama"
  if (project.current_revision_id) {
    const { data: prevRev } = await supabase
      .from("quotation_revisions")
      .select("rev_no")
      .eq("id", project.current_revision_id)
      .maybeSingle()
    const { data: prevItems } = await supabase
      .from("project_items")
      .select("area, item_code, option_no, nama_item, qty, unit, harga_jual_unit, hpp_unit")
      .eq("revision_id", project.current_revision_id)
    compare = `vs Rev ${prevRev?.rev_no ?? "?"}: ${summarizeDiff(diffItems(prevItems ?? [], items))}`
  }

  const catatan = [
    `File: ${fileName}`,
    [parsed.quoNumber, parsed.revisiLabel].filter(Boolean).join(" · ") || null,
    `Area: ${parsed.areas.map((a) => `${a.area} (${a.itemCount} baris)`).join(", ")}`,
    `Perbandingan ${compare}`,
    parsed.warnings.length ? `Peringatan:\n${parsed.warnings.map((w) => `- ${w}`).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const { data: created, error } = await supabase.rpc("create_quotation_revision", {
    p_project_id: projectId,
    p_excel_path: path,
    p_total_hpp: parsed.totalHpp,
    p_total_jual: parsed.totalJual,
    p_gpm: parsed.gpm,
    p_catatan: catatan,
    p_items: items as unknown as Json,
    p_log: `${fileName} — ${compare}`,
  })
  if (error) return discard(error.message)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/")
  return { revNo: created?.[0]?.rev_no, summary: compare, warnings: parsed.warnings }
}
