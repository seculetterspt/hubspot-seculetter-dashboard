import { Pool } from 'pg';
import { pool } from '../config/database.js';

export interface AuditLogEntry {
  timestamp: Date;
  userEmail: string;
  actionType: string;
  targetId?: string;
  targetType?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Audit logging service for write operations
 */
export class AuditService {
  /**
   * Log a write operation to the audit trail
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO audit_logs
         (timestamp, user_email, action_type, target_id, target_type, status, error_message, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          entry.timestamp,
          entry.userEmail,
          entry.actionType,
          entry.targetId || null,
          entry.targetType || null,
          entry.status,
          entry.errorMessage || null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
        ]
      );
    } catch (error) {
      console.error('Error logging audit entry:', error);
      // Don't throw - audit logging should not break the main operation
    }
  }

  /**
   * Fetch audit logs with filters
   */
  async getLogs(
    userEmail?: string,
    actionType?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (userEmail) {
      query += ` AND user_email = $${paramIndex++}`;
      params.push(userEmail);
    }

    if (actionType) {
      query += ` AND action_type = $${paramIndex++}`;
      params.push(actionType);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    try {
      const result = await pool.query(query, params);
      return result.rows.map(row => ({
        timestamp: row.timestamp,
        userEmail: row.user_email,
        actionType: row.action_type,
        targetId: row.target_id,
        targetType: row.target_type,
        status: row.status,
        errorMessage: row.error_message,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
  }
}

export default new AuditService();
