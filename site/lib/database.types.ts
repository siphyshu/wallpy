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
    PostgrestVersion: "12.2.12"
  }
  public: {
    Tables: {
      artists: {
        Row: {
          avatar_key: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          profile_id: string | null
          url: string | null
        }
        Insert: {
          avatar_key?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          profile_id?: string | null
          url?: string | null
        }
        Update: {
          avatar_key?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          profile_id?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artists_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blob_uploads: {
        Row: {
          created_at: string
          profile_id: string
          sha256: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          sha256: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "blob_uploads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blob_uploads_sha256_fkey"
            columns: ["sha256"]
            isOneToOne: false
            referencedRelation: "blobs"
            referencedColumns: ["sha256"]
          },
        ]
      }
      blobs: {
        Row: {
          blurhash: string | null
          created_at: string
          height: number | null
          mime: string
          sha256: string
          size: number
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          blurhash?: string | null
          created_at?: string
          height?: number | null
          mime: string
          sha256: string
          size: number
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          blurhash?: string | null
          created_at?: string
          height?: number | null
          mime?: string
          sha256?: string
          size?: number
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blobs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      downloads: {
        Row: {
          client: Database["public"]["Enums"]["download_client"]
          created_at: string
          day: string
          id: number
          ip_hash: string
          pack_id: string
          profile_id: string | null
          version_id: string | null
        }
        Insert: {
          client: Database["public"]["Enums"]["download_client"]
          created_at?: string
          day?: string
          id?: never
          ip_hash: string
          pack_id: string
          profile_id?: string | null
          version_id?: string | null
        }
        Update: {
          client?: Database["public"]["Enums"]["download_client"]
          created_at?: string
          day?: string
          id?: never
          ip_hash?: string
          pack_id?: string
          profile_id?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "downloads_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downloads_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downloads_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "pack_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      favourites: {
        Row: {
          created_at: string
          pack_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          pack_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          pack_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourites_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favourites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_events: {
        Row: {
          action: Database["public"]["Enums"]["moderation_action"]
          actor_id: string | null
          created_at: string
          id: number
          notes: string | null
          version_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["moderation_action"]
          actor_id?: string | null
          created_at?: string
          id?: never
          notes?: string | null
          version_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["moderation_action"]
          actor_id?: string | null
          created_at?: string
          id?: never
          notes?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_events_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "pack_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_versions: {
        Row: {
          ai_use: Database["public"]["Enums"]["ai_use"] | null
          artist_id: string | null
          cover_file_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["pack_kind"] | null
          license: Database["public"]["Enums"]["pack_license"]
          license_notes: string | null
          number: number
          pack_id: string
          preview_sha256: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          schedule: Json
          status: Database["public"]["Enums"]["version_status"]
          submitted_at: string | null
          tags: string[]
          thumb_sha256: string | null
          title: string
          uploader_is_artist: boolean
        }
        Insert: {
          ai_use?: Database["public"]["Enums"]["ai_use"] | null
          artist_id?: string | null
          cover_file_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["pack_kind"] | null
          license?: Database["public"]["Enums"]["pack_license"]
          license_notes?: string | null
          number: number
          pack_id: string
          preview_sha256?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule: Json
          status?: Database["public"]["Enums"]["version_status"]
          submitted_at?: string | null
          tags?: string[]
          thumb_sha256?: string | null
          title: string
          uploader_is_artist?: boolean
        }
        Update: {
          ai_use?: Database["public"]["Enums"]["ai_use"] | null
          artist_id?: string | null
          cover_file_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["pack_kind"] | null
          license?: Database["public"]["Enums"]["pack_license"]
          license_notes?: string | null
          number?: number
          pack_id?: string
          preview_sha256?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule?: Json
          status?: Database["public"]["Enums"]["version_status"]
          submitted_at?: string | null
          tags?: string[]
          thumb_sha256?: string | null
          title?: string
          uploader_is_artist?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pack_versions_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_versions_cover_file_fkey"
            columns: ["cover_file_id"]
            isOneToOne: false
            referencedRelation: "version_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_versions_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_versions_preview_sha256_fkey"
            columns: ["preview_sha256"]
            isOneToOne: false
            referencedRelation: "blobs"
            referencedColumns: ["sha256"]
          },
          {
            foreignKeyName: "pack_versions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_versions_thumb_sha256_fkey"
            columns: ["thumb_sha256"]
            isOneToOne: false
            referencedRelation: "blobs"
            referencedColumns: ["sha256"]
          },
        ]
      }
      packs: {
        Row: {
          created_at: string
          current_version_id: string | null
          download_count: number
          favourite_count: number
          id: string
          is_listed: boolean
          owner_id: string
          removed_at: string | null
          removed_reason: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          current_version_id?: string | null
          download_count?: number
          favourite_count?: number
          id?: string
          is_listed?: boolean
          owner_id: string
          removed_at?: string | null
          removed_reason?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          current_version_id?: string | null
          download_count?: number
          favourite_count?: number
          id?: string
          is_listed?: boolean
          owner_id?: string
          removed_at?: string | null
          removed_reason?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "packs_current_version_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "pack_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_key: string | null
          bio: string | null
          contact_email: string | null
          cover_key: string | null
          created_at: string
          display_name: string | null
          id: string
          links: Json
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          username: string
          website: string | null
        }
        Insert: {
          avatar_key?: string | null
          bio?: string | null
          contact_email?: string | null
          cover_key?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          links?: Json
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username: string
          website?: string | null
        }
        Update: {
          avatar_key?: string | null
          bio?: string | null
          contact_email?: string | null
          cover_key?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          links?: Json
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string
          website?: string | null
        }
        Relationships: []
      }
      version_files: {
        Row: {
          id: string
          path: string
          preview_sha256: string | null
          sha256: string
          sort_order: number
          thumb_sha256: string | null
          version_id: string
        }
        Insert: {
          id?: string
          path: string
          preview_sha256?: string | null
          sha256: string
          sort_order?: number
          thumb_sha256?: string | null
          version_id: string
        }
        Update: {
          id?: string
          path?: string
          preview_sha256?: string | null
          sha256?: string
          sort_order?: number
          thumb_sha256?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "version_files_sha256_fkey"
            columns: ["sha256"]
            isOneToOne: false
            referencedRelation: "blobs"
            referencedColumns: ["sha256"]
          },
          {
            foreignKeyName: "version_files_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "pack_versions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      blob_is_public: { Args: { s: string }; Returns: boolean }
      can_see_version: { Args: { v: string }; Returns: boolean }
      can_use_blob: { Args: { s: string }; Returns: boolean }
      create_pack: { Args: { p: Json }; Returns: Json }
      create_version: { Args: { p: Json; p_slug: string }; Returns: Json }
      interval_minutes: { Args: { i: string }; Returns: number }
      is_api_caller: { Args: never; Returns: boolean }
      is_http_url: { Args: { u: string }; Returns: boolean }
      is_moderator: { Args: never; Returns: boolean }
      is_public_version: { Args: { v: string }; Returns: boolean }
      moderate: {
        Args: {
          p_action: Database["public"]["Enums"]["moderation_action"]
          p_notes?: string
          p_version: string
        }
        Returns: Database["public"]["Enums"]["version_status"]
      }
      owns_pack: { Args: { p: string }; Returns: boolean }
      schedule_images: { Args: { s: Json }; Returns: string[] }
      schedule_kind: {
        Args: { s: Json }
        Returns: Database["public"]["Enums"]["pack_kind"]
      }
      schedule_ok: { Args: { s: Json }; Returns: boolean }
      spec_rotate_ok: { Args: { r: string }; Returns: boolean }
      spec_time_ok: { Args: { t: string }; Returns: boolean }
      uploaded_by_me: { Args: { s: string }; Returns: boolean }
      valid_links: { Args: { l: Json }; Returns: boolean }
      valid_tags: { Args: { t: string[] }; Returns: boolean }
      write_version: { Args: { p: Json; p_pack_id: string }; Returns: Json }
    }
    Enums: {
      ai_use: "none" | "assisted" | "generated"
      download_client: "cli" | "web"
      moderation_action:
        | "submit"
        | "approve"
        | "reject"
        | "takedown"
        | "restore"
        | "decline"
      pack_kind: "timeblocks" | "days" | "album"
      pack_license:
        | "personal-use"
        | "cc-by-4.0"
        | "cc-by-nc-4.0"
        | "cc0"
        | "other"
      user_role: "user" | "moderator" | "admin"
      version_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "superseded"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      ai_use: ["none", "assisted", "generated"],
      download_client: ["cli", "web"],
      moderation_action: [
        "submit",
        "approve",
        "reject",
        "takedown",
        "restore",
        "decline",
      ],
      pack_kind: ["timeblocks", "days", "album"],
      pack_license: [
        "personal-use",
        "cc-by-4.0",
        "cc-by-nc-4.0",
        "cc0",
        "other",
      ],
      user_role: ["user", "moderator", "admin"],
      version_status: [
        "draft",
        "pending",
        "approved",
        "rejected",
        "superseded",
      ],
    },
  },
} as const
