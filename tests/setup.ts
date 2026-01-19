import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '.env') });

// Global test configuration
export const API_BASE_URL = process.env.API_BASE_URL || 'https://api.cmsbike.uk';
export const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cmsbike.uk';
export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
export const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || '';
export const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '';
export const TEST_BRAND_SLUG = process.env.TEST_BRAND_SLUG || 'cmsbike-test';
export const TEST_BRAND_DOMAIN = process.env.TEST_BRAND_DOMAIN || 'test.cmsbike.uk';

// Helper to make API requests
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

// Helper to get admin auth token
let cachedToken: string | null = null;

export async function getAdminToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  if (!SUPABASE_URL || !TEST_ADMIN_EMAIL || !TEST_ADMIN_PASSWORD) {
    throw new Error('Missing Supabase credentials in environment');
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
    },
    body: JSON.stringify({
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get admin token: ${response.statusText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  return cachedToken!;
}

// Clear cached token
export function clearTokenCache(): void {
  cachedToken = null;
}
