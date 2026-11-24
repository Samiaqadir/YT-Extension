import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './config/db.js';
import sessionRoutes from './routes/session.routes.js';
import gatewayRoutes from './routes/gateway.routes.js';
import demoRoutes from './routes/demo.routes.js';
import adminRoutes, { loadLatestManagedSession } from './routes/admin.routes.js';
import authRoutes from './routes/auth.routes.js';
import studioRoutes from './routes/studio.routes.js';
import { notificationService } from './services/notification.service.js';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;
// Middleware
app.use(cors({
    origin: '*', // Allow Chrome extensions, web portal, and admin panel
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Serve static portal, admin, and extension preview assets
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const portalDir = path.resolve(currentDir, '../../demo-portal');
const adminDir = path.resolve(currentDir, '../../admin-panel');
const extensionDir = path.resolve(currentDir, '../../extension/dist');
app.use('/portal', express.static(portalDir));
app.use('/admin', express.static(adminDir));
app.use('/extension', express.static(extensionDir));
// Quick shortcut to extension popup preview
app.get('/popup', (req, res) => {
    res.sendFile(path.join(extensionDir, 'src/popup/index.html'));
});
// SSE Real-Time Notifications
app.get('/api/events/notifications', (req, res) => {
    const userId = req.query.userId || 'user_owner_default';
    const clientId = `${userId}_${Date.now()}`;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId, status: 'listening' })}\n\n`);
    notificationService.addClient(clientId, userId, res);
});
// Routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/gateway', gatewayRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/studio', studioRoutes);
app.use('/demo', demoRoutes);
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Flow Session Share Backend & Gateway',
        database: db.isPostgres ? 'PostgreSQL' : 'SQLite (Local Fallback)',
        timestamp: new Date().toISOString(),
    });
});
// Root route redirect to portal
app.get('/', (req, res) => {
    res.redirect('/portal');
});
// Start Server
async function startServer() {
    try {
        await db.init();
        await loadLatestManagedSession();
        app.listen(PORT, () => {
            console.log(`=======================================================`);
            console.log(`🚀 Flow Session Share Backend & Gateway running at:`);
            console.log(`   - API Base:     http://localhost:${PORT}/api/sessions`);
            console.log(`   - Gateway Auth: http://localhost:${PORT}/api/gateway`);
            console.log(`   - Admin Panel:  http://localhost:${PORT}/admin`);
            console.log(`   - Web Portal:   http://localhost:${PORT}/portal`);
            console.log(`   - Demo Partner: http://localhost:${PORT}/demo/app`);
            console.log(`   - Database:     ${db.isPostgres ? 'PostgreSQL' : 'SQLite Fallback'}`);
            console.log(`=======================================================`);
        });
    }
    catch (err) {
        console.error('Failed to start Flow backend:', err);
        process.exit(1);
    }
}
startServer();
