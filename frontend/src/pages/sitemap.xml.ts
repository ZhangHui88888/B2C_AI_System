import type { APIRoute } from 'astro';
import { blogPosts, authors } from '@lib/content';
import { fetchSiteConfig } from '@lib/site-config';

function xmlEscape(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export const GET: APIRoute = async ({ site, request }) => {
  let siteUrl = (site?.toString() || 'https://example.com').replace(/\/$/, '');
  try {
    siteUrl = new URL(request.url).origin.replace(/\/$/, '');
  } catch {}

  const siteConfig = await fetchSiteConfig(request);
  const brand = siteConfig?.brand;
  if (!brand) {
    return new Response('Site not found', { status: 404 });
  }

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

  async function fetchJson(url: string, init?: RequestInit): Promise<any | null> {
    try {
      const res = await fetch(url, init);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function flattenCategories(nodes: any[]): any[] {
    const result: any[] = [];
    const stack: any[] = Array.isArray(nodes) ? [...nodes] : [];
    while (stack.length) {
      const node = stack.shift();
      if (!node) continue;
      result.push(node);
      if (Array.isArray(node.children) && node.children.length) {
        stack.push(...node.children);
      }
    }
    return result;
  }

  const apiOrigin = new URL(request.url).origin;
  const categoriesData = await fetchJson(new URL('/api/categories', apiOrigin).toString());
  const categories = flattenCategories(categoriesData?.categories || []);

  for (const c of categories || []) {
    if (!c?.slug) continue;
    urls.push({
      loc: `${siteUrl}/category/${encodeURIComponent(c.slug)}`,
      lastmod: c.updated_at,
      changefreq: 'weekly',
      priority: '0.7',
    });
  }

  const limit = 500;
  let page = 1;

  while (true) {
    const productsData = await fetchJson(new URL('/api/products/list', apiOrigin).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, limit, sort: 'newest' }),
    });

    const products = productsData?.products || [];
    for (const p of products) {
      if (!p?.slug) continue;
      urls.push({
        loc: `${siteUrl}/products/${encodeURIComponent(p.slug)}`,
        lastmod: p.updated_at,
        changefreq: 'weekly',
        priority: '0.8',
      });
    }

    const totalPages = productsData?.pagination?.totalPages;
    if (!totalPages || page >= totalPages || products.length === 0) break;
    page += 1;
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
