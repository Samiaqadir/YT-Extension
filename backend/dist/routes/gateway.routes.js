import { Router } from 'express';
import { GatewayController } from '../controllers/gateway.controller.js';
const router = Router();
// Validate delegated session tokens
router.get('/verify', GatewayController.verifySessionGrant);
router.post('/verify', GatewayController.verifySessionGrant);
export default router;
