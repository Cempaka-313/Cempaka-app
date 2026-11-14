# Cempaka App — Konteks Proyek

Aplikasi web internal untuk **Cempaka** (kontraktor interior/furniture, Bali).
Pemilik proyek: Reza (Estimator).

> Status saat ini: **kerangka aplikasi** (Next.js 16 + Supabase auth, login, kanban proyek, manifest PWA).
> Next.js 16 punya perubahan besar (mis. `proxy.ts` pengganti middleware, Cache Components aktif) — baca @AGENTS.md dan dokumentasi di `node_modules/next/dist/docs/` sebelum menulis kode.
> Data yang membaca sesi/cookie harus dibungkus `<Suspense>` (lihat `src/app/(app)/layout.tsx`).

## Ruang lingkup v1
Alur **BOQ → costing → revisi Excel → approval → dashboard**.

## Peran pengguna
Sales, Estimator, PIC Proyek, Purchasing, Manajer, Owner, Finance, **Admin**.
- Admin: akses penuh termasuk approval (setara Owner).
- Hanya Admin: kelola user (tambah/nonaktifkan/ubah peran), upload template QUO, ubah `default_settings`.

## Alur approval
- Urutan: **Estimator → Manajer → Owner**.
- Manajer boleh approve final bila Owner tidak ada.
- **Revisi harga jual**: boleh langsung dilakukan Manajer/Owner (tanpa kembali ke Estimator).
- **Revisi material**: kembali ke Estimator.

## Jenis proyek
| | Lokal | Export |
|---|---|---|
| Mata uang | Rupiah (IDR) | USD |
| Kurs | — | Diisi manual |
| Pajak | PPN 12% | Tanpa PPN |
| Shipping | — | Ada blok shipping |

- Maksimal **2 opsi material per item**.

## Excel sebagai format kerja utama
- Template **QUO_INT Cempaka** (sheet QUO, REKAP, CUTTING LIST, BOM, PROSES, MATERIAL, PENGATURAN) tetap jadi format kerja utama.
- Alur: download dari aplikasi → edit di Excel → upload balik → tersimpan sebagai **revisi baru** (riwayat revisi tidak ditimpa).

## Status proyek / quotation
`costing` → `internal_review` → `awaiting_client` → `confirmed` → `completed`
Plus `cancelled` (bisa dari tahap mana pun).

## Database
- Supabase project **"cempaka-costing"** — skema v1 sudah ada.
- Periksa skema yang ada (tabel, migrasi) sebelum mengubah apa pun.

## UI / UX
- Gaya **Odoo**: tampilan kanban, status bar, smart button, chatter (log aktivitas & komentar per record).
- Responsif untuk HP, dipasang sebagai **PWA**.
- **Bahasa UI: Indonesia**, tetapi **nama status tetap bahasa Inggris** (seperti di atas).

## Stack
- Next.js (frontend + API)
- Supabase (database, auth, storage)
- Vercel (hosting)
