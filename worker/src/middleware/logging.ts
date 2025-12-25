/**
 * Logging Middleware for Cloudflare Workers
 * Automatically logs requests and responses with structured context
 */

import { Logger, createRequestLogger } from '../utils/logger';

export interface Env {
  LOG_LEVEL?: string;
  ENVIRONMENT?: string;
  [key: string]: unknown;
}

export interface RequestContext {
  logger: Logger;
  startTime: number;
}

/**
 * Logging middleware that wraps request handlers
 */
export function withLogging<T extends Env>(
  handler: (request: Request, env: T, ctx: ExecutionContext, logger: Logger) => Promise<Response>
) {
  return async (request: Request, env: T, ctx: ExecutionContext): Promise<Response> => {
    const startTime = Date.now();
    const logger = createRequestLogger(request, env);

    // Log request start
    logger.logRequest(request);

    try {
      // Execute the handler
      const response = await handler(request, env, ctx, logger);

      // Log response
      logger.logResponse(response, startTime);

      // Add timing header in non-production
      if (env.ENVIRONMENT !== 'production') {
        const newHeaders = new Headers(response.headers);
        newHeaders.set('X-Response-Time', `${Date.now() - startTime}ms`);
        newHeaders.set('X-Request-Id', logger['context'].requestId || '');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }

      return response;
    } catch (error) {
      // Log error
      logger.error('Request failed with unhandled error', error);

      // Return error response
      const errorResponse = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId: logger['context'].requestId,
      };

      // Only include stack trace in non-production
      if (env.ENVIRONMENT !== 'production' && error instanceof Error) {
        (errorResponse as Record<string, unknown>).stack = error.stack;
      }

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Response-Time': `${Date.now() - startTime}ms`,
        },
      });
    }
  };
}

/**
 * Create a logging context for use in route handlers
 */
export function createLoggingContext(request: Request, env: Env): RequestContext {
  return {
    logger: createRequestLogger(request, env),
    startTime: Date.now(),
  };
}

/**
 * Log timing for async operations
 */
export async function withTiming<T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logger.debug(`${operation} completed`, { duration: Date.now() - start });
    return result;
  } catch (error) {
    logger.error(`${operation} failed`, error, { duration: Date.now() - start });
    throw error;
  }
}
