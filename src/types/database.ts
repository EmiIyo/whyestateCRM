export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
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
        Relationships: [
          {
            foreignKeyName: "agent_presets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "board_members_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "boards_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boards_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "calendar_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "client_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "custom_fields_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_fields_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
        Relationships: [
          {
            foreignKeyName: "drive_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drive_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "drive_items"
            referencedColumns: ["id"]
          },
        ]
      }
      dropdown_presets: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          field: string
          id: string
          position: number
          value: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          field?: string
          id?: string
          position?: number
          value: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          field?: string
          id?: string
          position?: number
          value?: string
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
        Relationships: [
          {
            foreignKeyName: "folder_members_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folder_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folder_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "folders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "google_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "photo_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "photo_batches"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "photo_batches_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          last_edited_at: string | null
          listing_type: string
          name: string
          phone: string
          position: number
          remark: string
          size: string
          type: string
          unit_no: string
          unit_status: string
          updated_at: string
          updated_by: string | null
          valid: string
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
          last_edited_at?: string | null
          listing_type?: string
          name?: string
          phone?: string
          position?: number
          remark?: string
          size?: string
          type?: string
          unit_no?: string
          unit_status?: string
          updated_at?: string
          updated_by?: string | null
          valid?: string
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
          last_edited_at?: string | null
          listing_type?: string
          name?: string
          phone?: string
          position?: number
          remark?: string
          size?: string
          type?: string
          unit_no?: string
          unit_status?: string
          updated_at?: string
          updated_by?: string | null
          valid?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "recycle_bin_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "role_permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          column_widths: Json
          updated_at: string
          user_id: string
          view_unlocked: boolean
          view_zoom: number
          wa_lang: string
          wa_templates: Json
        }
        Insert: {
          column_widths?: Json
          updated_at?: string
          user_id: string
          view_unlocked?: boolean
          view_zoom?: number
          wa_lang?: string
          wa_templates?: Json
        }
        Update: {
          column_widths?: Json
          updated_at?: string
          user_id?: string
          view_unlocked?: boolean
          view_zoom?: number
          wa_lang?: string
          wa_templates?: Json
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
          p_admin_access: string[]
          p_role: Database["public"]["Enums"]["app_role"]
          p_tier: Database["public"]["Enums"]["user_tier"]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_reject_user: { Args: { p_user_id: string }; Returns: undefined }
      admin_set_admin_access: {
        Args: { p_access: string[]; p_user_id: string }
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
      import_prospect_to_client: {
        Args: { p_prospect_id: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reorder_boards: { Args: { p_ids: string[] }; Returns: undefined }
      reorder_folders: { Args: { p_ids: string[] }; Returns: undefined }
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
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

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
