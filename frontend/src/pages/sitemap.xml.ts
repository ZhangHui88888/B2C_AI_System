import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { blogPosts, authors } from '@lib/content';

function xmlEscape(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = (site?.toString() || import.meta.env.PUBLIC_SITE_URL || 'https://example.com').replace(/\/$/, '');

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  const urls: { loc: string; lastmod?: string; changefreq?: string; priority?: string }[] = [];

  const staticPaths = [
    '/',
    '/products',
    '/cart',
    '/checkout',
    '/order',
    '/order-confirm',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
    '/returns',
    '/shipping',
    '/faq',
    '/blog',
  ];

  for (const p of staticPaths) {
    urls.push({ loc: `${siteUrl}${p}`, changefreq: 'weekly', priority: p === '/' ? '1.0' : '0.7' });
  }

  for (const p of blogPosts || []) {
    urls.push({
      loc: `${siteUrl}/blog/${encodeURIComponent(p.slug)}`,
      lastmod: p.updatedAt || p.publishedAt,
      changefreq: 'monthly',
      priority: '0.6',
    });
  }

  for (const a of authors || []) {
    urls.push({
      loc: `${siteUrl}/author/${encodeURIComponent(a.slug)}`,
      changefreq: 'monthly',
      priority: '0.5',
    });
  }

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

    const [{ data: products }, { data: categories }] = await Promise.all([
      supabase.from('products').select('slug, updated_at').eq('is_active', true),
      supabase.from('categories').select('slug, updated_at').eq('is_active', true),
    ]);

    for (const p of products || []) {
      urls.push({
        loc: `${siteUrl}/products/${encodeURIComponent(p.slug)}`,
        lastmod: p.updated_at,
        changefreq: 'weekly',
        priority: '0.8',
      });
    }

    for (const c of categories || []) {
      urls.push({
        loc: `${siteUrl}/category/${encodeURIComponent(c.slug)}`,
        lastmod: c.updated_at,
        changefreq: 'weekly',
        priority: '0.7',
      });
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => {
    const lastmod = u.lastmod ? `<lastmod>${xmlEscape(new Date(u.lastmod).toISOString())}</lastmod>` : '';
    const changefreq = u.changefreq ? `<changefreq>${xmlEscape(u.changefreq)}</changefreq>` : '';
    const priority = u.priority ? `<priority>${xmlEscape(u.priority)}</priority>` : '';
    return `  <url><loc>${xmlEscape(u.loc)}</loc>${lastmod}${changefreq}${priority}</url>`;
  })
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
