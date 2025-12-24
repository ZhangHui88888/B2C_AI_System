const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'msclkid',
]);

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.startsWith('utm_') || TRACKING_PARAMS.has(lower);
}

function stripTrackingParams(url: URL): URL {
  const u = new URL(url.toString());
  for (const key of Array.from(u.searchParams.keys())) {
    if (isTrackingParam(key)) {
      u.searchParams.delete(key);
    }
  }
  return u;
}

function stripDefaultParams(url: URL): URL {
  const u = new URL(url.toString());
  if (u.searchParams.get('page') === '1') {
    u.searchParams.delete('page');
  }
  return u;
}

export function canonicalFor(url: URL, siteUrl: string): string {
  const cleaned = stripDefaultParams(stripTrackingParams(url));

  const canonical = new URL(cleaned.pathname, siteUrl);
  return canonical.toString();
}

export function shouldNoIndex(url: URL): boolean {
  const cleaned = stripDefaultParams(stripTrackingParams(url));

  const path = cleaned.pathname;
  if (
    path === '/cart' ||
    path === '/checkout' ||
    path === '/order' ||
    path === '/order-confirm' ||
    path.startsWith('/order/')
  ) {
    return true;
  }

  const page = cleaned.searchParams.get('page');
  if (page && page !== '1') {
    return true;
  }

  for (const key of cleaned.searchParams.keys()) {
    if (key.toLowerCase() !== 'page') return true;
  }

  return false;
}
