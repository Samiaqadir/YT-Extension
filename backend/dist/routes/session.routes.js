import { Router } from 'express';
import { SessionController } from '../controllers/session.controller.js';
const router = Router();
// Create a new session sharing invitation
router.post('/share', SessionController.createShareInvitation);
// Get invitation public metadata by token
router.get('/invitation/:token', SessionController.getInvitationMetadata);
// Claim invitation (by recipient)
router.post('/claim', SessionController.claimInvitation);
// Revoke active share
router.post('/revoke/:id', SessionController.revokeShareInvitation);
// List active shares
router.get('/active', SessionController.getActiveShares);
// Get audit logs
router.get('/audit-log', SessionController.getAuditLogs);
export default router;
