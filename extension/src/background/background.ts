// Flow Session Share - Background Service Worker (Manifest V3)

// State storage
interface AuthorizedSessionGrant {
  grantId: string;
  domain: string;
  token: string;
  scope: string;
  expiresAt: string;
}

console.log('[Flow Background] Service Worker initialized.');

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INJECT_DELEGATED_SESSION') {
    handleInjectSession(message.payload)
      .then((res) => sendResponse({ success: true, ...res }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep sendResponse open for async
  }

  if (message.type === 'GET_ACTIVE_DELEGATED_SESSION') {
    const { domain } = message;
    chrome.storage.local.get(['delegated_sessions'], (result) => {
      const sessions: Record<string, AuthorizedSessionGrant> = result.delegated_sessions || {};
      sendResponse({ session: sessions[domain] || null });
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
 * - Sets delegated auth cookie for the target domain
 * - Opens or focuses target website tab
 */
async function handleInjectSession(payload: AuthorizedSessionGrant): Promise<{ tabId: number }> {
  const { domain, token, expiresAt } = payload;
  console.log(`[Flow Background] Injecting delegated session for domain: ${domain}`);

  // 1. Store in local storage
  const stored = await chrome.storage.local.get(['delegated_sessions']);
  const sessions = stored.delegated_sessions || {};
  sessions[domain] = payload;
  await chrome.storage.local.set({ delegated_sessions: sessions });

  // 2. Set browser session cookies for target domain
  let targetUrl = (payload as any).targetUrl || 'https://flow.google.com';
  try {
    const parsedUrl = new URL(targetUrl.startsWith('http') ? targetUrl : `http://${targetUrl}`);
    const cookieUrl = parsedUrl.origin + '/';
    const isHttps = parsedUrl.protocol === 'https:';

    // Set primary session cookie
    await chrome.cookies.set({
      url: cookieUrl,
      name: (payload as any).cookieName || 'flow_session',
      value: token,
      path: '/',
      secure: isHttps,
    });

    // Set delegated session cookie
    await chrome.cookies.set({
      url: cookieUrl,
      name: 'flow_delegated_session',
      value: token,
      path: '/',
      secure: isHttps,
    });
    console.log(`[Flow Background] Browser cookies set successfully for ${cookieUrl}`);
  } catch (cookieErr) {
    console.warn('[Flow Background] Cookie injection warning:', cookieErr);
  }

  // 3. Open or navigate to target tab
  const tab = await chrome.tabs.create({ url: targetUrl });

  // 4. Trigger desktop notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Flow Session Connected',
    message: `Securely connected to ${domain} with delegated authorization.`,
    priority: 1,
  });

  return { tabId: tab.id || 0 };
}

// Background SSE connection for real-time notifications
function setupNotificationListener() {
  try {
    const evtSource = new EventSource('http://localhost:4000/api/events/notifications?userId=user_owner_default');

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

    evtSource.addEventListener('SESSION_REVOKED', (evt: any) => {
      const data = JSON.parse(evt.data);
      console.log('[Flow Background] Session revoked broadcast received:', data);
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
