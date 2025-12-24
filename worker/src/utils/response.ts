/**
 * Response utilities for Cloudflare Worker
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * Create a CORS preflight response
 */
export function cors(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

/**
 * Create an error response
 */
export function errorResponse(message: string, status: number = 400): Response {
  return jsonResponse({ error: message, success: false }, status);
}

/**
 * Handle errors and return appropriate response
 */
export function errorHandler(error: unknown): Response {
  console.error('API Error:', error);
  
  if (error instanceof Error) {
    // Don't expose internal error details in production
    const message = process.env.ENVIRONMENT === 'production' 
      ? 'Internal server error' 
      : error.message;
    return errorResponse(message, 500);
  }
  
  return errorResponse('An unexpected error occurred', 500);
}

/**
 * Create a streaming SSE response
 */
export function streamResponse(readable: ReadableStream): Response {
  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...CORS_HEADERS,
    },
  });
}
