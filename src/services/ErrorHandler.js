// src/services/ErrorHandler.js
import logger from './LoggingService.js';
import { app, dialog } from 'electron';

/**
 * Custom error classes for different types of errors
 */
export class WilPOSError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', context = null) {
    super(message);
    this.name = 'WilPOSError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

export class DatabaseError extends WilPOSError {
  constructor(message, operation = null, context = null) {
    super(message, 'DATABASE_ERROR', context);
    this.name = 'DatabaseError';
    this.operation = operation;
  }
}

export class AuthenticationError extends WilPOSError {
  constructor(message, context = null) {
    super(message, 'AUTH_ERROR', context);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends WilPOSError {
  constructor(message, field = null, value = null) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

export class PrinterError extends WilPOSError {
  constructor(message, printerName = null, context = null) {
    super(message, 'PRINTER_ERROR', context);
    this.name = 'PrinterError';
    this.printerName = printerName;
  }
}

export class NetworkError extends WilPOSError {
  constructor(message, endpoint = null, context = null) {
    super(message, 'NETWORK_ERROR', context);
    this.name = 'NetworkError';
    this.endpoint = endpoint;
  }
}

export class BusinessLogicError extends WilPOSError {
  constructor(message, operation = null, context = null) {
    super(message, 'BUSINESS_ERROR', context);
    this.name = 'BusinessLogicError';
    this.operation = operation;
  }
}

/**
 * Centralized error handler service
 */
export class ErrorHandler {
  constructor() {
    this.errorCounts = new Map();
    this.maxErrorsPerHour = 100;
    this.setupGlobalErrorHandlers();
  }

  /**
   * Setup global error handlers
   */
  setupGlobalErrorHandlers() {
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.handleUnhandledError('unhandledRejection', reason, { promise });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.handleUnhandledError('uncaughtException', error);
      
      // In production, we might want to restart the app
      if (app.isPackaged) {
        this.showCriticalErrorDialog(error);
        app.quit();
      }
    });

    // Handle Electron renderer process crashes
    if (app) {
      app.on('render-process-gone', (event, webContents, details) => {
        this.handleUnhandledError('renderProcessGone', new Error('Render process crashed'), {
          reason: details.reason,
          exitCode: details.exitCode
        });
      });

      app.on('child-process-gone', (event, details) => {
        this.handleUnhandledError('childProcessGone', new Error('Child process crashed'), {
          type: details.type,
          reason: details.reason,
          exitCode: details.exitCode
        });
      });
    }
  }

  /**
   * Handle specific error types with appropriate logging and user notification
   */
  async handleError(error, context = null) {
    try {
      // Determine error type and handle accordingly
      if (error instanceof DatabaseError) {
        return await this.handleDatabaseError(error, context);
      } else if (error instanceof AuthenticationError) {
        return await this.handleAuthError(error, context);
      } else if (error instanceof ValidationError) {
        return await this.handleValidationError(error, context);
      } else if (error instanceof PrinterError) {
        return await this.handlePrinterError(error, context);
      } else if (error instanceof NetworkError) {
        return await this.handleNetworkError(error, context);
      } else if (error instanceof BusinessLogicError) {
        return await this.handleBusinessError(error, context);
      } else {
        return await this.handleGenericError(error, context);
      }
    } catch (handlingError) {
      // If error handling itself fails, log to console and continue
      console.error('Error handler failed:', handlingError);
      await logger.error('ErrorHandler', 'Error handler failed', {
        originalError: this.serializeError(error),
        handlingError: this.serializeError(handlingError)
      });

      return {
        success: false,
        error: 'Error interno del sistema',
        code: 'ERROR_HANDLER_FAILURE'
      };
    }
  }

  /**
   * Handle database errors
   */
  async handleDatabaseError(error, context) {
    await logger.error('Database', error.message, {
      operation: error.operation,
      context,
      stack: error.stack
    });

    // Check if database is locked or corrupted
    if (error.message.includes('database is locked')) {
      return {
        success: false,
        error: 'La base de datos está ocupada. Por favor, intente nuevamente.',
        code: 'DATABASE_LOCKED',
        retry: true
      };
    }

    if (error.message.includes('database disk image is malformed')) {
      return {
        success: false,
        error: 'Error en la base de datos. Contacte al soporte técnico.',
        code: 'DATABASE_CORRUPTED',
        critical: true
      };
    }

    return {
      success: false,
      error: 'Error en la base de datos',
      code: error.code,
      details: process.env.NODE_ENV === 'development' ? error.message : null
    };
  }

  /**
   * Handle authentication errors
   */
  async handleAuthError(error, context) {
    await logger.security('Authentication error', {
      message: error.message,
      context,
      userAgent: context?.userAgent,
      ip: context?.ip
    });

    return {
      success: false,
      error: error.message,
      code: error.code,
      requiresLogin: true
    };
  }

  /**
   * Handle validation errors
   */
  async handleValidationError(error, context) {
    await logger.warn('Validation', error.message, {
      field: error.field,
      value: error.value,
      context
    });

    return {
      success: false,
      error: error.message,
      code: error.code,
      field: error.field,
      validation: true
    };
  }

  /**
   * Handle printer errors
   */
  async handlePrinterError(error, context) {
    await logger.printer('Printer error', {
      message: error.message,
      printerName: error.printerName,
      context
    });

    return {
      success: false,
      error: `Error de impresión: ${error.message}`,
      code: error.code,
      printerName: error.printerName,
      retry: true
    };
  }

  /**
   * Handle network errors
   */
  async handleNetworkError(error, context) {
    await logger.warn('Network', error.message, {
      endpoint: error.endpoint,
      context
    });

    return {
      success: false,
      error: 'Error de conexión. Verifique su conexión a internet.',
      code: error.code,
      retry: true
    };
  }

  /**
   * Handle business logic errors
   */
  async handleBusinessError(error, context) {
    await logger.warn('Business', error.message, {
      operation: error.operation,
      context
    });

    return {
      success: false,
      error: error.message,
      code: error.code,
      business: true
    };
  }

  /**
   * Handle generic errors
   */
  async handleGenericError(error, context) {
    await logger.error('System', error.message || 'Unknown error', {
      context,
      stack: error.stack,
      name: error.name
    });

    return {
      success: false,
      error: 'Error interno del sistema',
      code: 'SYSTEM_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    };
  }

  /**
   * Handle unhandled errors (crashes, etc.)
   */
  async handleUnhandledError(type, error, details = null) {
    const errorInfo = {
      type,
      message: error?.message || String(error),
      stack: error?.stack,
      details,
      timestamp: new Date().toISOString()
    };

    await logger.error('UnhandledError', `${type}: ${errorInfo.message}`, errorInfo);

    // Track error frequency
    this.trackErrorFrequency(type);

    // Send crash report in production (if implemented)
    if (app.isPackaged) {
      await this.sendCrashReport(errorInfo);
    }
  }

  /**
   * Track error frequency to detect issues
   */
  trackErrorFrequency(errorType) {
    const now = Date.now();
    const hourKey = Math.floor(now / (60 * 60 * 1000));
    const key = `${errorType}_${hourKey}`;

    const count = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, count + 1);

    // Clean old entries
    for (const [k] of this.errorCounts) {
      const keyHour = parseInt(k.split('_').pop());
      if (keyHour < hourKey - 24) { // Keep 24 hours of data
        this.errorCounts.delete(k);
      }
    }

    // Alert if too many errors
    if (count > this.maxErrorsPerHour) {
      logger.security('High error frequency detected', {
        errorType,
        count,
        threshold: this.maxErrorsPerHour
      });
    }
  }

  /**
   * Send crash report (placeholder for implementation)
   */
  async sendCrashReport(errorInfo) {
    try {
      // In a real implementation, you might send this to a crash reporting service
      // like Sentry, Bugsnag, or your own endpoint
      await logger.error('CrashReport', 'Crash report generated', {
        ...errorInfo,
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch
      });
    } catch (error) {
      console.error('Failed to send crash report:', error);
    }
  }

  /**
   * Show critical error dialog to user
   */
  async showCriticalErrorDialog(error) {
    if (dialog && app) {
      try {
        await dialog.showErrorBox(
          'Error Crítico - WilPOS',
          `La aplicación ha encontrado un error crítico y debe cerrarse.\n\n` +
          `Error: ${error.message}\n\n` +
          `Por favor, reinicie la aplicación. Si el problema persiste, contacte al soporte técnico.`
        );
      } catch (dialogError) {
        console.error('Failed to show error dialog:', dialogError);
      }
    }
  }

  /**
   * Create safe wrapper for async functions
   */
  wrap(fn, context = null) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        return await this.handleError(error, context);
      }
    };
  }

  /**
   * Create safe wrapper for IPC handlers
   */
  wrapIPC(handler, channel) {
    return async (event, ...args) => {
      try {
        return await handler(event, ...args);
      } catch (error) {
        return await this.handleError(error, { channel, args: this.sanitizeArgs(args) });
      }
    };
  }

  /**
   * Serialize error object for logging
   */
  serializeError(error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      ...error
    };
  }

  /**
   * Sanitize arguments for logging (remove sensitive data)
   */
  sanitizeArgs(args) {
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        const sanitized = { ...arg };
        ['password', 'clave', 'token', 'authorization'].forEach(key => {
          if (key in sanitized) {
            sanitized[key] = '[REDACTED]';
          }
        });
        return sanitized;
      }
      return arg;
    });
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {};
    const now = Date.now();
    const currentHour = Math.floor(now / (60 * 60 * 1000));

    for (const [key, count] of this.errorCounts) {
      const [type, hour] = key.split('_');
      const hoursAgo = currentHour - parseInt(hour);

      if (!stats[type]) {
        stats[type] = { total: 0, recent: 0 };
      }

      stats[type].total += count;
      if (hoursAgo <= 1) { // Last hour
        stats[type].recent += count;
      }
    }

    return stats;
  }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

export default errorHandler;