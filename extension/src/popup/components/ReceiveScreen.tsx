import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Check, AlertCircle, ExternalLink, ArrowRight } from 'lucide-react';
import { ApiService } from '../services/api.service';
import { getApiBaseUrl } from '../../services/config';

interface ReceiveScreenProps {
  onSessionClaimed?: (domain: string) => void;
}

export const ReceiveScreen: React.FC<ReceiveScreenProps> = ({ onSessionClaimed }) => {
  const [inputVal, setInputVal] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Verified invitation data
  const [verifiedData, setVerifiedData] = useState<any | null>(null);
  const [extractedToken, setExtractedToken] = useState<string | null>(null);
  const [extractedKey, setExtractedKey] = useState<string | null>(null);

  // Claim success
  const [claimSuccess, setClaimSuccess] = useState<any | null>(null);

  const handleVerify = async () => {
    setErrorMsg(null);
    setClaimSuccess(null);
    const trimmed = inputVal.trim();
    if (!trimmed) {
      setErrorMsg('Please enter an invitation code or paste a share link.');
      return;
    }

    setIsLoading(true);

    try {
      let token = trimmed;
      let key = null;

      // Parse full URL if pasted
      if (trimmed.includes('#')) {
        const hash = trimmed.substring(trimmed.indexOf('#') + 1);
        const params = new URLSearchParams(hash);
        token = params.get('token') || trimmed;
        key = params.get('key');
      }

      setExtractedToken(token);
      setExtractedKey(key);

      const metadata = await ApiService.getInvitationMetadata(token);
      setVerifiedData(metadata);
    } catch (err: any) {
      setErrorMsg(err.message || 'Invitation verification failed.');
      setVerifiedData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!extractedToken) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const result = await ApiService.claimInvitation(
        extractedToken,
        'user_recipient_client',
        passcode.trim() || undefined
      );

      // Instruct Chrome extension background worker to inject authorized session
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'INJECT_DELEGATED_SESSION',
          payload: {
            grantId: result.grantId,
            domain: result.domain,
            token: result.delegatedToken,
            scope: result.scope,
            expiresAt: result.expiresAt,
            targetUrl: (result as any).targetUrl || (result.domain.startsWith('http') ? result.domain : `https://${result.domain}`),
            cookieName: (result as any).cookieName || 'flow_session',
          },
        });
      }

      setClaimSuccess(result);
      if (onSessionClaimed) onSessionClaimed(result.domain);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to claim session.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncAdminSession = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const apiBase = await getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/admin/config`);
      const data = await res.json();
      if (!data.managedSession?.fullToken) {
        throw new Error('No active centralized session configured by admin yet.');
      }
      const token = data.managedSession.fullToken;
      const domain = data.managedSession.domain;

      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'INJECT_DELEGATED_SESSION',
          payload: {
            grantId: 'admin_sync_' + Date.now(),
            domain,
            token,
            scope: data.managedSession.scope,
            expiresAt: data.managedSession.expiresAt,
            targetUrl: data.managedSession.targetUrl || 'https://flow.google.com',
            cookieName: data.managedSession.cookieName || 'flow_session',
          },
        });
      }

      setClaimSuccess({
        domain,
        delegatedToken: token,
      });
      if (onSessionClaimed) onSessionClaimed(domain);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sync admin session.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenApp = () => {
    if (!claimSuccess) return;
    let url = claimSuccess.domain.startsWith('http')
      ? claimSuccess.domain
      : `http://${claimSuccess.domain}`;

    if (claimSuccess.domain.includes('localhost:4000') || claimSuccess.domain.includes('demo')) {
      url = `http://localhost:4000/demo/app?token=${encodeURIComponent(claimSuccess.delegatedToken)}`;
    } else {
      url = `${url}${url.includes('?') ? '&' : '?'}flow_grant=${encodeURIComponent(claimSuccess.delegatedToken)}`;
    }

    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="p-4 space-y-4">
      {errorMsg && (
        <div className="bg-red-950/60 border border-red-500/40 rounded-xl p-3 flex items-start space-x-2 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {!claimSuccess ? (
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Enter Invitation Code or Link
            </label>
            <textarea
              rows={2}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Paste invitation link (http://localhost:4000/portal#token=...)"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500 transition resize-none"
            />
          </div>

          {!verifiedData ? (
            <>
              <button
                type="button"
                onClick={handleVerify}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-blue-600/25 transition text-xs flex items-center justify-center space-x-1.5"
              >
                {isLoading ? (
                  <span>Checking Gateway...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify Invitation</span>
                  </>
                )}
              </button>

              <div className="pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={handleSyncAdminSession}
                  disabled={isLoading}
                  className="w-full py-2.5 px-3 rounded-xl border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/40 text-purple-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition shadow-sm"
                >
                  <span>⚡ Connect to Central Admin Session</span>
                </button>
                <p className="text-[10px] text-slate-500 text-center mt-1">
                  Connects to latest session deployed by administrator
                </p>
              </div>
            </>
          ) : (
            /* Verified Details Ready to Connect */
            <div className="space-y-3 animate-fade-in">
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 text-xs space-y-2">
                <div className="flex items-center text-emerald-400 font-semibold">
                  <Check className="w-4 h-4 mr-1.5" />
                  Verified Session Grant
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-emerald-500/20 text-slate-300">
                  <div>
                    <span className="text-slate-400 block">Domain:</span>
                    <span className="font-mono text-blue-300 font-medium">{verifiedData.domain}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Scope:</span>
                    <span className="uppercase text-slate-200">{verifiedData.delegatedScope}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Owner:</span>
                    <span className="text-slate-200">{verifiedData.ownerLabel}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Expires:</span>
                    <span className="text-slate-200">{new Date(verifiedData.expiresAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              {verifiedData.requiresPasscode && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center">
                    <KeyRound className="w-3.5 h-3.5 mr-1 text-amber-400" />
                    Passcode Required by Owner
                  </label>
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter passcode"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleClaim}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-emerald-600/25 transition text-xs flex items-center justify-center space-x-1.5"
              >
                {isLoading ? (
                  <span>Connecting...</span>
                ) : (
                  <>
                    <span>Connect to Authorized Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Success Screen */
        <div className="space-y-4 animate-fade-in text-center py-2">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Authorized Session Connected</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Delegated session registered with browser background worker.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-left space-y-1 text-xs">
            <div className="text-slate-400 text-[10px]">Session Grant Active:</div>
            <div className="font-mono text-emerald-400 text-[11px] truncate">{claimSuccess.delegatedToken}</div>
            <div className="text-slate-500 text-[10px]">Domain: {claimSuccess.domain}</div>
          </div>

          <button
            type="button"
            onClick={handleOpenApp}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-blue-600/25 transition text-xs flex items-center justify-center space-x-1.5"
          >
            <span>Open Target Website</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
