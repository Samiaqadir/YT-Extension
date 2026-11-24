// Flow Session Share - Background Service Worker (Manifest V3)
import { injectAllSessionCookies } from '../services/cookie-injector';
import { getApiBaseUrl } from '../services/config';

// State storage
interface AuthorizedSessionGrant {
  grantId: string;
  domain: string;
  token: string;
  scope?: string;
  cookieName?: string;
  targetUrl?: string;
  expiresAt?: string;
}

console.log('[Flow Background] Service Worker initialized with Smart Cookie Injector.');

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INJECT_DELEGATED_SESSION') {
    handleInjectSession(message.payload)
      .then((res) => sendResponse({ success: true, ...res }))
      .catch((err) => {
        console.error('[Flow Background] Injection error:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep sendResponse open for async
  }

  if (message.type === 'GET_ACTIVE_DELEGATED_SESSION') {
    const queryDomain = (message.domain || '').toLowerCase();
    chrome.storage.local.get(['delegated_sessions', 'flow_auth_session'], (result) => {
      const sessions: Record<string, AuthorizedSessionGrant> = result.delegated_sessions || {};
      const activeSession = result.flow_auth_session;

      // Check direct domain match
      let matched = sessions[queryDomain];

      // Check partial / hostname matches
      if (!matched) {
        for (const [key, s] of Object.entries(sessions)) {
          if (
            queryDomain.includes(key.toLowerCase()) ||
            key.toLowerCase().includes(queryDomain) ||
            (queryDomain.includes('flow') && key.includes('flow')) ||
            (queryDomain.includes('google') && key.includes('google'))
          ) {
            matched = s;
            break;
          }
        }
      }

      if (!matched && activeSession) {
        matched = activeSession;
      }

      sendResponse({ session: matched || null });
    });
    return true;
  }

  if (message.type === 'CLEAR_DELEGATED_SESSION') {
    const { domain } = message;
    chrome.storage.local.get(['delegated_sessions'], (result) => {
      const sessions = result.delegated_sessions || {};
      delete sessions[domain];
      chrome.storage.local.set({ delegated_sessions: sessions }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
});

/**
 * Handles establishing the authorized session in the browser.
 * - Stores grant in chrome.storage
 * - Deeply parses and injects all session cookies (Google Flow, .google.com, etc.)
 * - Flushes cookies before opening target website tab
 */
async function handleInjectSession(payload: AuthorizedSessionGrant): Promise<{
  tabId: number;
  injectedCount: number;
  failedCount: number;
}> {
  const { domain, token, expiresAt, cookieName } = payload;
  let targetUrl = payload.targetUrl || 'https://flow.google.com';

  console.log(`[Flow Background] Injecting session for domain: ${domain}, target: ${targetUrl}`);

  // 1. Store in local storage
  const stored = await chrome.storage.local.get(['delegated_sessions']);
  const sessions = stored.delegated_sessions || {};
  sessions[domain] = payload;
  sessions['flow.google.com'] = payload;
  sessions['flow.google'] = payload;

  await chrome.storage.local.set({
    delegated_sessions: sessions,
    flow_auth_session: payload,
  });

  // 2. Set browser session cookies using Smart Cookie Injector
  let injectionResult = { successful: 0, failed: 0, total: 0, details: [] as any[] };
  try {
    injectionResult = await injectAllSessionCookies(
      token,
      targetUrl,
      cookieName || 'flow_session',
      domain || 'flow.google.com',
      expiresAt
    );

    console.log(
      `[Flow Background] Injected ${injectionResult.successful}/${injectionResult.total} cookies successfully.`
    );
  } catch (cookieErr) {
    console.error('[Flow Background] Cookie injection error:', cookieErr);
  }

  // 3. Short pause to allow Chrome's network process to flush the cookie jar
  await new Promise((resolve) => setTimeout(resolve, 250));

  // 4. Open or navigate to target tab
  let tabId = 0;
  try {
    const tab = await chrome.tabs.create({ url: targetUrl });
    tabId = tab.id || 0;
  } catch (tabErr) {
    console.warn('[Flow Background] Tab creation error:', tabErr);
  }

  // 5. Trigger desktop notification
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Flow Session Connected!',
      message: `Injected ${injectionResult.successful} session cookies for ${domain || 'Flow Studio'}.`,
      priority: 1,
    });
  } catch {}

  return {
    tabId,
    injectedCount: injectionResult.successful,
    failedCount: injectionResult.failed,
  };
}

// Background SSE connection for real-time notifications
async function setupNotificationListener() {
  try {
    const apiBase = await getApiBaseUrl();
    const evtSource = new EventSource(`${apiBase}/api/events/notifications?userId=user_owner_default`);

    evtSource.addEventListener('INVITATION_CLAIMED', (evt: any) => {
      const data = JSON.parse(evt.data);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Session Accepted!',
        message: `Recipient has accepted your shared session for ${data.domain}.`,
        priority: 2,
      });
    });

    evtSource.addEventListener('ADMIN_SESSION_UPDATED', async (evt: any) => {
      try {
        const data = JSON.parse(evt.data);
        console.log('[Flow Background] Admin session updated event received:', data);

        // Fetch latest session credentials and auto-reinject
        const res = await fetch(`${apiBase}/api/admin/config`);
        const config = await res.json();
        if (config.managedSession?.fullToken) {
          const m = config.managedSession;
          await injectAllSessionCookies(
            m.fullToken,
            m.targetUrl || 'https://flow.google.com',
            m.cookieName || 'flow_session',
            m.domain || 'flow.google.com',
            m.expiresAt
          );

          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Flow Session Synchronized!',
            message: 'Updated credentials from Admin Console deployed to your browser.',
            priority: 1,
          });
        }
      } catch (e) {
        console.warn('[Flow Background] Error syncing updated admin session:', e);
      }
    });

    evtSource.addEventListener('SESSION_REVOKED', (evt: any) => {
      const data = JSON.parse(evt.data);
      console.log('[Flow Background] Session revoked broadcast received:', data);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Flow Session Revoked',
        message: 'Your active session has been revoked by the administrator.',
        priority: 2,
      });
    });

    evtSource.onerror = () => {
      // Reconnect handled automatically by EventSource
    };
  } catch (e) {
    console.log('[Flow Background] Notification listener init notice:', e);
  }
}

// Start notification listener
setupNotificationListener();
