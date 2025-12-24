/**
 * Supabase client for Cloudflare Worker
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../index';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client instance
 */
export function getSupabase(env: Env): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

/**
 * Reset client (useful for testing)
 */
export function resetSupabaseClient(): void {
  supabaseClient = null;
}

/**
 * Database table names
 */
export const Tables = {
  BRANDS: 'brands',
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  ORDERS: 'orders',
  CUSTOMERS: 'customers',
  CONVERSATIONS: 'conversations',
  KNOWLEDGE_BASE: 'knowledge_base',
  SETTINGS: 'settings',
  CONTENT_LIBRARY: 'content_library',
} as const;
