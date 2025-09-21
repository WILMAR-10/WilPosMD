// src/services/BrowserSecurityService.js
// Browser-safe security utilities (no Node.js dependencies)

/**
 * Browser-safe security service for client-side operations
 * Node.js cryptography is handled in the main process
 */
export class BrowserSecurityService {
  /**
   * Sanitize input to prevent injection attacks
   * @param {string} input - User input
   * @returns {string} - Sanitized input
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') {
      return '';
    }
    
    // Remove potentially dangerous characters
    return input
      .replace(/['"\\;]/g, '') // Remove quotes, backslashes, semicolons
      .trim()
      .substring(0, 255); // Limit length
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} - True if valid email
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate username format
   * @param {string} username - Username to validate
   * @returns {boolean} - True if valid username
   */
  static validateUsername(username) {
    // Username: 3-20 characters, alphanumeric and underscore only
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
  }

  /**
   * Generate session token with expiration (browser-safe)
   * @param {string} userId - User ID
   * @param {number} expirationHours - Hours until expiration (default: 8)
   * @returns {Object} - Session object with token and expiration
   */
  static generateSession(userId, expirationHours = 8) {
    // Simple browser-compatible token generation
    const token = this.generateSimpleToken();
    const expirationTime = Date.now() + (expirationHours * 60 * 60 * 1000);
    
    return {
      token,
      userId,
      expirationTime,
      createdAt: Date.now()
    };
  }

  /**
   * Generate a simple random token (browser-safe)
   * @param {number} length - Token length (default: 32)
   * @returns {string} - Random token
   */
  static generateSimpleToken(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Validate session token
   * @param {Object} session - Session object
   * @returns {boolean} - True if session is valid
   */
  static isValidSession(session) {
    if (!session || !session.token || !session.expirationTime) {
      return false;
    }

    return Date.now() < session.expirationTime;
  }

  /**
   * Simple encryption for browser storage (base64 encoding)
   * Not cryptographically secure - just basic obfuscation
   * @param {string} data - Data to encrypt
   * @returns {string} - Encoded data
   */
  static encrypt(data) {
    try {
      // Simple base64 encoding with basic obfuscation
      const encoded = btoa(encodeURIComponent(data));
      return encoded;
    } catch (error) {
      console.error('Encoding error:', error);
      return null;
    }
  }

  /**
   * Simple decryption for browser storage (base64 decoding)
   * @param {string} encodedData - Encoded data
   * @returns {string} - Decoded data
   */
  static decrypt(encodedData) {
    try {
      const decoded = decodeURIComponent(atob(encodedData));
      return decoded;
    } catch (error) {
      console.error('Decoding error:', error);
      return null;
    }
  }

  /**
   * Rate limiting check (browser-safe using localStorage)
   * @param {string} key - Identifier for rate limiting
   * @param {number} maxAttempts - Maximum attempts allowed
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Object} - Rate limit status
   */
  static checkRateLimit(key, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    const now = Date.now();
    const attempts = JSON.parse(localStorage.getItem(`rateLimit_${key}`) || '[]');
    
    // Remove old attempts outside the window
    const validAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
    
    if (validAttempts.length >= maxAttempts) {
      return {
        allowed: false,
        resetTime: Math.min(...validAttempts) + windowMs,
        attemptsRemaining: 0
      };
    }

    // Add current attempt
    validAttempts.push(now);
    localStorage.setItem(`rateLimit_${key}`, JSON.stringify(validAttempts));

    return {
      allowed: true,
      attemptsRemaining: maxAttempts - validAttempts.length,
      resetTime: null
    };
  }
}

export default BrowserSecurityService;