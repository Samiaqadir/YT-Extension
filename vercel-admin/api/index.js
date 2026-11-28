import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'flow-session-share-super-secret-key-2026';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- In-Memory State for Serverless Execution ---
let managedSession = {
  domain: 'flow.google.com',
  targetUrl: 'https://flow.google.com',
  cookieName: 'flow_session',
  sessionToken: '',
  scope: 'read_write',
  updatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  updatedBy: 'Vercel Admin Console',
  grantId: 'initial_grant',
};

// Initial default users
function hashPassword(password) {
  const salt = 'flow_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function verifyPassword(password, storedHash) {
  return hashPassword(password) === storedHash;
}

function issueToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

// Generate initial token
managedSession.sessionToken = issueToken({
  grantId: managedSession.grantId,
  domain: managedSession.domain,
  scope: 'read_write',
});

let users = [
  {
    id: 'usr_sami',
    username: 'sami',
    password_hash: hashPassword('123456'),
    role: 'creator',
    status: 'active',
    created_at: new Date().toISOString(),
    last_login_at: null,
  },
  {
    id: 'usr_bilal',
    username: 'bilal',
    password_hash: hashPassword('123456'),
    role: 'creator',
    status: 'active',
    created_at: new Date().toISOString(),
    last_login_at: null,
  },
  {
    id: 'usr_samiaqadir',
    username: 'samiaqadir',
    password_hash: hashPassword('123456'),
    role: 'creator',
    status: 'active',
    created_at: new Date().toISOString(),
    last_login_at: null,
  },
];

let auditLogs = [
  {
    event_type: 'SYSTEM_INIT',
    actor_id: 'vercel_admin',
    domain: 'flow.google.com',
    ip_address: '127.0.0.1',
    timestamp: new Date().toISOString(),
  },
];

// --- API Routes ---

// Health Check
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'Flow Session Share - Vercel Serverless Admin Gateway',
    timestamp: new Date().toISOString(),
  });
});

// GET /api/admin/config
app.get('/api/admin/config', (req, res) => {
  res.json({
    success: true,
    managedSession: {
      ...managedSession,
      hasActiveToken: !!managedSession.sessionToken,
      tokenPreview: managedSession.sessionToken ? managedSession.sessionToken.substring(0, 24) + '...' : 'None',
      fullToken: managedSession.sessionToken,
    },
  });
});

// POST /api/admin/session
app.post('/api/admin/session', (req, res) => {
  try {
    let {
      domain,
      targetUrl = 'https://flow.google.com',
      cookieName = 'flow_session',
      sessionToken,
      scope = 'read_write',
      expirationHours = 24,
    } = req.body;

    if (!domain || domain.trim() === '') {
      try {
        domain = new URL(targetUrl.startsWith('http') ? targetUrl : 'https://' + targetUrl).hostname;
      } catch {
        domain = 'flow.google.com';
      }
    }

    const grantId = uuidv4();
    const expiresAt = new Date(Date.now() + Number(expirationHours) * 60 * 60 * 1000).toISOString();

    const finalToken = sessionToken && sessionToken.trim() !== ''
      ? sessionToken.trim()
      : issueToken({ grantId, domain: domain.trim(), scope, exp: Math.floor(Date.now() / 1000) + Number(expirationHours) * 3600 });

    managedSession = {
      domain: domain.trim(),
      targetUrl: targetUrl.trim(),
      cookieName: cookieName.trim() || 'flow_session',
      sessionToken: finalToken,
      scope,
      updatedAt: new Date().toISOString(),
      expiresAt,
      updatedBy: 'Vercel Admin Console',
      grantId,
    };

    auditLogs.unshift({
      event_type: 'SESSION_UPDATED',
      actor_id: 'admin',
      domain: domain.trim(),
      ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Session credential successfully updated and deployed to all extension users.',
      managedSession,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update session: ' + err.message });
  }
});

// GET /api/admin/users
app.get('/api/admin/users', (req, res) => {
  const sanitized = users.map(({ password_hash, ...u }) => u);
  res.json({ users: sanitized });
});

// POST /api/admin/users
app.post('/api/admin/users', (req, res) => {
  const { username, password, role = 'creator' } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and Password are required.' });
  }

  const cleanUser = username.trim().toLowerCase();
  if (users.some(u => u.username.toLowerCase() === cleanUser)) {
    return res.status(409).json({ error: 'A user with this username already exists.' });
  }

  const newUser = {
    id: uuidv4(),
    username: cleanUser,
    password_hash: hashPassword(password.trim()),
    role,
    status: 'active',
    created_at: new Date().toISOString(),
    last_login_at: null,
  };

  users.unshift(newUser);

  auditLogs.unshift({
    event_type: 'USER_CREATED',
    actor_id: 'admin',
    domain: managedSession.domain,
    ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
    timestamp: new Date().toISOString(),
  });

  const { password_hash, ...userSafe } = newUser;
  res.json({ success: true, message: 'User created successfully.', user: userSafe });
});

// POST /api/admin/users/:id/toggle
app.post('/api/admin/users/:id/toggle', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  user.status = user.status === 'active' ? 'suspended' : 'active';
  res.json({ success: true, user: { id: user.id, username: user.username, status: user.status } });
});

// DELETE /api/admin/users/:id
app.delete('/api/admin/users/:id', (req, res) => {
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found.' });

  users.splice(idx, 1);
  res.json({ success: true, message: 'User deleted.' });
});

// GET /api/admin/stats
app.get('/api/admin/stats', (req, res) => {
  res.json({
    totalUsers: users.length,
    activeSessionGrants: managedSession.sessionToken ? 1 : 0,
    totalAuditLogs: auditLogs.length,
    recentLogs: auditLogs.slice(0, 10),
    managedSession: {
      domain: managedSession.domain,
      targetUrl: managedSession.targetUrl,
      cookieName: managedSession.cookieName,
      updatedAt: managedSession.updatedAt,
      expiresAt: managedSession.expiresAt,
    },
  });
});

// POST /api/auth/login (For Extension Users)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const cleanUser = username.trim().toLowerCase();
  const user = users.find(u => u.username.toLowerCase() === cleanUser);

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Your account has been suspended by the administrator.' });
  }

  if (!verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  user.last_login_at = new Date().toISOString();

  auditLogs.unshift({
    event_type: 'USER_LOGIN',
    actor_id: user.username,
    domain: managedSession.domain,
    ip_address: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    session: {
      token: managedSession.sessionToken,
      cookieName: managedSession.cookieName,
      targetUrl: managedSession.targetUrl,
      domain: managedSession.domain,
      scope: managedSession.scope,
      expiresAt: managedSession.expiresAt,
      studioUrl: managedSession.targetUrl,
    },
  });
});

// Export default for Vercel Serverless
export default app;
