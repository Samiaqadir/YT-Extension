import { Router } from 'express';
import { db } from '../config/db.js';
import { TokenService } from '../services/token.service.js';
import { AuditService } from '../services/audit.service.js';
import { currentManagedSession } from './admin.routes.js';
const router = Router();
/**
 * POST /api/auth/login
 * User logs in from the Chrome Extension using credentials created in Admin Panel
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            res.status(400).json({ error: 'Username/Email and password are required.' });
            return;
        }
        const cleanUser = username.trim().toLowerCase();
        // Query user
        const userRes = await db.query(`SELECT * FROM managed_users WHERE LOWER(username) = $1`, [cleanUser]);
        if (userRes.rows.length === 0) {
            res.status(401).json({ error: 'Invalid username or password.' });
            return;
        }
        const user = userRes.rows[0];
        // Check status
        if (user.status !== 'active') {
            res.status(403).json({ error: 'Your account has been suspended by the administrator.' });
            return;
        }
        // Verify password hash
        const isValid = TokenService.verifyPasscode(password, user.password_hash);
        if (!isValid) {
            await AuditService.log({
                eventType: 'FAILED_PASSCODE',
                actorId: cleanUser,
                domain: 'localhost:4000/studio',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                details: { reason: 'Incorrect password entered in extension' },
            });
            res.status(401).json({ error: 'Invalid username or password.' });
            return;
        }
        // Update last login
        const loginTime = new Date().toISOString();
        await db.query(`UPDATE managed_users SET last_login_at = $1 WHERE id = $2`, [loginTime, user.id]);
        // Audit log
        await AuditService.log({
            eventType: 'ACCESS_GATEWAY',
            actorId: user.username,
            domain: 'localhost:4000/studio',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            details: { action: 'EXTENSION_USER_LOGIN_SUCCESS' },
        });
        // Provide the active shared session & cookie configuration managed by admin
        const activeToken = currentManagedSession.sessionToken;
        const targetUrl = currentManagedSession.targetUrl || 'https://flow.google.com';
        const cookieName = currentManagedSession.cookieName || 'flow_session';
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
            },
            session: {
                token: activeToken,
                cookieName,
                targetUrl,
                domain: currentManagedSession.domain || 'flow.google.com',
                scope: currentManagedSession.scope,
                expiresAt: currentManagedSession.expiresAt,
                studioUrl: targetUrl,
            },
        });
    }
    catch (err) {
        console.error('[Auth] Login error:', err);
        res.status(500).json({ error: 'Internal login error: ' + err.message });
    }
});
export default router;
