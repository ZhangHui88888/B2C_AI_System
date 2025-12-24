// Supabase Database Types
// This file will be auto-generated from Supabase, but we define it manually for now

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      brands: {
        Row: {
          id: string;
          name: string;
          slug: string;
          domain: string | null;
          logo_url: string | null;
          settings: Json;
          owner_email: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['brands']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['brands']['Insert']>;
      };
      products: {
        Row: {
          id: string;
          brand_id: string;
          name: string;
          slug: string;
          description: string | null;
          short_description: string | null;
          price: number;
          compare_price: number | null;
          cost: number | null;
          sku: string | null;
          stock_quantity: number | null;
          main_image_url: string | null;
          images: string[] | null;
          category_id: string | null;
          supplier_info: Json | null;
          shipping_weight: number | null;
          shipping_time: string | null;
          is_active: boolean;
          is_featured: boolean;
          stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
          seo_title: string | null;
          seo_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          brand_id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          parent_id: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      orders: {
        Row: {
          id: string;
          brand_id: string;
          order_number: string;
          customer_email: string;
          customer_name: string;
          customer_phone: string | null;
          shipping_address: Json;
          items: Json;
          subtotal: number;
          shipping_cost: number;
          discount_amount: number;
          total: number;
          status: 'pending' | 'paid' | 'failed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
          payment_intent_id: string | null;
          tracking_number: string | null;
          tracking_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      customers: {
        Row: {
          id: string;
          brand_id: string;
          email: string;
          name: string | null;
          phone: string | null;
          total_orders: number;
          total_spent: number;
          first_order_at: string | null;
          last_order_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      conversations: {
        Row: {
          id: string;
          brand_id: string;
          session_id: string;
          role: 'user' | 'assistant' | 'system';
          message: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>;
      };
      knowledge_base: {
        Row: {
          id: string;
          brand_id: string;
          content: string;
          metadata: Json | null;
          embedding_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['knowledge_base']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['knowledge_base']['Insert']>;
      };
      settings: {
        Row: {
          id: string;
          brand_id: string;
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['settings']['Row'], 'id' | 'updated_at'> & {
          id?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['settings']['Insert']>;
      };
      content_library: {
        Row: {
          id: string;
          brand_id: string;
          type: 'script' | 'caption' | 'description';
          product_id: string | null;
          content: string;
          platform: 'tiktok' | 'instagram' | 'pinterest' | 'facebook' | 'youtube' | null;
          status: 'draft' | 'approved' | 'published';
          performance_data: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['content_library']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['content_library']['Insert']>;
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// Helper types for easier access
export type Brand = Database['public']['Tables']['brands']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type KnowledgeBase = Database['public']['Tables']['knowledge_base']['Row'];
export type Setting = Database['public']['Tables']['settings']['Row'];
export type ContentLibrary = Database['public']['Tables']['content_library']['Row'];
