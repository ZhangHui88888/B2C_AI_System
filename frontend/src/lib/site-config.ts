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
  const apiUrl = import.meta.env.PUBLIC_API_URL || '';
  if (!apiUrl) return null;

  const hostHeader = request.headers.get('host') || '';
  const host = normalizeHost(hostHeader);
  if (!host) return null;

  const res = await fetch(`${apiUrl}/api/site-config?host=${encodeURIComponent(host)}`);
  if (!res.ok) return null;

  const data = (await res.json()) as { brand?: SiteBrandConfig };
  if (!data?.brand) return null;

  return { brand: data.brand };
}
