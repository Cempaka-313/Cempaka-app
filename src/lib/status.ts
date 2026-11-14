// Nama status tetap bahasa Inggris (lihat CLAUDE.md); sesuai CHECK constraint projects.status.
export const PROJECT_STATUSES = [
  "costing",
  "internal_review",
  "awaiting_client",
  "confirmed",
  "completed",
  "cancelled",
] as const

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const STATUS_COLOR: Record<ProjectStatus, string> = {
  costing: "bg-sky-100 text-sky-800",
  internal_review: "bg-amber-100 text-amber-800",
  awaiting_client: "bg-violet-100 text-violet-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  completed: "bg-zinc-200 text-zinc-800",
  cancelled: "bg-rose-100 text-rose-800",
}

export const ROLE_LABEL: Record<string, string> = {
  sales: "Sales",
  estimator: "Estimator",
  pic_proyek: "PIC Proyek",
  purchasing: "Purchasing",
  manajer: "Manajer",
  owner: "Owner",
  finance: "Finance",
}
