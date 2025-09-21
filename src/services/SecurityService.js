// src/services/SecurityService.js
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SALT_ROUNDS = 12;
const PEPPER = process.env.PASSWORD_PEPPER || 'WilPOS_Security_2024';

/**
 * Security service for password hashing and verification
 */
export class SecurityService {
  /**
   * Hash a password securely with salt and pepper
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Hashed password
   */
  static async hashPassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    if (password.length < 4) {
      throw new Error('Password must be at least 4 characters long');
    }

    try {
      // Add pepper to password before hashing
      const pepperedPassword = password + PEPPER;
      const hash = await bcrypt.hash(pepperedPassword, SALT_ROUNDS);
      return hash;
    } catch (error) {
      console.error('Password hashing error:', error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify a password against its hash
   * @param {string} password - Plain text password
   * @param {string} hash - Stored password hash
   * @returns {Promise<boolean>} - True if password matches
   */
  static async verifyPassword(password, hash) {
    if (!password || !hash) {
      return false;
    }

    try {
      // Add pepper to password before verification
      const pepperedPassword = password + PEPPER;
      return await bcrypt.compare(pepperedPassword, hash);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Generate a secure random token
   * @param {number} length - Token length in bytes (default: 32)
   * @returns {string} - Random token
   */
  static generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Sanitize input to prevent SQL injection
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
   * Generate session token with expiration
   * @param {string} userId - User ID
   * @param {number} expirationHours - Hours until expiration (default: 8)
   * @returns {Object} - Session object with token and expiration
   */
  static generateSession(userId, expirationHours = 8) {
    const token = this.generateSecureToken();
    const expirationTime = Date.now() + (expirationHours * 60 * 60 * 1000);
    
    return {
      token,
      userId,
      expirationTime,
      createdAt: Date.now()
    };
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
   * Encrypt sensitive data for local storage
   * @param {string} data - Data to encrypt
   * @param {string} key - Encryption key
   * @returns {string} - Encrypted data
   */
  static encrypt(data, key = PEPPER) {
    try {
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, key);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      return null;
    }
  }

  /**
   * Decrypt sensitive data from local storage
   * @param {string} encryptedData - Encrypted data
   * @param {string} key - Decryption key
   * @returns {string} - Decrypted data
   */
  static decrypt(encryptedData, key = PEPPER) {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const algorithm = 'aes-256-gcm';
      const decipher = crypto.createDecipher(algorithm, key);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      return null;
    }
  }

  /**
   * Rate limiting check
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

export default SecurityService;