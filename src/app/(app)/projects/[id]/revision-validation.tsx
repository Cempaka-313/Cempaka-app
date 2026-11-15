import { formatDateTime, formatMoney } from "@/lib/format"
import { evaluateValidation, type CountableItem, type Validasi } from "@/lib/quo-excel/validation"
import { DiscrepancyReasonForm, DoubleCountChoice } from "./validation-controls"

type Item = CountableItem & { id: number; item_code: string; nama_item: string | null; dobel_grup: string | null }

type Props = {
  projectId: number
  revision: {
    id: number
    rev_no: number
    validasi: unknown
    selisih: boolean
    selisih_alasan: string | null
    selisih_at: string | null
    penyetuju_selisih: { nama: string | null } | null
  }
  items: Item[]
  jenis: string
  canEdit: boolean
}

// Panel validasi total revisi aktif: selisih Sub Total Excel vs jumlah baris, SUMMARY vs area,
// pilihan baris yang dihitung untuk kemungkinan hitung dobel, dan alasan "selisih disengaja".
export function RevisionValidation({ projectId, revision, items, jenis, canEdit }: Props) {
  const validasi = revision.validasi as Validasi | null
  if (!validasi) return null

  const result = evaluateValidation(validasi, items)
  const groups = new Map<string, Item[]>()
  for (const it of items) {
    if (!it.dobel_grup) continue
    const key = `${it.area ?? ""}|${it.option_no}|${it.dobel_grup}`
    groups.set(key, [...(groups.get(key) ?? []), it])
  }
  const multiOption = items.some((i) => i.option_no === 2)
  const ok = !revision.selisih && !groups.size

  return (
    <section
      id="validasi"
      className={`rounded border bg-white text-xs ${revision.selisih && !revision.selisih_alasan ? "border-rose-300" : "border-zinc-200"}`}
    >
      <h2 className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-2 text-sm font-semibold">
        Validasi total Rev {revision.rev_no}
        {ok && <span className="rounded bg-emerald-100 px-1.5 text-xs font-normal text-emerald-800">cocok dengan Excel</span>}
        {revision.selisih && (
          <span
            className={`rounded px-1.5 text-xs font-normal ${revision.selisih_alasan ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"}`}
          >
            {revision.selisih_alasan ? "selisih disengaja" : "ada selisih"}
          </span>
        )}
      </h2>

      <div className="space-y-3 p-4">
        {result.messages.length > 0 && (
          <ul className="list-disc space-y-1 rounded bg-rose-50 py-2 pl-6 pr-3 text-rose-700">
            {result.messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}

        {groups.size > 0 && (
          <div className="space-y-2">
            <p className="font-medium text-zinc-700">Kemungkinan hitung dobel — pilih baris yang dijumlahkan:</p>
            {[...groups.entries()].map(([key, list]) => (
              <div key={key} className="rounded border border-amber-200 bg-amber-50/50 p-2">
                <p className="mb-1 text-zinc-500">
                  {list[0].area}
                  {multiOption ? ` · opsi ${list[0].option_no}` : ""} · harga sama
                </p>
                <DoubleCountChoice
                  projectId={projectId}
                  canEdit={canEdit}
                  options={list.map((i) => ({
                    id: i.id,
                    code: i.item_code,
                    nama: i.nama_item,
                    harga: formatMoney(i.harga_jual_unit, jenis),
                    dihitung: i.dihitung,
                  }))}
                />
              </div>
            ))}
          </div>
        )}

        {revision.selisih &&
          (revision.selisih_alasan ? (
            <p className="rounded bg-amber-50 p-2 text-amber-900">
              <span className="font-medium">Selisih disengaja:</span> {revision.selisih_alasan}
              <span className="block text-amber-700">
                {revision.penyetuju_selisih?.nama ?? "—"}
                {revision.selisih_at ? ` · ${formatDateTime(revision.selisih_at)}` : ""}
              </span>
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-zinc-600">
                Selama masih ada selisih, <span className="font-medium">Ajukan Approval</span> diblok. Perbaiki di Excel lalu
                upload revisi baru, atau isi alasan bila selisih memang disengaja.
              </p>
              {canEdit && <DiscrepancyReasonForm projectId={projectId} revisionId={revision.id} />}
            </div>
          ))}
      </div>
    </section>
  )
}
