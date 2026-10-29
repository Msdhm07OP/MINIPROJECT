import crypto from 'crypto';
import { query } from '../database/config.js';
import logger from '../utils/logger/index.js';

/**
 * Service for managing idempotency keys to prevent duplicate requests
 */
class IdempotencyService {
  /**
   * Check if idempotency key has been used before
   * @param {string} key - Idempotency key
   * @param {object} requestBody - Request payload
   * @returns {Promise<object>} { isDuplicate: boolean, cachedResponse?: object }
   */
  async checkIdempotencyKey(key, requestBody) {
    if (!key) {
      return { isDuplicate: false };
    }

    // Create hash of request body for comparison
    const requestHash = this.hashRequest(requestBody);

    try {
      const result = await query(
        `SELECT * FROM idempotency_records
         WHERE idempotency_key = $1 AND expires_at > NOW()`,
        [key]
      );

      if (result.rows.length === 0) {
        // Key not found or expired - this is a new request
        return { isDuplicate: false };
      }

      const record = result.rows[0];

      // Check if request body matches
      if (record.request_hash === requestHash) {
        // Same request - return cached response
        logger.info('Idempotent request detected', { idempotencyKey: key });
        return {
          isDuplicate: true,
          cachedResponse: record.response_data
        };
      } else {
        // Different request body with same key - reject
        logger.warn('Idempotency key reused with different request', {
          idempotencyKey: key
        });
        throw new Error('Idempotency key already used with different request payload');
      }
    } catch (error) {
      if (error.message.includes('Idempotency key already used')) {
        throw error;
      }
      logger.error('Error checking idempotency key', { error: error.message });
      // On database error, allow request to proceed (fail open)
      return { isDuplicate: false };
    }
  }

  /**
   * Store idempotency result
   * @param {string} key - Idempotency key
   * @param {object} requestBody - Request payload
   * @param {number} bookingId - Created booking ID
   * @param {object} response - Response to cache
   */
  async storeResult(key, requestBody, bookingId, response) {
    if (!key) {
      return;
    }

    const requestHash = this.hashRequest(requestBody);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(process.env.IDEMPOTENCY_KEY_EXPIRY_HOURS || '24'));

    try {
      await query(
        `INSERT INTO idempotency_records
         (idempotency_key, request_hash, booking_id, response_data, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [key, requestHash, bookingId, JSON.stringify(response), expiresAt]
      );

      logger.debug('Stored idempotency result', { idempotencyKey: key, bookingId });
    } catch (error) {
      // Non-critical error - log but don't fail the request
      logger.error('Error storing idempotency result', {
        error: error.message,
        idempotencyKey: key
      });
    }
  }

  /**
   * Create hash of request body
   * @param {object} requestBody
   * @returns {string} SHA-256 hash
   */
  hashRequest(requestBody) {
    const normalized = JSON.stringify(requestBody, Object.keys(requestBody).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Clean up expired idempotency records
   * Should be run periodically (e.g., via cron job)
   */
  async cleanupExpired() {
    try {
      const result = await query(
        'DELETE FROM idempotency_records WHERE expires_at < NOW()'
      );

      logger.info('Cleaned up expired idempotency records', {
        deletedCount: result.rowCount
      });

      return result.rowCount;
    } catch (error) {
      logger.error('Error cleaning up idempotency records', {
        error: error.message
      });
      return 0;
    }
  }
}

export default new IdempotencyService();
