import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/db.js';
import { TokenService } from '../services/token.service.js';
import { AuditService } from '../services/audit.service.js';
import { notificationService } from '../services/notification.service.js';
export class SessionController {
    /**
     * Create a new temporary encrypted session delegation invitation
     */
    static async createShareInvitation(req, res) {
        try {
            const { domain, delegatedScope = 'read_write', ownerId = 'user_owner_default', ownerLabel = 'User A (Session Owner)', recipientEmail, recipientPasscode, expirationMinutes = 30, encryptedPayload, } = req.body;
            if (!domain || !encryptedPayload) {
                res.status(400).json({ error: 'Domain and encrypted payload are required.' });
                return;
            }
            // Valid expiration windows: 5m, 30m, 60m (1h), 1440m (24h)
            const validMinutes = [5, 30, 60, 1440].includes(Number(expirationMinutes))
                ? Number(expirationMinutes)
                : 30;
            const invitationId = uuidv4();
            const rawToken = TokenService.generateSecureToken(32);
            const tokenHash = TokenService.hashToken(rawToken);
            const expiresAt = new Date(Date.now() + validMinutes * 60 * 1000).toISOString();
            const passcodeHash = recipientPasscode
                ? TokenService.hashPasscode(recipientPasscode)
                : null;
            await db.query(`INSERT INTO session_invitations (
          id, owner_id, owner_label, domain, delegated_scope, 
          recipient_email, recipient_passcode_hash, token_hash, 
          encrypted_payload, status, expires_at, max_uses, use_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10, 1, 0)`, [
                invitationId,
                ownerId,
                ownerLabel,
                domain,
                delegatedScope,
                recipientEmail || null,
                passcodeHash,
                tokenHash,
                encryptedPayload,
                expiresAt,
            ]);
            // Record audit log
            await AuditService.log({
                invitationId,
                eventType: 'CREATED',
                actorId: ownerId,
                domain,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                details: {
                    delegatedScope,
                    recipientEmail: recipientEmail || 'open_invite',
                    expirationMinutes: validMinutes,
                    hasPasscode: !!recipientPasscode,
                },
            });
            const frontendPortal = process.env.FRONTEND_PORTAL_URL || 'http://localhost:4000/portal';
            const shareUrl = `${frontendPortal}#token=${rawToken}`;
            res.status(201).json({
                success: true,
                invitation: {
                    id: invitationId,
                    token: rawToken,
                    tokenHash,
                    domain,
                    delegatedScope,
                    ownerLabel,
                    expiresAt,
                    shareUrl,
                },
            });
        }
        catch (err) {
            console.error('[SessionController] createShareInvitation error:', err);
            res.status(500).json({ error: 'Failed to create session invitation: ' + err.message });
        }
    }
    /**
     * Retrieve invitation metadata by token
     */
    static async getInvitationMetadata(req, res) {
        try {
            const { token } = req.params;
            if (!token) {
                res.status(400).json({ error: 'Token is required' });
                return;
            }
            const tokenHash = TokenService.hashToken(token);
            const result = await db.query(`SELECT * FROM session_invitations WHERE token_hash = $1`, [tokenHash]);
            if (result.rows.length === 0) {
                res.status(404).json({ error: 'Invitation not found or invalid token.' });
                return;
            }
            const invitation = result.rows[0];
            const now = new Date();
            const expiresAt = new Date(invitation.expires_at);
            if (now > expiresAt && invitation.status !== 'expired') {
                await db.query(`UPDATE session_invitations SET status = 'expired' WHERE id = $1`, [invitation.id]);
                invitation.status = 'expired';
            }
            if (invitation.status === 'revoked') {
                res.status(410).json({ error: 'This session invitation was revoked by the owner.' });
                return;
            }
            if (invitation.status === 'expired') {
                res.status(410).json({ error: 'This session invitation has expired.' });
                return;
            }
            if (invitation.use_count >= invitation.max_uses && invitation.status === 'claimed') {
                res.status(410).json({ error: 'This single-use invitation has already been claimed.' });
                return;
            }
            res.json({
                id: invitation.id,
                domain: invitation.domain,
                delegatedScope: invitation.delegated_scope,
                ownerLabel: invitation.owner_label,
                recipientEmail: invitation.recipient_email,
                requiresPasscode: !!invitation.recipient_passcode_hash,
                expiresAt: invitation.expires_at,
                status: invitation.status,
                encryptedPayload: invitation.encrypted_payload,
            });
        }
        catch (err) {
            console.error('[SessionController] getInvitationMetadata error:', err);
            res.status(500).json({ error: 'Failed to retrieve invitation: ' + err.message });
        }
    }
    /**
     * Claim and establish authorized session
     */
    static async claimInvitation(req, res) {
        try {
            const { token, recipientId = 'recipient_user_b', passcode } = req.body;
            if (!token) {
                res.status(400).json({ error: 'Token is required' });
                return;
            }
            const tokenHash = TokenService.hashToken(token);
            const result = await db.query(`SELECT * FROM session_invitations WHERE token_hash = $1`, [tokenHash]);
            if (result.rows.length === 0) {
                res.status(404).json({ error: 'Invalid or non-existent invitation token.' });
                return;
            }
            const invitation = result.rows[0];
            const now = new Date();
            const expiresAt = new Date(invitation.expires_at);
            if (now > expiresAt || invitation.status === 'expired') {
                await db.query(`UPDATE session_invitations SET status = 'expired' WHERE id = $1`, [invitation.id]);
                res.status(410).json({ error: 'Invitation has expired.' });
                return;
            }
            if (invitation.status === 'revoked') {
                res.status(410).json({ error: 'Invitation was revoked by the owner.' });
                return;
            }
            if (invitation.use_count >= invitation.max_uses) {
                res.status(410).json({ error: 'Invitation has already reached maximum uses.' });
                return;
            }
            // Check passcode if required
            if (invitation.recipient_passcode_hash) {
                if (!passcode) {
                    res.status(401).json({ error: 'Recipient passcode is required to claim this session.' });
                    return;
                }
                const validPass = TokenService.verifyPasscode(passcode, invitation.recipient_passcode_hash);
                if (!validPass) {
                    await AuditService.log({
                        invitationId: invitation.id,
                        eventType: 'FAILED_PASSCODE',
                        actorId: recipientId,
                        domain: invitation.domain,
                        ipAddress: req.ip,
                        userAgent: req.headers['user-agent'],
                        details: { reason: 'Incorrect passcode provided.' },
                    });
                    res.status(403).json({ error: 'Incorrect recipient passcode.' });
                    return;
                }
            }
            // Mark as claimed
            const newUseCount = invitation.use_count + 1;
            const claimedAt = new Date().toISOString();
            await db.query(`UPDATE session_invitations 
         SET status = 'claimed', use_count = $1, claimed_at = $2, claimed_by = $3 
         WHERE id = $4`, [newUseCount, claimedAt, recipientId, invitation.id]);
            // Generate authorized delegated session token
            const grantId = uuidv4();
            const expTimestamp = Math.floor(new Date(invitation.expires_at).getTime() / 1000);
            const delegatedJwt = TokenService.issueDelegatedSessionToken({
                grantId,
                invitationId: invitation.id,
                domain: invitation.domain,
                grantorId: invitation.owner_id,
                granteeId: recipientId,
                scope: invitation.delegated_scope,
                exp: expTimestamp,
            });
            // Save delegated grant to DB for gateway verification
            await db.query(`INSERT INTO delegated_session_grants (
          grant_id, invitation_id, domain, grantee_id, delegated_token, scope, is_valid, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)`, [grantId, invitation.id, invitation.domain, recipientId, delegatedJwt, invitation.delegated_scope, invitation.expires_at]);
            // Audit log
            await AuditService.log({
                invitationId: invitation.id,
                eventType: 'CLAIMED',
                actorId: recipientId,
                domain: invitation.domain,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                details: { grantId, scope: invitation.delegated_scope },
            });
            // Notify the owner in real-time
            notificationService.notifyUser(invitation.owner_id, 'INVITATION_CLAIMED', {
                invitationId: invitation.id,
                domain: invitation.domain,
                recipient: recipientId,
                claimedAt,
            });
            res.json({
                success: true,
                grantId,
                domain: invitation.domain,
                scope: invitation.delegated_scope,
                delegatedToken: delegatedJwt,
                expiresAt: invitation.expires_at,
                encryptedPayload: invitation.encrypted_payload,
            });
        }
        catch (err) {
            console.error('[SessionController] claimInvitation error:', err);
            res.status(500).json({ error: 'Failed to claim invitation: ' + err.message });
        }
    }
    /**
     * Revoke an active session invitation immediately
     */
    static async revokeShareInvitation(req, res) {
        try {
            const { id } = req.params;
            const { actorId = 'user_owner_default' } = req.body;
            if (!id) {
                res.status(400).json({ error: 'Invitation ID is required' });
                return;
            }
            const check = await db.query(`SELECT * FROM session_invitations WHERE id = $1`, [id]);
            if (check.rows.length === 0) {
                res.status(404).json({ error: 'Invitation not found' });
                return;
            }
            const invitation = check.rows[0];
            const revokedAt = new Date().toISOString();
            await db.query(`UPDATE session_invitations 
         SET status = 'revoked', revoked_at = $1 
         WHERE id = $2`, [revokedAt, id]);
            // Invalidate all associated delegated grants immediately
            await db.query(`UPDATE delegated_session_grants SET is_valid = FALSE WHERE invitation_id = $1`, [id]);
            // Audit log
            await AuditService.log({
                invitationId: id,
                eventType: 'REVOKED',
                actorId,
                domain: invitation.domain,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                details: { revokedAt },
            });
            // Broadcast revocation notification to connected recipients and gateways
            notificationService.broadcast('SESSION_REVOKED', {
                invitationId: id,
                domain: invitation.domain,
                revokedAt,
            });
            res.json({
                success: true,
                message: 'Session invitation and active grants have been successfully revoked.',
                invitationId: id,
                revokedAt,
            });
        }
        catch (err) {
            console.error('[SessionController] revokeShareInvitation error:', err);
            res.status(500).json({ error: 'Failed to revoke invitation: ' + err.message });
        }
    }
    /**
     * List active shares and recent history for owner
     */
    static async getActiveShares(req, res) {
        try {
            const { ownerId = 'user_owner_default' } = req.query;
            // Update expired statuses first
            await db.query(`UPDATE session_invitations 
         SET status = 'expired' 
         WHERE status = 'active' AND expires_at < $1`, [new Date().toISOString()]);
            const result = await db.query(`SELECT id, owner_id, owner_label, domain, delegated_scope, 
                recipient_email, status, expires_at, created_at, claimed_at, 
                claimed_by, revoked_at, use_count, max_uses
         FROM session_invitations 
         WHERE owner_id = $1 OR $1 = 'all'
         ORDER BY created_at DESC LIMIT 30`, [ownerId]);
            res.json({ shares: result.rows });
        }
        catch (err) {
            console.error('[SessionController] getActiveShares error:', err);
            res.status(500).json({ error: 'Failed to retrieve active shares: ' + err.message });
        }
    }
    /**
     * Get audit log history
     */
    static async getAuditLogs(req, res) {
        try {
            const { ownerId = 'user_owner_default', limit = '50' } = req.query;
            const logs = ownerId === 'all'
                ? await AuditService.getAllLogs(Number(limit))
                : await AuditService.getLogsForOwner(ownerId, Number(limit));
            res.json({ logs });
        }
        catch (err) {
            console.error('[SessionController] getAuditLogs error:', err);
            res.status(500).json({ error: 'Failed to retrieve audit logs: ' + err.message });
        }
    }
}
