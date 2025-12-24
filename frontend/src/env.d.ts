/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
  readonly PUBLIC_SITE_URL: string;
  readonly PUBLIC_SITE_NAME: string;
  readonly PUBLIC_API_URL: string;
  readonly PUBLIC_SOCIAL_INSTAGRAM?: string;
  readonly PUBLIC_SOCIAL_TIKTOK?: string;
  readonly PUBLIC_SOCIAL_FACEBOOK?: string;
  readonly PUBLIC_SOCIAL_YOUTUBE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
