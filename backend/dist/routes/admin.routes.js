import { Router } from 'express';
import { db } from '../config/db.js';
import { TokenService } from '../services/token.service.js';
import { AuditService } from '../services/audit.service.js';
import { notificationService } from '../services/notification.service.js';
import { v4 as uuidv4 } from 'uuid';
const router = Router();
// Global default managed domain session (configured for Official Flow Video Studio)
export let currentManagedSession = {
    domain: 'flow.google.com',
    targetUrl: 'https://flow.google.com',
    cookieName: 'flow_session',
    sessionToken: '',
    scope: 'read_write',
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    updatedBy: 'System Administrator',
    grantId: 'admin_initial_grant',
};
// Generate initial valid token on startup
function initializeAdminSession() {
    const grantId = uuidv4();
    const token = TokenService.issueDelegatedSessionToken({
        grantId,
        invitationId: 'admin_central_invitation',
        domain: currentManagedSession.domain,
        grantorId: 'admin_portal',
        granteeId: 'central_shared_user',
        scope: 'read_write',
        exp: Math.floor(Date.now() / 1000) + 86400,
    });
    currentManagedSession.sessionToken = token;
    currentManagedSession.grantId = grantId;
}
initializeAdminSession();
// Restores the most recently deployed active session from the database
export async function loadLatestManagedSession() {
    try {
        const res = await db.query(`SELECT * FROM delegated_session_grants 
       WHERE is_valid = 1 
       ORDER BY created_at DESC LIMIT 1`);
        if (res.rows && res.rows.length > 0) {
            const grant = res.rows[0];
            if (grant.delegated_token) {
                currentManagedSession.sessionToken = grant.delegated_token;
                currentManagedSession.domain = grant.domain || 'flow.google.com';
                currentManagedSession.grantId = grant.grant_id;
                currentManagedSession.scope = grant.scope || 'read_write';
                if (grant.expires_at)
                    currentManagedSession.expiresAt = grant.expires_at;
                if (grant.created_at)
                    currentManagedSession.updatedAt = grant.created_at;
                currentManagedSession.updatedBy = 'Admin Console (Restored from DB)';
                console.log(`[Admin] Successfully restored active session for ${currentManagedSession.domain} from database.`);
            }
        }
    }
    catch (err) {
        console.warn('[Admin] Could not restore latest session from DB:', err.message);
    }
}
/**
 * GET /api/admin/config
 */
router.get('/config', async (req, res) => {
    if (!currentManagedSession.sessionToken) {
        await loadLatestManagedSession();
    }
    res.json({
        success: true,
        managedSession: {
            domain: currentManagedSession.domain,
            targetUrl: currentManagedSession.targetUrl,
            cookieName: currentManagedSession.cookieName,
            scope: currentManagedSession.scope,
            updatedAt: currentManagedSession.updatedAt,
            expiresAt: currentManagedSession.expiresAt,
            updatedBy: currentManagedSession.updatedBy,
            hasActiveToken: !!currentManagedSession.sessionToken,
            tokenPreview: currentManagedSession.sessionToken ? currentManagedSession.sessionToken.substring(0, 24) + '...' : 'None',
            fullToken: currentManagedSession.sessionToken,
        },
    });
});
/**
 * POST /api/admin/session
 * Update session cookie & target URL through which all users access the account
 */
router.post('/session', async (req, res) => {
    try {
        let { domain, targetUrl = 'https://flow.google.com', cookieName = 'flow_session', sessionToken, scope = 'read_write', expirationHours = 24, } = req.body;
        if (!domain || domain.trim() === '') {
            try {
                domain = new URL(targetUrl.startsWith('http') ? targetUrl : 'https://' + targetUrl).hostname;
            }
            catch {
                domain = 'flow.google.com';
            }
        }
        const grantId = uuidv4();
        const expiresAt = new Date(Date.now() + Number(expirationHours) * 60 * 60 * 1000).toISOString();
        const finalToken = sessionToken && sessionToken.trim() !== ''
            ? sessionToken.trim()
            : TokenService.issueDelegatedSessionToken({
                grantId,
                invitationId: 'admin_central_' + Date.now(),
                domain: domain.trim(),
                grantorId: 'admin_portal',
                granteeId: 'central_shared_user',
                scope,
                exp: Math.floor(Date.now() / 1000) + Number(expirationHours) * 3600,
            });
        currentManagedSession = {
            domain: domain.trim(),
            targetUrl: targetUrl.trim(),
            cookieName: cookieName.trim() || 'flow_session',
            sessionToken: finalToken,
            scope,
            updatedAt: new Date().toISOString(),
            expiresAt,
            updatedBy: 'Admin Console',
            grantId,
        };
        const tokenHash = TokenService.hashToken(finalToken.substring(0, 32));
        await db.query(`INSERT INTO session_invitations (
        id, owner_id, owner_label, domain, delegated_scope, 
        token_hash, encrypted_payload, status, expires_at, max_uses, use_count
      ) VALUES ($1, 'admin', 'Administrator Central Vault', $2, $3, $4, '{}', 'active', $5, 999999, 0)
      ON CONFLICT (id) DO NOTHING`, [grantId, domain.trim(), scope, tokenHash, expiresAt]).catch(() => { });
        await db.query(`INSERT INTO delegated_session_grants (
        grant_id, invitation_id, domain, grantee_id, delegated_token, scope, is_valid, expires_at
      ) VALUES ($1, $2, $3, 'all_users', $4, $5, TRUE, $6)`, [grantId, grantId, domain.trim(), finalToken, scope, expiresAt]);
        await AuditService.log({
            invitationId: grantId,
            eventType: 'CREATED',
            actorId: 'admin_console',
            domain: domain.trim(),
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: { action: 'ADMIN_SESSION_UPDATED', cookieName, targetUrl, scope, expirationHours },
        });
        notificationService.broadcast('ADMIN_SESSION_UPDATED', {
            domain: currentManagedSession.domain,
            targetUrl: currentManagedSession.targetUrl,
            cookieName: currentManagedSession.cookieName,
            scope: currentManagedSession.scope,
            expiresAt: currentManagedSession.expiresAt,
            updatedAt: currentManagedSession.updatedAt,
        });
        res.json({
            success: true,
            message: 'Centralized session credentials successfully updated and deployed to all users.',
            managedSession: currentManagedSession,
        });
    }
    catch (err) {
        console.error('[Admin] Failed to update session:', err);
        res.status(500).json({ error: 'Failed to update session: ' + err.message });
    }
});
/**
 * USER MANAGEMENT ENDPOINTS
 */
// GET /api/admin/users
router.get('/users', async (req, res) => {
    try {
        const result = await db.query(`SELECT id, username, role, status, created_at, last_login_at 
       FROM managed_users 
       ORDER BY created_at DESC`);
        res.json({ users: result.rows });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to retrieve users: ' + err.message });
    }
});
// POST /api/admin/users
router.post('/users', async (req, res) => {
    try {
        const { username, password, role = 'creator' } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username/Email and Password are required.' });
            return;
        }
        const cleanUser = username.trim().toLowerCase();
        const existing = await db.query(`SELECT id FROM managed_users WHERE LOWER(username) = $1`, [cleanUser]);
        if (existing.rows.length > 0) {
            res.status(409).json({ error: 'A user with this username already exists.' });
            return;
        }
        const id = uuidv4();
        const passwordHash = TokenService.hashPasscode(password.trim());
        await db.query(`INSERT INTO managed_users (id, username, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'active')`, [id, cleanUser, passwordHash, role]);
        await AuditService.log({
            eventType: 'CREATED',
            actorId: 'admin_console',
            domain: 'users',
            details: { action: 'CREATED_MANAGED_USER', username: cleanUser, role },
        });
        res.status(201).json({
            success: true,
            message: `User ${cleanUser} created successfully.`,
            user: { id, username: cleanUser, role, status: 'active' },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create user: ' + err.message });
    }
});
// POST /api/admin/users/:id/toggle
router.post('/users/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        const userRes = await db.query(`SELECT * FROM managed_users WHERE id = $1`, [id]);
        if (userRes.rows.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        const currentStatus = userRes.rows[0].status;
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        await db.query(`UPDATE managed_users SET status = $1 WHERE id = $2`, [newStatus, id]);
        res.json({ success: true, status: newStatus });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to toggle user status: ' + err.message });
    }
});
// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query(`DELETE FROM managed_users WHERE id = $1`, [id]);
        res.json({ success: true, message: 'User deleted successfully.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete user: ' + err.message });
    }
});
/**
 * POST /api/admin/revoke-all
 */
router.post('/revoke-all', async (req, res) => {
    try {
        const { domain = 'localhost:4000' } = req.body;
        await db.query(`UPDATE delegated_session_grants SET is_valid = FALSE WHERE domain = $1 OR $1 = 'all'`, [domain]);
        await db.query(`UPDATE session_invitations SET status = 'revoked', revoked_at = $1 WHERE domain = $2 OR $2 = 'all'`, [new Date().toISOString(), domain]);
        currentManagedSession.sessionToken = '';
        await AuditService.log({
            eventType: 'REVOKED',
            actorId: 'admin_console',
            domain,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: { action: 'ADMIN_EMERGENCY_REVOKE_ALL' },
        });
        notificationService.broadcast('SESSION_REVOKED', {
            domain,
            revokedAt: new Date().toISOString(),
            reason: 'Administrator revoked all active domain sessions.',
        });
        res.json({
            success: true,
            message: `All active sessions for ${domain} have been immediately terminated.`,
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to revoke sessions: ' + err.message });
    }
});
/**
 * GET /api/admin/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const invCount = await db.query(`SELECT COUNT(*) as count FROM session_invitations`);
        const activeGrants = await db.query(`SELECT COUNT(*) as count FROM delegated_session_grants WHERE is_valid = TRUE`);
        const userCount = await db.query(`SELECT COUNT(*) as count FROM managed_users`);
        const auditCount = await db.query(`SELECT COUNT(*) as count FROM audit_logs`);
        const recentLogs = await db.query(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 15`);
        res.json({
            totalInvitations: Number(invCount.rows[0]?.count || 0),
            activeSessionGrants: Number(activeGrants.rows[0]?.count || 0),
            totalUsers: Number(userCount.rows[0]?.count || 0),
            totalAuditLogs: Number(auditCount.rows[0]?.count || 0),
            recentLogs: recentLogs.rows || [],
            managedSession: {
                domain: currentManagedSession.domain,
                targetUrl: currentManagedSession.targetUrl,
                cookieName: currentManagedSession.cookieName,
                scope: currentManagedSession.scope,
                expiresAt: currentManagedSession.expiresAt,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch admin stats: ' + err.message });
    }
});
export default router;
