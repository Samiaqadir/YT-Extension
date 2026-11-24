// Flow Session Share - Content Script

(() => {
  const currentHostname = window.location.hostname;
  const currentHref = window.location.href;
  console.log('[Flow Content Script] Active on:', currentHostname, currentHref);

  // Check URL query parameters for flow_grant
  const urlParams = new URLSearchParams(window.location.search);
  const flowGrant = urlParams.get('flow_grant') || urlParams.get('token');

  if (flowGrant) {
    console.log('[Flow Content Script] Detected flow_grant in URL. Registering delegated session.');
    try {
      sessionStorage.setItem('flow_delegated_session', flowGrant);
      localStorage.setItem('flow_delegated_session', flowGrant);
    } catch {}

    // Notify web application
    window.postMessage(
      {
        source: 'flow_session_share',
        type: 'FLOW_SESSION_DELEGATED',
        token: flowGrant,
      },
      '*'
    );
  }

  // Ask background script if there is an active session for this domain
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage(
      {
        type: 'GET_ACTIVE_DELEGATED_SESSION',
        domain: currentHostname,
        origin: window.location.origin,
      },
      (response) => {
        if (response?.session) {
          console.log('[Flow Content Script] Verified active delegated session for domain:', currentHostname);

          const token = response.session.token;
          if (token) {
            try {
              sessionStorage.setItem('flow_delegated_session', token);
            } catch {}

            window.postMessage(
              {
                source: 'flow_session_share',
                type: 'FLOW_SESSION_READY',
                domain: currentHostname,
                session: response.session,
              },
              '*'
            );
          }

          // If on Google Login page with a continue URL back to Flow, redirect back since cookies are active
          if (
            currentHostname.includes('accounts.google.com') &&
            (currentHref.includes('flow.google.com') || currentHref.includes('flow.google'))
          ) {
            const continueUrl = urlParams.get('continue');
            if (continueUrl && (continueUrl.includes('flow.google.com') || continueUrl.includes('flow.google'))) {
              console.log('[Flow Content Script] Session active - auto-navigating to Flow destination:', continueUrl);
              window.location.href = continueUrl;
            }
          }
        }
      }
    );
  }
})();
