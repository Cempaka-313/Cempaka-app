// Konstanta penyimpanan file QUO (dipakai browser dan server). Bucket dibuat di migrasi quotation_upload.
export const QUO_BUCKET = "quotation-files"
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
export const QUO_MAX_BYTES = 20 * 1024 * 1024

export function newUploadPath(projectId: number) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "")
  return `${projectId}/${stamp}-${crypto.randomUUID()}.xlsx`
}

export function isValidUploadPath(projectId: number, path: string) {
  return new RegExp(`^${projectId}/[A-Za-z0-9-]+\\.xlsx$`).test(path)
}
