/**
 * Supabase Database type definitions.
 * Represents the shape of all app-managed tables in the public schema.
 * Generated manually — run `supabase gen types typescript` to auto-generate after migrations run.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          credits: number
          locked_until: string | null
          failed_login_count: number
          reset_request_count: number
          reset_window_start: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          credits?: number
          locked_until?: string | null
          failed_login_count?: number
          reset_request_count?: number
          reset_window_start?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          credits?: number
          locked_until?: string | null
          failed_login_count?: number
          reset_request_count?: number
          reset_window_start?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      jobs: {
        Row: {
          id: string
          user_id: string
          video_id: string | null
          video_title: string | null
          thumbnail_url: string | null
          mode: 'video' | 'audio' | 'thumbnail'
          quality: string | null
          format: string | null
          file_size: number | null
          status: 'processing' | 'success' | 'failed'
          credits_used: number
          trim_enabled: boolean
          trim_start: string | null
          trim_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          video_id?: string | null
          video_title?: string | null
          thumbnail_url?: string | null
          mode: 'video' | 'audio' | 'thumbnail'
          quality?: string | null
          format?: string | null
          file_size?: number | null
          status?: 'processing' | 'success' | 'failed'
          credits_used?: number
          trim_enabled?: boolean
          trim_start?: string | null
          trim_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          video_id?: string | null
          video_title?: string | null
          thumbnail_url?: string | null
          mode?: 'video' | 'audio' | 'thumbnail'
          quality?: string | null
          format?: string | null
          file_size?: number | null
          status?: 'processing' | 'success' | 'failed'
          credits_used?: number
          trim_enabled?: boolean
          trim_start?: string | null
          trim_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'jobs_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      promo_codes: {
        Row: {
          id: string
          code: string
          credits: number
          max_uses: number | null
          current_uses: number
          is_active: boolean
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          credits: number
          max_uses?: number | null
          current_uses?: number
          is_active?: boolean
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          credits?: number
          max_uses?: number | null
          current_uses?: number
          is_active?: boolean
          expires_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          id: string
          user_id: string
          promo_code_id: string
          credits_awarded: number
          redeemed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          promo_code_id: string
          credits_awarded: number
          redeemed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          promo_code_id?: string
          credits_awarded?: number
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'promo_redemptions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'promo_redemptions_promo_code_id_fkey'
            columns: ['promo_code_id']
            isOneToOne: false
            referencedRelation: 'promo_codes'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      deduct_credits: {
        Args: { p_user_id: string; p_amount: number; p_job_id: string }
        Returns: number
      }
      redeem_promo_code: {
        Args: { p_user_id: string; p_code: string }
        Returns: number
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
