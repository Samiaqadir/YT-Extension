import { Router, Request, Response } from 'express';
import { TokenService } from '../services/token.service.js';
import { db } from '../config/db.js';

const router = Router();

/**
 * Demo Partner Web App: Acme Cloud Analytics
 * Demonstrates how a real website securely accepts a delegated session token
 * from Flow Session Share without transmitting raw user cookies or passwords!
 */
router.get('/app', async (req: Request, res: Response) => {
  const token = (req.query.token as string) || (req.headers.authorization?.replace('Bearer ', ''));

  if (!token) {
    // Unauthenticated view
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Acme Cloud Analytics - Login Required</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      </head>
      <body class="bg-gray-900 text-white min-h-screen flex items-center justify-center p-6">
        <div class="max-w-md w-full bg-gray-800 rounded-xl p-8 border border-gray-700 shadow-2xl text-center">
          <div class="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
            ⚡
          </div>
          <h1 class="text-2xl font-bold mb-2">Acme Cloud Analytics</h1>
          <p class="text-gray-400 text-sm mb-6">Enterprise Portal & Metrics Dashboard</p>
          
          <div class="bg-yellow-900/40 border border-yellow-600/50 rounded-lg p-4 mb-6 text-left">
            <div class="flex items-center text-yellow-400 text-sm font-semibold mb-1">
              🔒 Authentication Required
            </div>
            <p class="text-xs text-yellow-200">
              You are currently unauthenticated. To access this dashboard, sign in with credentials or connect via a 
              <strong>Flow Session Share</strong> delegated invitation token.
            </p>
          </div>

          <div class="text-xs text-gray-500">
            Domain: <code class="bg-gray-700 px-2 py-1 rounded text-blue-400">localhost:4000/demo/app</code>
          </div>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // Verify delegated session grant
  const decoded = TokenService.verifyDelegatedSessionToken(token);
  if (!decoded) {
    res.status(401).send(`
      <body style="font-family:sans-serif; background:#111; color:#ff6b6b; padding:40px; text-align:center;">
        <h2>❌ Invalid Session Token</h2>
        <p>The provided delegated token is either expired or cryptographically invalid.</p>
        <a href="/portal" style="color:#4dabf7;">Back to Flow Portal</a>
      </body>
    `);
    return;
  }

  // Check grant in database
  const grantRes = await db.query(
    `SELECT g.*, i.status as invitation_status 
     FROM delegated_session_grants g 
     JOIN session_invitations i ON g.invitation_id = i.id 
     WHERE g.grant_id = $1`,
    [decoded.grantId]
  );

  if (grantRes.rows.length === 0 || !grantRes.rows[0].is_valid || grantRes.rows[0].invitation_status === 'revoked') {
    res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Session Revoked</title>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      </head>
      <body class="bg-gray-950 text-white min-h-screen flex items-center justify-center p-6">
        <div class="max-w-md w-full bg-gray-900 border border-red-500/40 rounded-xl p-8 shadow-2xl text-center">
          <div class="text-5xl mb-4">🚫</div>
          <h1 class="text-2xl font-bold text-red-400 mb-2">Access Revoked</h1>
          <p class="text-gray-300 text-sm mb-6">
            The owner of this session has revoked delegated access. All active tokens for this grant have been immediately invalidated.
          </p>
          <a href="/demo/app" class="inline-block bg-gray-800 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition">
            Reload App
          </a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  const grant = grantRes.rows[0];

  // Render Authorized Dashboard for Recipient!
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Acme Cloud Analytics - Authorized Session</title>
      <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
      <script>
        // Poll for revocation live status
        setInterval(async () => {
          try {
            const res = await fetch('/api/gateway/verify?token=${token}');
            const data = await res.json();
            if (!data.valid) {
              window.location.reload();
            }
          } catch(e) {}
        }, 3000);
      </script>
    </head>
    <body class="bg-gray-900 text-white min-h-screen flex flex-col">
      <!-- Top banner -->
      <header class="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">⚡</div>
          <div>
            <h1 class="font-bold text-lg">Acme Cloud Analytics</h1>
            <p class="text-xs text-gray-400">Protected Enterprise App</p>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-900/60 text-green-300 border border-green-500/30">
            <span class="w-2 h-2 mr-2 bg-green-400 rounded-full animate-pulse"></span>
            Flow Delegated Session Active
          </span>
          <div class="text-xs text-gray-400">
            Grantee: <span class="text-white font-medium">${grant.grantee_id}</span>
          </div>
        </div>
      </header>

      <!-- Main Workspace -->
      <main class="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        <div class="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 rounded-xl p-6">
          <div class="flex items-start justify-between">
            <div>
              <h2 class="text-xl font-bold text-white mb-1">Welcome to Delegated Workspace</h2>
              <p class="text-sm text-blue-200">
                You were granted access via <strong>Flow Session Share</strong> without exposing raw passwords or master cookies.
              </p>
            </div>
            <div class="text-right">
              <div class="text-xs text-gray-400">Delegated Scope</div>
              <div class="text-sm font-semibold text-blue-300 uppercase">${grant.scope}</div>
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-blue-500/20 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-300">
            <div><strong>Target Domain:</strong> ${grant.domain}</div>
            <div><strong>Expires At:</strong> ${new Date(grant.expires_at).toLocaleTimeString()}</div>
            <div><strong>Security Gateway:</strong> Cryptographically Verified</div>
          </div>
        </div>

        <!-- Sample Analytics Metrics -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <div class="text-gray-400 text-xs font-medium uppercase mb-1">Real-time Users</div>
            <div class="text-3xl font-extrabold text-white">4,892</div>
            <div class="text-green-400 text-xs mt-2 flex items-center">↑ 14.2% from last hour</div>
          </div>
          <div class="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <div class="text-gray-400 text-xs font-medium uppercase mb-1">API Throughput</div>
            <div class="text-3xl font-extrabold text-blue-400">99.98%</div>
            <div class="text-gray-400 text-xs mt-2">12.4M requests / day</div>
          </div>
          <div class="bg-gray-800 border border-gray-700 rounded-xl p-5">
            <div class="text-gray-400 text-xs font-medium uppercase mb-1">System Health</div>
            <div class="text-3xl font-extrabold text-emerald-400">Optimal</div>
            <div class="text-xs text-gray-400 mt-2">Zero anomalies detected</div>
          </div>
        </div>

        <div class="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 class="text-lg font-semibold mb-4">Live Session Security Assurance</h3>
          <p class="text-sm text-gray-400 leading-relaxed">
            This session is actively protected by Flow Session Share's revocation protocol. If the session owner revokes access from the Chrome extension popup, this page will immediately terminate the session and revoke access in real-time.
          </p>
        </div>
      </main>
    </body>
    </html>
  `);
});

export default router;
