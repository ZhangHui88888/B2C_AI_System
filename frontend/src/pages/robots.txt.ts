import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ site }) => {
  const siteUrl = (site?.toString() || import.meta.env.PUBLIC_SITE_URL || 'https://example.com').replace(/\/$/, '');

  const allowAiBots = [
    'GPTBot',
    'ClaudeBot',
    'PerplexityBot',
  ];

  const lines: string[] = [];

  lines.push('User-agent: *');
  lines.push('Allow: /');
  lines.push('Disallow: /admin');
  lines.push('Disallow: /admin/');
  lines.push('');

  for (const bot of allowAiBots) {
    lines.push(`User-agent: ${bot}`);
    lines.push('Allow: /');
    lines.push('');
  }

  lines.push(`Sitemap: ${siteUrl}/sitemap.xml`);

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
