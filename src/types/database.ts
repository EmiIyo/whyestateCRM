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
      agent_presets: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          position?: number
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      board_members: {
        Row: {
          board_id: string
          invited_at: string
          invited_by: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          board_id: string
          invited_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          board_id?: string
          invited_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: []
      }
      boards: {
        Row: {
          color: string
          created_at: string
          folder_id: string | null
          id: string
          location: string
          name: string
          owner_id: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          folder_id?: string | null
          id?: string
          location?: string
          name: string
          owner_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          folder_id?: string | null
          id?: string
          location?: string
          name?: string
          owner_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          all_day: boolean
          attendees: string[]
          client_id: string | null
          clients_text: string[]
          color: string
          created_at: string
          end_at: string
          google_event_id: string | null
          id: string
          listing_text: string | null
          location: string | null
          notes: string | null
          owner_id: string
          prospect_id: string | null
          start_at: string
          synced_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          attendees?: string[]
          client_id?: string | null
          clients_text?: string[]
          color?: string
          created_at?: string
          end_at: string
          google_event_id?: string | null
          id?: string
          listing_text?: string | null
          location?: string | null
          notes?: string | null
          owner_id: string
          prospect_id?: string | null
          start_at: string
          synced_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          attendees?: string[]
          client_id?: string | null
          clients_text?: string[]
          color?: string
          created_at?: string
          end_at?: string
          google_event_id?: string | null
          id?: string
          listing_text?: string | null
          location?: string | null
          notes?: string | null
          owner_id?: string
          prospect_id?: string | null
          start_at?: string
          synced_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_tasks: {
        Row: {
          client_id: string
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          title: string
        }
        Insert: {
          client_id: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          title: string
        }
        Update: {
          client_id?: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          title?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          board_name: string | null
          budget: string
          converted_listing_id: string | null
          created_at: string
          email: string
          id: string
          last_contact: string | null
          name: string
          next_follow_up: string | null
          notes: string
          owner_id: string
          phone: string
          property_interest: string
          prospect_id: string | null
          source: Database["public"]["Enums"]["client_source"]
          stage: Database["public"]["Enums"]["client_stage"]
          type: Database["public"]["Enums"]["client_type"]
          unit_no: string | null
          updated_at: string
        }
        Insert: {
          board_name?: string | null
          budget?: string
          converted_listing_id?: string | null
          created_at?: string
          email?: string
          id?: string
          last_contact?: string | null
          name?: string
          next_follow_up?: string | null
          notes?: string
          owner_id: string
          phone?: string
          property_interest?: string
          prospect_id?: string | null
          source?: Database["public"]["Enums"]["client_source"]
          stage?: Database["public"]["Enums"]["client_stage"]
          type?: Database["public"]["Enums"]["client_type"]
          unit_no?: string | null
          updated_at?: string
        }
        Update: {
          board_name?: string | null
          budget?: string
          converted_listing_id?: string | null
          created_at?: string
          email?: string
          id?: string
          last_contact?: string | null
          name?: string
          next_follow_up?: string | null
          notes?: string
          owner_id?: string
          phone?: string
          property_interest?: string
          prospect_id?: string | null
          source?: Database["public"]["Enums"]["client_source"]
          stage?: Database["public"]["Enums"]["client_stage"]
          type?: Database["public"]["Enums"]["client_type"]
          unit_no?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      custom_fields: {
        Row: {
          board_id: string | null
          created_at: string
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
          id?: string
          key?: string
          label?: string
          options?: Json
          position?: number
          type?: string
        }
        Relationships: []
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
        Relationships: []
      }
      drive_items: {
        Row: {
          created_at: string
          google_drive_id: string | null
          id: string
          kind: Database["public"]["Enums"]["drive_kind"]
          mime: string | null
          name: string
          owner_id: string
          parent_id: string | null
          size_bytes: number | null
          storage_path: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          google_drive_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["drive_kind"]
          mime?: string | null
          name: string
          owner_id: string
          parent_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          google_drive_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["drive_kind"]
          mime?: string | null
          name?: string
          owner_id?: string
          parent_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      folder_members: {
        Row: {
          folder_id: string
          invited_at: string
          invited_by: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          folder_id: string
          invited_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          folder_id?: string
          invited_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: []
      }
      folders: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      google_connections: {
        Row: {
          calendar_connected: boolean
          connected_at: string
          drive_connected: boolean
          email: string
          mock_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_connected?: boolean
          connected_at?: string
          drive_connected?: boolean
          email: string
          mock_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_connected?: boolean
          connected_at?: string
          drive_connected?: boolean
          email?: string
          mock_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      photo_batch_items: {
        Row: {
          active_version: number
          analysis: Json | null
          batch_id: string
          created_at: string
          error: string | null
          fal_original_url: string | null
          filename: string
          id: string
          idx: number
          original_h: number | null
          original_w: number | null
          status: string
          status_label: string | null
          updated_at: string
          versions: Json
        }
        Insert: {
          active_version?: number
          analysis?: Json | null
          batch_id: string
          created_at?: string
          error?: string | null
          fal_original_url?: string | null
          filename: string
          id?: string
          idx: number
          original_h?: number | null
          original_w?: number | null
          status?: string
          status_label?: string | null
          updated_at?: string
          versions?: Json
        }
        Update: {
          active_version?: number
          analysis?: Json | null
          batch_id?: string
          created_at?: string
          error?: string | null
          fal_original_url?: string | null
          filename?: string
          id?: string
          idx?: number
          original_h?: number | null
          original_w?: number | null
          status?: string
          status_label?: string | null
          updated_at?: string
          versions?: Json
        }
        Relationships: []
      }
      photo_batches: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          user_email: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          user_email: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          user_email?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_access: string[]
          approved_at: string | null
          approved_by: string | null
          avatar_color: string
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tier: Database["public"]["Enums"]["user_tier"]
          updated_at: string
        }
        Insert: {
          admin_access?: string[]
          approved_at?: string | null
          approved_by?: string | null
          avatar_color?: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          tier?: Database["public"]["Enums"]["user_tier"]
          updated_at?: string
        }
        Update: {
          admin_access?: string[]
          approved_at?: string | null
          approved_by?: string | null
          avatar_color?: string
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tier?: Database["public"]["Enums"]["user_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          asking_price: string
          asking_rent: string
          availability: string
          board_id: string | null
          calling_status: string
          created_at: string
          created_by: string | null
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
          updated_by: string | null
        }
        Insert: {
          asking_price?: string
          asking_rent?: string
          availability?: string
          board_id?: string | null
          calling_status?: string
          created_at?: string
          created_by?: string | null
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
          updated_by?: string | null
        }
        Update: {
          asking_price?: string
          asking_rent?: string
          availability?: string
          board_id?: string | null
          calling_status?: string
          created_at?: string
          created_by?: string | null
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
          updated_by?: string | null
        }
        Relationships: []
      }
      recycle_bin: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          expires_at: string
          id: string
          kind: Database["public"]["Enums"]["recycle_kind"]
          payload: Json
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          expires_at?: string
          id?: string
          kind: Database["public"]["Enums"]["recycle_kind"]
          payload: Json
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          expires_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["recycle_kind"]
          payload?: Json
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permissions: string[]
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          permissions?: string[]
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          permissions?: string[]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_approve_user: {
        Args: {
          p_user_id: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_tier: Database["public"]["Enums"]["user_tier"]
          p_admin_access: string[]
        }
        Returns: undefined
      }
      admin_reject_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_set_user_tier: {
        Args: {
          p_tier: Database["public"]["Enums"]["user_tier"]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_set_admin_access: {
        Args: {
          p_user_id: string
          p_access: string[]
        }
        Returns: undefined
      }
      import_prospect_to_client: {
        Args: { p_prospect_id: string }
        Returns: Database["public"]["Tables"]["clients"]["Row"]
      }
    }
    Enums: {
      app_role: "master_admin" | "admin" | "editor" | "viewer"
      client_source: "prospect" | "manual" | "import"
      client_stage:
        | "New"
        | "Engaged"
        | "Qualified"
        | "Proposal"
        | "Negotiating"
        | "Closed Won"
        | "Closed Lost"
      client_type: "Buyer" | "Tenant" | "Seller" | "Landlord" | "Lead"
      drive_kind: "folder" | "file"
      member_role: "admin" | "editor" | "viewer"
      recycle_kind: "board" | "folder" | "prospect"
      task_priority: "high" | "medium" | "low"
      user_tier: "Agent" | "Staff" | "Branch Manager" | "Branch Partner"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  T extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][T]["Row"]

export type TablesInsert<
  T extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][T]["Insert"]

export type TablesUpdate<
  T extends keyof DefaultSchema["Tables"]
> = DefaultSchema["Tables"][T]["Update"]

export type Enums<
  T extends keyof DefaultSchema["Enums"]
> = DefaultSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
      app_role: ["master_admin", "admin", "editor", "viewer"],
      client_source: ["prospect", "manual", "import"],
      client_stage: [
        "New",
        "Engaged",
        "Qualified",
        "Proposal",
        "Negotiating",
        "Closed Won",
        "Closed Lost",
      ],
      client_type: ["Buyer", "Tenant", "Seller", "Landlord", "Lead"],
      drive_kind: ["folder", "file"],
      member_role: ["admin", "editor", "viewer"],
      recycle_kind: ["board", "folder", "prospect"],
      task_priority: ["high", "medium", "low"],
      user_tier: ["Agent", "Staff", "Branch Manager", "Branch Partner"],
    },
  },
} as const
