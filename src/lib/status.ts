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

// Label tampilan (tetap bahasa Inggris); nilai di database tetap snake_case.
export const STATUS_LABEL: Record<ProjectStatus, string> = {
  costing: "Costing",
  internal_review: "Internal Review",
  awaiting_client: "Awaiting Client",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
}

export const STATUS_COLOR: Record<ProjectStatus, string> = {
  costing: "bg-sky-100 text-sky-800",
  internal_review: "bg-amber-100 text-amber-800",
  awaiting_client: "bg-violet-100 text-violet-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  completed: "bg-zinc-200 text-zinc-800",
  cancelled: "bg-rose-100 text-rose-800",
}

// Sesuai CHECK constraint profiles.peran.
export const ROLES = [
  "sales",
  "estimator",
  "pic_proyek",
  "purchasing",
  "manajer",
  "owner",
  "finance",
  "admin",
] as const

export type Role = (typeof ROLES)[number]

export const ROLE_LABEL: Record<Role, string> = {
  sales: "Sales",
  estimator: "Estimator",
  pic_proyek: "PIC Proyek",
  purchasing: "Purchasing",
  manajer: "Manajer",
  owner: "Owner",
  finance: "Finance",
  admin: "Admin",
}

// Peran yang boleh mengedit proyek, item, BOM, revisi (cermin policy RLS).
export const EDIT_ROLES: readonly Role[] = ["estimator", "manajer", "owner", "admin"]
// Peran yang boleh approve (admin setara owner).
export const APPROVER_ROLES: readonly Role[] = ["manajer", "owner", "admin"]
// Khusus admin: kelola user, template QUO, default_settings.
export const ADMIN_ROLES: readonly Role[] = ["admin"]

export function hasRole(role: string | null | undefined, allowed: readonly Role[]) {
  return !!role && (allowed as readonly string[]).includes(role)
}
