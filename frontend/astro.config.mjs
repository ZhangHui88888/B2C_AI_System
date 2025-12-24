// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  output: 'static',
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
