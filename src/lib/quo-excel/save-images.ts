// Simpan gambar item hasil ekstraksi Excel: kompres (maks 800px, webp) → bucket privat item-images →
// baris project_item_images (url = path di bucket). Dipanggil server action setelah revisi tersimpan.
// Gagal menyimpan gambar tidak membatalkan revisi; jumlah yang gagal dilaporkan sebagai peringatan.

import sharp from "sharp"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import type { ParsedImage } from "./parse"
import { itemKey } from "./diff"
import { ITEM_IMAGES_BUCKET } from "./storage"

const MAX_SIDE = 800
const CONCURRENCY = 6

type Media = Map<number, { data: Uint8Array; extension: string }>

export async function saveItemImages(
  supabase: SupabaseClient<Database>,
  opts: { projectId: number; revisionId: number; revNo: number; images: ParsedImage[]; media: Media },
): Promise<{ saved: number; failed: number }> {
  const { projectId, revisionId, revNo, images, media } = opts
  if (!images.length) return { saved: 0, failed: 0 }

  const { data: items } = await supabase
    .from("project_items")
    .select("id, area, item_code, option_no")
    .eq("revision_id", revisionId)
  const idByKey = new Map((items ?? []).map((i) => [itemKey(i), i.id]))

  // Satu file per gambar unik di workbook, walau dipakai beberapa baris / opsi.
  const ids = [...new Set(images.map((i) => i.imageId))]
  const pathById = new Map<number, string>()
  let failed = 0
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    await Promise.all(
      ids.slice(i, i + CONCURRENCY).map(async (id) => {
        const m = media.get(id)
        if (!m) return void failed++
        try {
          const webp = await sharp(m.data)
            .rotate()
            .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer()
          const path = `${projectId}/rev-${revNo}/${id}.webp`
          const { error } = await supabase.storage
            .from(ITEM_IMAGES_BUCKET)
            .upload(path, webp, { contentType: "image/webp", upsert: true })
          if (error) failed++
          else pathById.set(id, path)
        } catch {
          failed++ // format yang tidak bisa dibaca sharp (mis. EMF/WMF)
        }
      }),
    )
  }

  const rows: Database["public"]["Tables"]["project_item_images"]["Insert"][] = []
  for (const img of images) {
    const path = pathById.get(img.imageId)
    if (!path) continue
    for (const ref of img.items) {
      const itemId = idByKey.get(itemKey(ref))
      if (!itemId) continue
      rows.push({
        item_id: itemId,
        url: path,
        tipe_gambar: img.tipe,
        urutan: img.urutan,
        catatan: `${img.sheet.trim()}!${img.cell}`,
      })
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("project_item_images").insert(rows.slice(i, i + 500))
    if (error) return { saved: 0, failed: failed + ids.length }
  }
  return { saved: pathById.size, failed }
}
