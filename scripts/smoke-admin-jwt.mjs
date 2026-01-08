#!/usr/bin/env node

import fs from 'node:fs/promises';

const API_BASE = process.env.API_BASE || 'http://localhost:8787';

function normalizeValue(raw) {
  if (!raw) return '';
  return String(raw)
    .trim()
    .replace(/^`/, '')
    .replace(/`$/, '')
    .replace(/^"/, '')
    .replace(/"$/, '')
    .replace(/^'/, '')
    .replace(/'$/, '');
}

async function tryLoadFromDotenvFile(filePath, keys) {
  let content = '';
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch {
    return;
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const k = m[1];
    if (!keys.includes(k)) continue;
    if (process.env[k]) continue;
    const v = normalizeValue(m[2]);
    if (v) process.env[k] = v;
  }
}

async function tryLoadFromCredentialsMd(filePath, keys) {
  let content = '';
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch {
    return;
  }

  for (const k of keys) {
    if (process.env[k]) continue;
    for (const line of content.split(/\r?\n/)) {
      if (!line.includes(k)) continue;
      const m = line.match(new RegExp(`\\b${k}\\b\\s*[:=]\\s*([^\\s]+)`, 'i'));
      if (!m || !m[1]) continue;
      const v = normalizeValue(m[1]);
      if (v) process.env[k] = v;
      break;
    }
  }
}

async function loadEnvDefaults() {
  const keys = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_KEY',
    'BRAND_ID',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
  ];
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length === 0) return;

  // Wrangler dev already uses worker/.dev.vars; reuse it for the smoke script.
  await tryLoadFromDotenvFile('.\\worker\\.dev.vars', keys);
  await tryLoadFromDotenvFile('.\\.dev.vars', keys);

  // Fallback: parse markdown credentials file for env-like lines.
  await tryLoadFromCredentialsMd('.\\.credentials.local.md', keys);
}

function env(name) {
  return process.env[name];
}

function requiredEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
}

function redactToken(token) {
  if (!token || token.length < 16) return '***';
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

async function supabasePasswordGrantJwt() {
  const SUPABASE_URL = env('SUPABASE_URL');
  const SUPABASE_ANON_KEY = env('SUPABASE_ANON_KEY') || env('SUPABASE_SERVICE_KEY');
  const ADMIN_EMAIL = env('ADMIN_EMAIL');
  const ADMIN_PASSWORD = env('ADMIN_PASSWORD');

  requiredEnv('SUPABASE_URL', SUPABASE_URL);
  requiredEnv('SUPABASE_ANON_KEY (or SUPABASE_SERVICE_KEY)', SUPABASE_ANON_KEY);
  requiredEnv('ADMIN_EMAIL', ADMIN_EMAIL);
  requiredEnv('ADMIN_PASSWORD', ADMIN_PASSWORD);

  const url = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/token?grant_type=password`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message = json?.error_description || json?.error || `HTTP ${res.status}`;
    throw new Error(`Supabase login failed: ${message}`);
  }

  const token = json?.access_token;
  if (!token) throw new Error('Supabase login did not return access_token');
  return token;
}

async function http(path, { method = 'GET', headers = {}, body } = {}) {
  const url = `${API_BASE.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body,
  });

  const text = await res.text().catch(() => '');
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { res, text, json, url };
}

async function run() {
  await loadEnvDefaults();

  const BRAND_ID = env('BRAND_ID');
  const ADMIN_JWT = env('ADMIN_JWT');

  requiredEnv('BRAND_ID', BRAND_ID);

  const jwt = ADMIN_JWT || (await supabasePasswordGrantJwt());

  console.log('[smoke-admin-jwt] API_BASE:', API_BASE);
  console.log('[smoke-admin-jwt] BRAND_ID:', BRAND_ID);
  console.log('[smoke-admin-jwt] JWT:', redactToken(jwt));

  const authHeaders = {
    Authorization: `Bearer ${jwt}`,
    'x-brand-id': BRAND_ID,
  };

  const tests = [
    // ---- Admin SEO ----
    {
      name: 'admin seo overview (401 without token)',
      req: () => http('/api/admin/seo/overview', { headers: { 'x-brand-id': BRAND_ID } }),
      expectStatus: 401,
    },
    {
      name: 'admin seo overview (200 with token)',
      req: () => http('/api/admin/seo/overview', { headers: authHeaders }),
      expectStatus: 200,
    },
    {
      name: 'admin seo redirects list (200)',
      req: () => http('/api/admin/seo/redirects', { headers: authHeaders }),
      expectStatus: 200,
    },
    {
      name: 'admin seo errors list (200)',
      req: () => http('/api/admin/seo/errors', { headers: authHeaders }),
      expectStatus: 200,
    },

    // ---- Admin Sitemap ----
    {
      name: 'admin sitemap stats (401 without token)',
      req: () => http('/api/admin/sitemap/stats', { headers: { 'x-brand-id': BRAND_ID } }),
      expectStatus: 401,
    },
    {
      name: 'admin sitemap stats (200 with token)',
      req: () => http('/api/admin/sitemap/stats', { headers: authHeaders }),
      expectStatus: 200,
    },
    {
      name: 'admin sitemap shards (200 with token)',
      req: () => http('/api/admin/sitemap/shards', { headers: authHeaders }),
      expectStatus: 200,
    },

    // ---- Brand header enforcement ----
    {
      name: 'admin seo overview (400 without brand header)',
      req: () => http('/api/admin/seo/overview', { headers: { Authorization: `Bearer ${jwt}` } }),
      expectStatus: 400,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const startedAt = Date.now();
    try {
      const { res, json, text, url } = await t.req();
      const ms = Date.now() - startedAt;

      const ok = res.status === t.expectStatus;
      if (ok) {
        passed++;
        console.log(`PASS  [${res.status}] ${t.name} (${ms}ms)`);
      } else {
        failed++;
        const detail = json?.error || json?.message || text?.slice(0, 300) || '';
        console.error(`FAIL  [${res.status}] ${t.name} (${ms}ms) url=${url}`);
        if (detail) console.error(`      detail: ${detail}`);
      }
    } catch (err) {
      failed++;
      console.error(`ERROR ${t.name}:`, err?.message || err);
    }
  }

  console.log('');
  console.log(`[smoke-admin-jwt] done. passed=${passed} failed=${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('[smoke-admin-jwt] fatal:', err?.message || err);
  process.exitCode = 1;
});
