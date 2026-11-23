// Flow Session Share - Content Script

(() => {
  console.log('[Flow Content Script] Active on:', window.location.href);

  // Check URL query parameters for flow_grant
  const urlParams = new URLSearchParams(window.location.search);
  const flowGrant = urlParams.get('flow_grant');

  if (flowGrant) {
    console.log('[Flow Content Script] Detected flow_grant in URL. Registering delegated session.');
    sessionStorage.setItem('flow_delegated_session', flowGrant);

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
  chrome.runtime.sendMessage(
    {
      type: 'GET_ACTIVE_DELEGATED_SESSION',
      domain: window.location.origin,
    },
    (response) => {
      if (response?.session) {
        console.log('[Flow Content Script] Verified active delegated session for domain:', window.location.origin);
      }
    }
  );
})();
