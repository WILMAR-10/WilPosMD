// src/services/LoggingService.js
import { app } from 'electron';
import fs from 'fs-extra';
import { join } from 'path';

/**
 * Centralized logging service for WilPOS
 * Provides secure logging with rotation and filtering
 */
export class LoggingService {
  constructor() {
    this.logDir = null;
    this.currentLogFile = null;
    this.initialized = false;
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = 5;
    this.sensitiveFields = ['password', 'clave', 'token', 'authorization', 'secret'];
  }

  /**
   * Initialize logging service
   */
  async initialize() {
    try {
      this.logDir = join(app.getPath('userData'), 'logs');
      await fs.ensureDir(this.logDir);
      
      const today = new Date().toISOString().split('T')[0];
      this.currentLogFile = join(this.logDir, `wilpos-${today}.log`);
      
      this.initialized = true;
      this.info('LoggingService', 'Logging service initialized');
      
      // Clean old log files
      await this.rotateOldLogs();
    } catch (error) {
      console.error('Failed to initialize logging service:', error);
    }
  }

  /**
   * Sanitize log data to remove sensitive information
   */
  sanitizeLogData(data) {
    if (!data) return data;

    if (typeof data === 'string') {
      return data;
    }

    if (typeof data === 'object') {
      const sanitized = Array.isArray(data) ? [] : {};
      
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        
        if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeLogData(value);
        } else {
          sanitized[key] = value;
        }
      }
      
      return sanitized;
    }

    return data;
  }

  /**
   * Format log entry
   */
  formatLogEntry(level, component, message, data = null) {
    const timestamp = new Date().toISOString();
    const sanitizedData = data ? this.sanitizeLogData(data) : null;
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      component,
      message,
      ...(sanitizedData && { data: sanitizedData }),
      pid: process.pid
    };

    return JSON.stringify(logEntry) + '\n';
  }

  /**
   * Write log entry to file
   */
  async writeLog(level, component, message, data = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const logEntry = this.formatLogEntry(level, component, message, data);
      
      // Check file size and rotate if needed
      await this.checkAndRotateLog();
      
      await fs.appendFile(this.currentLogFile, logEntry);
      
      // Also log to console in development
      if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        const consoleMessage = `[${level.toUpperCase()}] ${component}: ${message}`;
        
        switch (level.toLowerCase()) {
          case 'error':
            console.error(consoleMessage, data ? this.sanitizeLogData(data) : '');
            break;
          case 'warn':
            console.warn(consoleMessage, data ? this.sanitizeLogData(data) : '');
            break;
          case 'info':
            console.info(consoleMessage, data ? this.sanitizeLogData(data) : '');
            break;
          default:
            console.log(consoleMessage, data ? this.sanitizeLogData(data) : '');
        }
      }
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  /**
   * Check log file size and rotate if needed
   */
  async checkAndRotateLog() {
    try {
      const stats = await fs.stat(this.currentLogFile);
      
      if (stats.size > this.maxLogSize) {
        await this.rotateCurrentLog();
      }
    } catch (error) {
      // File doesn't exist yet, which is fine
      if (error.code !== 'ENOENT') {
        console.error('Error checking log file size:', error);
      }
    }
  }

  /**
   * Rotate current log file
   */
  async rotateCurrentLog() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = this.currentLogFile.replace('.log', `-${timestamp}.log`);
      
      await fs.move(this.currentLogFile, rotatedFile);
      
      // Clean old log files
      await this.rotateOldLogs();
    } catch (error) {
      console.error('Error rotating log file:', error);
    }
  }

  /**
   * Clean old log files (keep only maxLogFiles)
   */
  async rotateOldLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files
        .filter(file => file.startsWith('wilpos-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: join(this.logDir, file),
          time: fs.statSync(join(this.logDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      // Remove old files (keep only maxLogFiles newest)
      for (let i = this.maxLogFiles; i < logFiles.length; i++) {
        await fs.remove(logFiles[i].path);
      }
    } catch (error) {
      console.error('Error rotating old logs:', error);
    }
  }

  /**
   * Log error message
   */
  async error(component, message, data = null) {
    await this.writeLog('error', component, message, data);
  }

  /**
   * Log warning message
   */
  async warn(component, message, data = null) {
    await this.writeLog('warn', component, message, data);
  }

  /**
   * Log info message
   */
  async info(component, message, data = null) {
    await this.writeLog('info', component, message, data);
  }

  /**
   * Log debug message (only in development)
   */
  async debug(component, message, data = null) {
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
      await this.writeLog('debug', component, message, data);
    }
  }

  /**
   * Log database operation
   */
  async database(operation, details = null) {
    await this.writeLog('info', 'DATABASE', `Operation: ${operation}`, details);
  }

  /**
   * Log authentication event
   */
  async auth(event, details = null) {
    await this.writeLog('info', 'AUTH', `Event: ${event}`, details);
  }

  /**
   * Log printer operation
   */
  async printer(operation, details = null) {
    await this.writeLog('info', 'PRINTER', `Operation: ${operation}`, details);
  }

  /**
   * Log sales transaction
   */
  async sales(operation, details = null) {
    await this.writeLog('info', 'SALES', `Operation: ${operation}`, details);
  }

  /**
   * Log security event
   */
  async security(event, details = null) {
    await this.writeLog('warn', 'SECURITY', `Event: ${event}`, details);
  }

  /**
   * Log performance metrics
   */
  async performance(metric, value, details = null) {
    await this.writeLog('info', 'PERFORMANCE', `${metric}: ${value}`, details);
  }

  /**
   * Get recent logs (for debugging/admin interface)
   */
  async getRecentLogs(limit = 100) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const logData = await fs.readFile(this.currentLogFile, 'utf8');
      const lines = logData.trim().split('\n');
      
      return lines
        .slice(-limit)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { message: line, level: 'UNKNOWN' };
          }
        })
        .reverse();
    } catch (error) {
      console.error('Error reading logs:', error);
      return [];
    }
  }

  /**
   * Search logs by criteria
   */
  async searchLogs(criteria = {}) {
    const { level, component, startDate, endDate, limit = 100 } = criteria;
    
    try {
      const logs = await this.getRecentLogs(1000); // Get more logs for searching
      
      let filteredLogs = logs.filter(log => {
        if (level && log.level !== level.toUpperCase()) return false;
        if (component && log.component !== component) return false;
        
        if (startDate) {
          const logDate = new Date(log.timestamp);
          if (logDate < new Date(startDate)) return false;
        }
        
        if (endDate) {
          const logDate = new Date(log.timestamp);
          if (logDate > new Date(endDate)) return false;
        }
        
        return true;
      });
      
      return filteredLogs.slice(0, limit);
    } catch (error) {
      console.error('Error searching logs:', error);
      return [];
    }
  }

  /**
   * Clear all logs (admin function)
   */
  async clearLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.startsWith('wilpos-') && file.endsWith('.log'));
      
      for (const file of logFiles) {
        await fs.remove(join(this.logDir, file));
      }
      
      await this.info('LoggingService', 'All logs cleared');
    } catch (error) {
      console.error('Error clearing logs:', error);
    }
  }
}

// Create singleton instance
const logger = new LoggingService();

export default logger;