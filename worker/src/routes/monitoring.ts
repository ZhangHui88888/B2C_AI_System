/**
 * Monitoring and Metrics API Routes
 * Provides endpoints for health checks, metrics, and system status
 */

import type { Env } from '../index';
import { metricsCollector } from '../utils/metrics';
import { jsonResponse } from '../utils/response';
import { requireAdminAuth } from '../middleware/admin-auth';
import { validateCronSecret } from '../utils/cron';

/**
 * Handle monitoring routes
 */
export async function handleMonitoring(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const url = new URL(request.url);

  // Health check endpoint - GET /api/health
  if (path === '/api/health' && request.method === 'GET') {
    return handleHealthCheck(env);
  }

  // Health check with details - GET /api/health/detailed
  if (path === '/api/health/detailed' && request.method === 'GET') {
    const cron = validateCronSecret(request, env);
    if (!cron.ok) return cron.response;
    return handleDetailedHealthCheck(env);
  }

  // Readiness check - GET /api/ready
  if (path === '/api/ready' && request.method === 'GET') {
    return jsonResponse({ ready: true, timestamp: new Date().toISOString() });
  }

  // Liveness check - GET /api/live
  if (path === '/api/live' && request.method === 'GET') {
    return jsonResponse({ alive: true, timestamp: new Date().toISOString() });
  }

  // Performance metrics - GET /api/metrics
  if (path === '/api/metrics' && request.method === 'GET') {
    const { response: authResponse } = await requireAdminAuth(request, env);
    if (authResponse) return authResponse;

    const period = url.searchParams.get('period') || '1h';
    return handleMetrics(period);
  }

  // Endpoint metrics - GET /api/metrics/endpoints
  if (path === '/api/metrics/endpoints' && request.method === 'GET') {
    const { response: authResponse } = await requireAdminAuth(request, env);
    if (authResponse) return authResponse;

    return handleEndpointMetrics();
  }

  // System info - GET /api/system
  if (path === '/api/system' && request.method === 'GET') {
    const { response: authResponse } = await requireAdminAuth(request, env);
    if (authResponse) return authResponse;

    return handleSystemInfo(env);
  }

  // Prometheus metrics - GET /api/metrics/prometheus
  if (path === '/api/metrics/prometheus' && request.method === 'GET') {
    const cron = validateCronSecret(request, env);
    if (!cron.ok) return cron.response;

    return handlePrometheusMetrics();
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

/**
 * Simple health check
 */
function handleHealthCheck(env: Env): Response {
  return jsonResponse({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'development',
  });
}

/**
 * Detailed health check with dependency status
 */
async function handleDetailedHealthCheck(env: Env): Promise<Response> {
  const startTime = Date.now();
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

  // Check Supabase connectivity
  if (env.SUPABASE_URL) {
    try {
      const supabaseStart = Date.now();
      const response = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY || 'anon',
        },
      });
      checks.supabase = {
        status: response.status === 401 || response.status === 200 ? 'healthy' : 'degraded',
        latency: Date.now() - supabaseStart,
      };
    } catch (error) {
      checks.supabase = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Check KV availability
  if (env.CACHE) {
    try {
      const kvStart = Date.now();
      await env.CACHE.get('health-check-test');
      checks.kv = {
        status: 'healthy',
        latency: Date.now() - kvStart,
      };
    } catch (error) {
      checks.kv = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Overall status
  const checkValues = Object.values(checks);
  const allHealthy = checkValues.length === 0 || checkValues.every(c => c.status === 'healthy');
  const anyUnhealthy = checkValues.some(c => c.status === 'unhealthy');

  const status = anyUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded';

  return jsonResponse({
    status,
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'development',
    version: '1.0.0',
    checks,
    responseTime: Date.now() - startTime,
  }, status === 'unhealthy' ? 503 : 200);
}

/**
 * Get performance metrics
 */
function handleMetrics(period: string): Response {
  let since: number;
  switch (period) {
    case '5m':
      since = Date.now() - 5 * 60 * 1000;
      break;
    case '15m':
      since = Date.now() - 15 * 60 * 1000;
      break;
    case '1h':
      since = Date.now() - 60 * 60 * 1000;
      break;
    case '24h':
      since = Date.now() - 24 * 60 * 60 * 1000;
      break;
    default:
      since = Date.now() - 60 * 60 * 1000;
  }

  const metrics = metricsCollector.getPerformanceMetrics(since);

  return jsonResponse({
    period,
    since: new Date(since).toISOString(),
    metrics,
  });
}

/**
 * Get detailed endpoint metrics
 */
function handleEndpointMetrics(): Response {
  const metrics = metricsCollector.getPerformanceMetrics();

  // Transform endpoints to array with calculated averages
  const endpoints = Object.entries(metrics.endpoints).map(([endpoint, data]) => ({
    endpoint,
    count: data.count,
    averageLatency: Math.round(data.totalLatency / data.count),
    errorRate: data.count > 0 ? (data.errors / data.count * 100).toFixed(2) + '%' : '0%',
    errors: data.errors,
  })).sort((a, b) => b.count - a.count);

  return jsonResponse({ endpoints });
}

/**
 * Get system information
 */
function handleSystemInfo(env: Env): Response {
  return jsonResponse({
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'development',
    runtime: 'cloudflare-workers',
    version: '1.0.0',
    features: {
      kv: !!env.CACHE,
    },
  });
}

/**
 * Prometheus-compatible metrics endpoint
 */
function handlePrometheusMetrics(): Response {
  const metrics = metricsCollector.getPerformanceMetrics();

  const lines: string[] = [
    '# HELP http_requests_total Total number of HTTP requests',
    '# TYPE http_requests_total counter',
    `http_requests_total ${metrics.totalRequests}`,
    '',
    '# HELP http_requests_success_total Total number of successful HTTP requests',
    '# TYPE http_requests_success_total counter',
    `http_requests_success_total ${metrics.successfulRequests}`,
    '',
    '# HELP http_requests_failed_total Total number of failed HTTP requests',
    '# TYPE http_requests_failed_total counter',
    `http_requests_failed_total ${metrics.failedRequests}`,
    '',
    '# HELP http_request_duration_milliseconds HTTP request latency',
    '# TYPE http_request_duration_milliseconds summary',
    `http_request_duration_milliseconds{quantile="0.5"} ${metrics.averageLatency}`,
    `http_request_duration_milliseconds{quantile="0.95"} ${metrics.p95Latency}`,
    `http_request_duration_milliseconds{quantile="0.99"} ${metrics.p99Latency}`,
    '',
  ];

  // Add per-status code metrics
  for (const [status, count] of Object.entries(metrics.statusCodes)) {
    lines.push(`http_requests_total{status="${status}"} ${count}`);
  }

  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
