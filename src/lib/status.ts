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

// Transisi status yang diizinkan (cermin RPC change_project_status di database — DB yang menegakkan).
// `cancelled` bisa dari status mana pun (wajib alasan), lihat CANCEL_ROLES.
export type StatusTransition = {
  from: ProjectStatus
  to: ProjectStatus
  label: string
  roles: readonly Role[]
  variant: "primary" | "secondary"
  reason?: "optional" | "required"
}

export const STATUS_TRANSITIONS: readonly StatusTransition[] = [
  { from: "costing", to: "internal_review", label: "Ajukan Approval", roles: ["estimator", "admin"], variant: "primary" },
  { from: "internal_review", to: "awaiting_client", label: "Approve", roles: APPROVER_ROLES, variant: "primary" },
  { from: "internal_review", to: "costing", label: "Minta Revisi", roles: APPROVER_ROLES, variant: "secondary", reason: "optional" },
  { from: "awaiting_client", to: "confirmed", label: "Konfirmasi Klien", roles: EDIT_ROLES, variant: "primary" },
  { from: "confirmed", to: "completed", label: "Selesai", roles: APPROVER_ROLES, variant: "primary" },
]

export const CANCEL_ROLES: readonly Role[] = EDIT_ROLES

export function allowedTransitions(status: string, role: string | null | undefined) {
  return STATUS_TRANSITIONS.filter((t) => t.from === status && hasRole(role, t.roles))
}

export function canCancel(status: string, role: string | null | undefined) {
  return status !== "cancelled" && hasRole(role, CANCEL_ROLES)
}

// Reset ke `costing` dari status mana pun (wajib alasan) — cabang reset_status di RPC.
// Di internal_review, approver memakai "Minta Revisi" (tercatat di approvals), jadi reset hanya
// ditampilkan untuk peran lain (estimator) di status itu.
export const RESET_ROLES: readonly Role[] = EDIT_ROLES

export function canReset(status: string, role: string | null | undefined) {
  if (status === "costing" || !hasRole(role, RESET_ROLES)) return false
  return status !== "internal_review" || !hasRole(role, APPROVER_ROLES)
}

export function hasRole(role: string | null | undefined, allowed: readonly Role[]) {
  return !!role && (allowed as readonly string[]).includes(role)
}
