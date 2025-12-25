/**
 * Performance Metrics Collection for Cloudflare Workers
 * Tracks request metrics, latencies, and custom events
 */

export interface MetricPoint {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
}

export interface RequestMetrics {
  requestId: string;
  method: string;
  path: string;
  status: number;
  duration: number;
  brandId?: string;
  timestamp: number;
}

export interface PerformanceMetrics {
  // Request metrics
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;

  // Breakdown by status
  statusCodes: Record<string, number>;

  // Breakdown by endpoint
  endpoints: Record<string, {
    count: number;
    totalLatency: number;
    errors: number;
  }>;
}

/**
 * Metrics collector class
 * In a full implementation, this would send to Analytics Engine or external service
 */
export class MetricsCollector {
  private metrics: MetricPoint[] = [];
  private requestMetrics: RequestMetrics[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics in memory

  /**
   * Record a metric point
   */
  record(name: string, value: number, tags: Record<string, string> = {}): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      tags,
    });

    // Trim old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Record request metrics
   */
  recordRequest(metrics: RequestMetrics): void {
    this.requestMetrics.push(metrics);

    // Trim old metrics
    if (this.requestMetrics.length > this.maxMetrics) {
      this.requestMetrics = this.requestMetrics.slice(-this.maxMetrics);
    }

    // Also record as generic metrics
    this.record('request.duration', metrics.duration, {
      method: metrics.method,
      path: metrics.path,
      status: String(metrics.status),
      brandId: metrics.brandId || 'unknown',
    });

    this.record('request.count', 1, {
      method: metrics.method,
      status: String(metrics.status),
    });
  }

  /**
   * Record a timing metric
   */
  timing(name: string, duration: number, tags: Record<string, string> = {}): void {
    this.record(`timing.${name}`, duration, tags);
  }

  /**
   * Record a counter increment
   */
  increment(name: string, value = 1, tags: Record<string, string> = {}): void {
    this.record(`counter.${name}`, value, tags);
  }

  /**
   * Record a gauge value
   */
  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    this.record(`gauge.${name}`, value, tags);
  }

  /**
   * Get aggregated performance metrics
   */
  getPerformanceMetrics(since?: number): PerformanceMetrics {
    const cutoff = since || Date.now() - 3600000; // Default: last hour
    const recentRequests = this.requestMetrics.filter(m => m.timestamp >= cutoff);

    if (recentRequests.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        statusCodes: {},
        endpoints: {},
      };
    }

    // Calculate latency percentiles
    const latencies = recentRequests.map(r => r.duration).sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    // Aggregate by status code
    const statusCodes: Record<string, number> = {};
    recentRequests.forEach(r => {
      statusCodes[r.status] = (statusCodes[r.status] || 0) + 1;
    });

    // Aggregate by endpoint
    const endpoints: Record<string, { count: number; totalLatency: number; errors: number }> = {};
    recentRequests.forEach(r => {
      const key = `${r.method} ${r.path}`;
      if (!endpoints[key]) {
        endpoints[key] = { count: 0, totalLatency: 0, errors: 0 };
      }
      endpoints[key].count++;
      endpoints[key].totalLatency += r.duration;
      if (r.status >= 400) {
        endpoints[key].errors++;
      }
    });

    const successfulRequests = recentRequests.filter(r => r.status < 400).length;
    const totalLatency = recentRequests.reduce((sum, r) => sum + r.duration, 0);

    return {
      totalRequests: recentRequests.length,
      successfulRequests,
      failedRequests: recentRequests.length - successfulRequests,
      averageLatency: Math.round(totalLatency / recentRequests.length),
      p95Latency: latencies[p95Index] || 0,
      p99Latency: latencies[p99Index] || 0,
      statusCodes,
      endpoints,
    };
  }

  /**
   * Get raw metrics for a time period
   */
  getMetrics(name?: string, since?: number): MetricPoint[] {
    const cutoff = since || Date.now() - 3600000;
    return this.metrics.filter(m => 
      m.timestamp >= cutoff && (!name || m.name === name)
    );
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.requestMetrics = [];
  }

  /**
   * Export metrics for external storage
   */
  export(): { metrics: MetricPoint[]; requests: RequestMetrics[] } {
    return {
      metrics: [...this.metrics],
      requests: [...this.requestMetrics],
    };
  }
}

// Global metrics collector instance
export const metricsCollector = new MetricsCollector();

/**
 * Helper to measure function execution time
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  tags: Record<string, string> = {}
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    metricsCollector.timing(name, Date.now() - start, { ...tags, success: 'true' });
    return result;
  } catch (error) {
    metricsCollector.timing(name, Date.now() - start, { ...tags, success: 'false' });
    throw error;
  }
}

/**
 * Helper to create request metrics from request/response
 */
export function createRequestMetrics(
  request: Request,
  response: Response,
  startTime: number,
  brandId?: string
): RequestMetrics {
  const url = new URL(request.url);
  return {
    requestId: request.headers.get('cf-ray') || crypto.randomUUID(),
    method: request.method,
    path: url.pathname,
    status: response.status,
    duration: Date.now() - startTime,
    brandId,
    timestamp: Date.now(),
  };
}
