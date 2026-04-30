export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      boards: {
        Row: {
          color: string
          created_at: string
          id: string
          location: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          location?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      custom_fields: {
        Row: {
          board_id: string | null
          created_at: string
          id: string
          key: string
          label: string
          options: Json
          position: number
          type: string
        }
        Insert: {
          board_id?: string | null
          created_at?: string
          id?: string
          key: string
          label: string
          options?: Json
          position?: number
          type?: string
        }
        Update: {
          board_id?: string | null
          created_at?: string
          id?: string
          key?: string
          label?: string
          options?: Json
          position?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_values: {
        Row: {
          field_id: string
          prospect_id: string
          updated_at: string
          value: string
        }
        Insert: {
          field_id: string
          prospect_id: string
          updated_at?: string
          value?: string
        }
        Update: {
          field_id?: string
          prospect_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_values_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          asking_price: string
          asking_rent: string
          availability: string
          board_id: string | null
          calling_status: string
          created_at: string
          furnishing: string
          id: string
          listing_type: string
          name: string
          phone: string
          position: number
          remark: string
          size: string
          type: string
          unit_no: string
          updated_at: string
        }
        Insert: {
          asking_price?: string
          asking_rent?: string
          availability?: string
          board_id?: string | null
          calling_status?: string
          created_at?: string
          furnishing?: string
          id?: string
          listing_type?: string
          name?: string
          phone?: string
          position?: number
          remark?: string
          size?: string
          type?: string
          unit_no?: string
          updated_at?: string
        }
        Update: {
          asking_price?: string
          asking_rent?: string
          availability?: string
          board_id?: string | null
          calling_status?: string
          created_at?: string
          furnishing?: string
          id?: string
          listing_type?: string
          name?: string
          phone?: string
          position?: number
          remark?: string
          size?: string
          type?: string
          unit_no?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
