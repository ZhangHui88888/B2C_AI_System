// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  output: 'server',
  adapter: cloudflare(),
  site: process.env.PUBLIC_SITE_URL || 'https://your-domain.com',
  vite: {
    build: {
      cssMinify: true,
    },
  },
  image: {
    domains: ['your-cdn.com'],
  },
});
