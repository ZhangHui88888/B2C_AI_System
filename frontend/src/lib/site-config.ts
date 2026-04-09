function normalizeHost(rawHost: string): string {
  return rawHost.trim().toLowerCase().replace(/:\d+$/, '');
}

export interface SiteBrandConfig {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  favicon_url: string | null;
  theme: any;
  custom_css: string | null;
  social_links: any;
  contact_info: any;
  is_active: boolean;
}

export interface SiteConfigResponse {
  brand: SiteBrandConfig;
}

export async function fetchSiteConfig(request: Request): Promise<SiteConfigResponse | null> {
  const hostHeader = request.headers.get('host') || '';
  const host = normalizeHost(hostHeader);
  if (!host) return null;

  // SSR 时必须使用完整的后端 API URL，因为 Vite proxy 只对客户端生效
  // 开发环境默认使用 localhost:8787
  const configuredUrl = import.meta.env.PUBLIC_API_URL;
  const apiUrl = configuredUrl || 'http://localhost:8787';

  const fullUrl = `${apiUrl}/api/site-config?host=${encodeURIComponent(host)}`;
  console.log('[site-config] Fetching:', fullUrl);

  try {
    const res = await fetch(fullUrl);
    console.log('[site-config] Response status:', res.status);
    if (!res.ok) {
      const text = await res.text();
      console.log('[site-config] Error response:', text);
      return null;
    }

    const data = (await res.json()) as { brand?: SiteBrandConfig };
    if (!data?.brand) return null;

    return { brand: data.brand };
  } catch (e) {
    console.error('[site-config] Fetch error:', e);
    return null;
  }
}
