// Dihasilkan dari skema Supabase "cempaka-costing" (2026-11-14).
// Regenerasi: npx supabase gen types typescript --project-id xdkgqfotohmyqnpwpvcl > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type Rel = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          aksi: string
          alasan: string | null
          created_at: string
          id: number
          nilai_baru: string | null
          nilai_lama: string | null
          objek: string | null
          project_id: number
          user_id: string | null
        }
        Insert: {
          aksi: string
          alasan?: string | null
          created_at?: string
          id?: never
          nilai_baru?: string | null
          nilai_lama?: string | null
          objek?: string | null
          project_id: number
          user_id?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["activity_log"]["Insert"]>
        Relationships: Rel[]
      }
      approvals: {
        Row: {
          approver_id: string
          created_at: string
          id: number
          jenis_revisi: string | null
          keputusan: string
          komentar: string | null
          peran: string
          revision_id: number
        }
        Insert: {
          approver_id: string
          created_at?: string
          id?: never
          jenis_revisi?: string | null
          keputusan: string
          komentar?: string | null
          peran: string
          revision_id: number
        }
        Update: Partial<Database["public"]["Tables"]["approvals"]["Insert"]>
        Relationships: Rel[]
      }
      default_settings: {
        Row: { keterangan: string | null; nilai: number; parameter: string }
        Insert: { keterangan?: string | null; nilai: number; parameter: string }
        Update: { keterangan?: string | null; nilai?: number; parameter?: string }
        Relationships: []
      }
      material_price_history: {
        Row: {
          created_at: string
          harga: number
          id: number
          material_code: string
          project_id: number | null
          status_harga: string
          sumber: string | null
          supplier: string | null
          tanggal: string
        }
        Insert: {
          created_at?: string
          harga: number
          id?: never
          material_code: string
          project_id?: number | null
          status_harga: string
          sumber?: string | null
          supplier?: string | null
          tanggal?: string
        }
        Update: Partial<Database["public"]["Tables"]["material_price_history"]["Insert"]>
        Relationships: Rel[]
      }
      materials: {
        Row: {
          brand: string | null
          code: string
          created_at: string
          deskripsi: string
          deskripsi_id: string | null
          grade: string | null
          harga: number
          harga_tanggal: string
          image: string | null
          kategori: string
          keterangan: string | null
          status_harga: string
          supplier: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          code: string
          created_at?: string
          deskripsi: string
          deskripsi_id?: string | null
          grade?: string | null
          harga: number
          harga_tanggal?: string
          image?: string | null
          kategori: string
          keterangan?: string | null
          status_harga?: string
          supplier?: string | null
          unit: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["materials"]["Insert"]>
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          dibaca: boolean
          id: number
          pesan: string
          project_id: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dibaca?: boolean
          id?: never
          pesan: string
          project_id?: number | null
          user_id: string
        }
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>
        Relationships: Rel[]
      }
      profiles: {
        Row: {
          aktif: boolean
          created_at: string
          email: string | null
          id: string
          nama: string
          peran: string
        }
        Insert: {
          aktif?: boolean
          created_at?: string
          email?: string | null
          id: string
          nama: string
          peran: string
        }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>
        Relationships: []
      }
      project_files: {
        Row: {
          created_at: string
          id: number
          jenis: string
          nama_file: string
          project_id: number
          status_proses: string
          storage_path: string
          ukuran: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          jenis: string
          nama_file: string
          project_id: number
          status_proses?: string
          storage_path: string
          ukuran?: number | null
          uploaded_by?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["project_files"]["Insert"]>
        Relationships: Rel[]
      }
      project_item_images: {
        Row: {
          catatan: string | null
          created_at: string
          id: number
          item_id: number
          tipe_gambar: string
          url: string
          urutan: number
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          id?: number
          item_id: number
          tipe_gambar?: string
          url: string
          urutan?: number
        }
        Update: Partial<Database["public"]["Tables"]["project_item_images"]["Insert"]>
        Relationships: Rel[]
      }
      project_items: {
        Row: {
          area: string | null
          asumsi: string | null
          catatan: string | null
          created_at: string
          deskripsi: string | null
          dimensi: string | null
          harga_jual_manual: boolean
          harga_jual_unit: number | null
          hpp_unit: number | null
          id: number
          image: string | null
          item_code: string
          nama_item: string | null
          option_no: number
          perlu_dicek: boolean
          project_id: number
          qty: number | null
          revision_id: number | null
          tipe: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          area?: string | null
          asumsi?: string | null
          catatan?: string | null
          created_at?: string
          deskripsi?: string | null
          dimensi?: string | null
          harga_jual_manual?: boolean
          harga_jual_unit?: number | null
          hpp_unit?: number | null
          id?: number
          image?: string | null
          item_code: string
          nama_item?: string | null
          option_no?: number
          perlu_dicek?: boolean
          project_id: number
          qty?: number | null
          revision_id?: number | null
          tipe?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["project_items"]["Insert"]>
        Relationships: Rel[]
      }
      project_materials: {
        Row: {
          catatan: string | null
          created_at: string
          harga_dipakai: number | null
          id: number
          item_code: string | null
          material_code: string
          project_id: number
          qty: number | null
          unit: string | null
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          harga_dipakai?: number | null
          id?: never
          item_code?: string | null
          material_code: string
          project_id: number
          qty?: number | null
          unit?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["project_materials"]["Insert"]>
        Relationships: Rel[]
      }
      project_settings: {
        Row: { nilai: number; parameter: string; project_id: number }
        Insert: { nilai: number; parameter: string; project_id: number }
        Update: { nilai?: number; parameter?: string; project_id?: number }
        Relationships: Rel[]
      }
      projects: {
        Row: {
          catatan: string | null
          created_at: string
          current_revision_id: number | null
          holder_id: string | null
          id: number
          jenis: string
          klien: string | null
          kurs_usd: number | null
          nama_proyek: string
          project_code: string
          quo_number: string | null
          sales_id: string | null
          status: string
          tanggal: string | null
          template_id: number | null
          updated_at: string
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          current_revision_id?: number | null
          holder_id?: string | null
          id?: never
          jenis?: string
          klien?: string | null
          kurs_usd?: number | null
          nama_proyek: string
          project_code: string
          quo_number?: string | null
          sales_id?: string | null
          status?: string
          tanggal?: string | null
          template_id?: number | null
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>
        Relationships: Rel[]
      }
      quo_templates: {
        Row: {
          aktif: boolean
          created_at: string
          id: number
          storage_path: string
          uploaded_by: string | null
          versi: string
        }
        Insert: {
          aktif?: boolean
          created_at?: string
          id?: never
          storage_path: string
          uploaded_by?: string | null
          versi: string
        }
        Update: Partial<Database["public"]["Tables"]["quo_templates"]["Insert"]>
        Relationships: Rel[]
      }
      quotation_revisions: {
        Row: {
          catatan: string | null
          created_at: string
          dibuat_oleh: string | null
          excel_path: string | null
          gpm: number | null
          id: number
          kurs_usd: number | null
          project_id: number
          rev_no: number
          sumber: string
          total_hpp: number | null
          total_jual: number | null
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          dibuat_oleh?: string | null
          excel_path?: string | null
          gpm?: number | null
          id?: never
          kurs_usd?: number | null
          project_id: number
          rev_no: number
          sumber: string
          total_hpp?: number | null
          total_jual?: number | null
        }
        Update: Partial<Database["public"]["Tables"]["quotation_revisions"]["Insert"]>
        Relationships: Rel[]
      }
    }
    Views: {
      v_project_items: {
        Row: {
          catatan: string | null
          dimensi: string | null
          id: number | null
          image: string | null
          item_code: string | null
          jml_baris_bom: number | null
          jml_foto: number | null
          nama_item: string | null
          nama_proyek: string | null
          project_code: string | null
          project_id: number | null
          qty: number | null
          tipe: string | null
          total_material: number | null
          unit: string | null
        }
        Relationships: Rel[]
      }
    }
    Functions: {
      app_role: { Args: never; Returns: string }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
