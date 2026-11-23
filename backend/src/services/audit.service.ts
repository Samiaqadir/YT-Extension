import { db } from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogEntry {
  id?: string;
  invitationId?: string;
  eventType: 'CREATED' | 'CLAIM_ATTEMPT' | 'CLAIMED' | 'REVOKED' | 'EXPIRED' | 'ACCESS_GATEWAY' | 'FAILED_PASSCODE';
  actorId: string;
  domain: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any> | string;
  timestamp?: string;
}

export class AuditService {
  public static async log(entry: AuditLogEntry): Promise<void> {
    const id = entry.id || uuidv4();
    const detailsStr = typeof entry.details === 'object' ? JSON.stringify(entry.details) : (entry.details || null);

    try {
      await db.query(
        `INSERT INTO audit_logs (id, invitation_id, event_type, actor_id, domain, ip_address, user_agent, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          entry.invitationId || null,
          entry.eventType,
          entry.actorId,
          entry.domain,
          entry.ipAddress || '127.0.0.1',
          entry.userAgent || 'FlowExtension/1.0',
          detailsStr,
        ]
      );
    } catch (err) {
      console.error('[AuditService] Failed to record audit log:', err);
    }
  }

  public static async getLogsForOwner(actorId: string, limit: number = 50): Promise<any[]> {
    const res = await db.query(
      `SELECT * FROM audit_logs 
       WHERE actor_id = $1 OR invitation_id IN (SELECT id FROM session_invitations WHERE owner_id = $2)
       ORDER BY timestamp DESC LIMIT $3`,
      [actorId, actorId, limit]
    );
    return res.rows;
  }

  public static async getAllLogs(limit: number = 100): Promise<any[]> {
    const res = await db.query(
      `SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1`,
      [limit]
    );
    return res.rows;
  }
}
