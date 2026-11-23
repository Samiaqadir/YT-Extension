import { db } from '../config/db.js';
import { TokenService } from '../services/token.service.js';
import { AuditService } from '../services/audit.service.js';
export class GatewayController {
    /**
     * Verify delegated session token for a target domain.
     * Can be queried by website backends, reverse proxies, or Chrome extension background worker.
     */
    static async verifySessionGrant(req, res) {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader?.startsWith('Bearer ')
                ? authHeader.substring(7)
                : req.query.token;
            if (!token) {
                res.status(401).json({ valid: false, error: 'Missing delegated authorization token.' });
                return;
            }
            const decoded = TokenService.verifyDelegatedSessionToken(token);
            if (!decoded) {
                res.status(401).json({ valid: false, error: 'Invalid or expired JWT signature.' });
                return;
            }
            // Check DB for revocation and active status
            const grantRes = await db.query(`SELECT g.*, i.status as invitation_status 
         FROM delegated_session_grants g
         JOIN session_invitations i ON g.invitation_id = i.id
         WHERE g.grant_id = $1`, [decoded.grantId]);
            if (grantRes.rows.length === 0) {
                res.status(403).json({ valid: false, error: 'Session grant not found.' });
                return;
            }
            const grant = grantRes.rows[0];
            if (!grant.is_valid || grant.invitation_status === 'revoked') {
                res.status(403).json({
                    valid: false,
                    error: 'Access Revoked: The owner has revoked this shared session.',
                    revoked: true,
                });
                return;
            }
            const now = new Date();
            if (now > new Date(grant.expires_at)) {
                res.status(403).json({
                    valid: false,
                    error: 'Access Expired: This delegated session has expired.',
                    expired: true,
                });
                return;
            }
            // Log access audit
            await AuditService.log({
                invitationId: grant.invitation_id,
                eventType: 'ACCESS_GATEWAY',
                actorId: grant.grantee_id,
                domain: grant.domain,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                details: { grantId: grant.grant_id, scope: grant.scope },
            });
            res.json({
                valid: true,
                grant: {
                    grantId: grant.grant_id,
                    domain: grant.domain,
                    granteeId: grant.grantee_id,
                    scope: grant.scope,
                    expiresAt: grant.expires_at,
                },
            });
        }
        catch (err) {
            console.error('[GatewayController] verifySessionGrant error:', err);
            res.status(500).json({ valid: false, error: 'Internal gateway verification error: ' + err.message });
        }
    }
}
