/**
 * Structured Logger for Cloudflare Workers
 * Provides consistent logging with context, levels, and JSON formatting
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  brandId?: string;
  userId?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
  metadata?: Record<string, unknown>;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private context: LogContext;
  private minLevel: LogLevel;
  private startTime: number;

  constructor(context: LogContext = {}, minLevel: LogLevel = 'info') {
    this.context = context;
    this.minLevel = minLevel;
    this.startTime = Date.now();
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    const childLogger = new Logger(
      { ...this.context, ...additionalContext },
      this.minLevel
    );
    childLogger.startTime = this.startTime;
    return childLogger;
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  /**
   * Format and output a log entry
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: Object.keys(this.context).length > 0 ? this.context : undefined,
      duration: Date.now() - this.startTime,
    };

    if (metadata && Object.keys(metadata).length > 0) {
      entry.metadata = metadata;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Output as JSON for structured logging
    const output = JSON.stringify(entry);

    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    const err = error instanceof Error ? error : error ? new Error(String(error)) : undefined;
    this.log('error', message, metadata, err);
  }

  /**
   * Log HTTP request start
   */
  logRequest(request: Request): void {
    const url = new URL(request.url);
    this.info('Request started', {
      method: request.method,
      path: url.pathname,
      query: url.search,
      userAgent: request.headers.get('user-agent') || undefined,
      contentType: request.headers.get('content-type') || undefined,
    });
  }

  /**
   * Log HTTP response
   */
  logResponse(response: Response, startTime: number): void {
    const duration = Date.now() - startTime;
    const level: LogLevel = response.status >= 500 ? 'error' : response.status >= 400 ? 'warn' : 'info';
    
    this.log(level, 'Request completed', {
      status: response.status,
      statusText: response.statusText,
      duration,
    });
  }

  /**
   * Log database query
   */
  logQuery(operation: string, table: string, duration: number, rowCount?: number): void {
    this.debug('Database query', {
      operation,
      table,
      duration,
      rowCount,
    });
  }

  /**
   * Log external API call
   */
  logExternalCall(service: string, endpoint: string, duration: number, success: boolean): void {
    const level = success ? 'debug' : 'warn';
    this.log(level, 'External API call', {
      service,
      endpoint,
      duration,
      success,
    });
  }

  /**
   * Log business event
   */
  logEvent(eventType: string, data: Record<string, unknown>): void {
    this.info('Business event', {
      eventType,
      ...data,
    });
  }

  /**
   * Get elapsed time since logger creation
   */
  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Create a logger from a request with auto-extracted context
 */
export function createRequestLogger(request: Request, env: { LOG_LEVEL?: string }): Logger {
  const url = new URL(request.url);
  const requestId = request.headers.get('cf-ray') || crypto.randomUUID();
  const brandId = request.headers.get('x-brand-id') || undefined;

  const context: LogContext = {
    requestId,
    brandId,
    path: url.pathname,
    method: request.method,
  };

  const minLevel = (env.LOG_LEVEL as LogLevel) || 'info';
  
  return new Logger(context, minLevel);
}

/**
 * Default logger instance for non-request contexts
 */
export const defaultLogger = new Logger({}, 'info');
