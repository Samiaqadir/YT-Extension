import React, { useState } from 'react';
import { Globe, RefreshCw, KeyRound, Clock, User, QrCode, Copy, Check, ShieldAlert, Sparkles, AlertCircle } from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { QRCodeModal } from './QRCodeModal';
import { CryptoService } from '../services/crypto.service';
import { ApiService, ShareInvitationResult } from '../services/api.service';

interface ShareScreenProps {
  currentDomain: string;
  onRefreshDomain: () => void;
  onShareCreated?: () => void;
}

export const ShareScreen: React.FC<ShareScreenProps> = ({
  currentDomain,
  onRefreshDomain,
  onShareCreated,
}) => {
  const [domain, setDomain] = useState(currentDomain || 'localhost:4000/demo/app');
  const [scope, setScope] = useState('read_write');
  const [expirationMinutes, setExpirationMinutes] = useState(30);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPasscode, setRecipientPasscode] = useState('');

  // Flow states
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareResult, setShareResult] = useState<ShareInvitationResult | null>(null);
  const [clientKey, setClientKey] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync if currentDomain changes from parent
  React.useEffect(() => {
    if (currentDomain && !shareResult) {
      setDomain(currentDomain);
    }
  }, [currentDomain, shareResult]);

  const handleStartShare = () => {
    setErrorMsg(null);
    if (!domain.trim()) {
      setErrorMsg('Please select or specify a website domain.');
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleExecuteShare = async () => {
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      // 1. Generate client-side AES-GCM 256-bit encryption key
      const key = await CryptoService.generateAESKey();
      const exportedKey = await CryptoService.exportKey(key);

      // 2. Client-side encrypted payload (never decrypted on server)
      const secretPayload = {
        domain: domain.trim(),
        scope,
        timestamp: Date.now(),
        creator: 'User A (Session Owner)',
        allowedFeatures: ['metrics', 'dashboard', 'workspace'],
        nonce: window.crypto.randomUUID ? window.crypto.randomUUID() : Math.random().toString(),
      };

      const encryptedPayload = await CryptoService.encrypt(secretPayload, key);

      // 3. Register temporary invitation with backend
      const invitation = await ApiService.createShare({
        domain: domain.trim(),
        delegatedScope: scope,
        expirationMinutes,
        recipientEmail: recipientEmail.trim() || undefined,
        recipientPasscode: recipientPasscode.trim() || undefined,
        encryptedPayload,
      });

      // 4. Construct complete end-to-end URL with client key in URL hash fragment
      // Fragment (#) is never sent across HTTP to the server!
      const fullShareUrl = `${invitation.shareUrl}&key=${encodeURIComponent(exportedKey)}`;

      // 5. Generate QR code
      const qr = await CryptoService.generateQR(fullShareUrl);

      setShareResult({
        ...invitation,
        shareUrl: fullShareUrl,
      });
      setClientKey(exportedKey);
      setQrDataUrl(qr);
      setIsConfirmOpen(false);

      if (onShareCreated) onShareCreated();
    } catch (err: any) {
      console.error('Error generating share invitation:', err);
      setErrorMsg(err.message || 'Failed to generate invitation.');
      setIsConfirmOpen(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!shareResult) return;
    navigator.clipboard.writeText(shareResult.shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevokeNow = async () => {
    if (!shareResult) return;
    try {
      await ApiService.revokeShare(shareResult.id);
      setShareResult(null);
      setClientKey(null);
      setQrDataUrl(null);
      alert('Session invitation revoked immediately.');
    } catch (err: any) {
      alert('Revocation failed: ' + err.message);
    }
  };

  const handleReset = () => {
    setShareResult(null);
    setClientKey(null);
    setQrDataUrl(null);
    setErrorMsg(null);
  };

  return (
    <div className="p-4 space-y-4">
      {errorMsg && (
        <div className="bg-red-950/60 border border-red-500/40 rounded-xl p-3 flex items-start space-x-2 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {!shareResult ? (
        /* Share Setup Form */
        <div className="space-y-4">
          {/* Active Domain Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center">
                <Globe className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                Active Website Session
              </label>
              <button
                type="button"
                onClick={onRefreshDomain}
                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                title="Detect active tab"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Detect Tab</span>
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. localhost:4000/demo/app"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Delegates scoped session access for this target host.
            </p>
          </div>

          {/* Delegated Scope */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Delegated Scope
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { id: 'read_write', label: 'Full Access' },
                { id: 'read_only', label: 'Read Only' },
                { id: 'workspace', label: 'Workspace' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScope(s.id)}
                  className={`py-2 px-2 rounded-xl border text-center transition font-medium ${
                    scope === s.id
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Expiration Time Window */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Expiration Window
            </label>
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              {[
                { min: 5, label: '5 min' },
                { min: 30, label: '30 min' },
                { min: 60, label: '1 hour' },
                { min: 1440, label: '24 hours' },
              ].map((item) => (
                <button
                  key={item.min}
                  type="button"
                  onClick={() => setExpirationMinutes(item.min)}
                  className={`py-2 px-1 text-center rounded-xl border text-[11px] transition font-medium ${
                    expirationMinutes === item.min
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Recipient Info */}
          <div className="space-y-2 pt-1 border-t border-slate-800/80">
            <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider flex items-center">
              <User className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              Recipient Verification (Optional)
            </div>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="Recipient email restriction (optional)"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
            />
            <div className="relative">
              <input
                type="password"
                value={recipientPasscode}
                onChange={(e) => setRecipientPasscode(e.target.value)}
                placeholder="Set 4-6 digit passcode (optional)"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
              />
              <KeyRound className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center text-slate-200 font-semibold">
              <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
              Security Architecture
            </div>
            <p className="text-[10px] leading-relaxed">
              Never transmits raw master cookies or passwords. Uses client-side AES-256-GCM encryption & single-use tokens.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleStartShare}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/25 transition duration-200 text-xs flex items-center justify-center space-x-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate Secure Invitation</span>
          </button>
        </div>
      ) : (
        /* Invitation Result Screen */
        <div className="space-y-4 animate-fade-in">
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 text-center">
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Check className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">Temporary Invitation Ready</h3>
            <p className="text-[11px] text-emerald-300 mt-0.5">
              Single-use encrypted link generated for {shareResult.domain}
            </p>
          </div>

          {/* Invitation Link Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              One-Time Invitation Link
            </div>
            <div className="font-mono text-[11px] text-blue-300 bg-slate-950 p-2 rounded border border-slate-800 break-all select-all">
              {shareResult.shareUrl}
            </div>

            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-md shadow-blue-600/20 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy Invitation Link'}</span>
              </button>
              {qrDataUrl && (
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1 border border-slate-700 transition"
                  title="View QR Code"
                >
                  <QrCode className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Expiration and Actions */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block">Expires At:</span>
              <span className="font-mono text-slate-200 text-[11px]">
                {new Date(shareResult.expiresAt).toLocaleTimeString()}
              </span>
            </div>
            <button
              type="button"
              onClick={handleRevokeNow}
              className="text-xs text-red-400 hover:text-red-300 font-semibold px-3 py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition"
            >
              Revoke Access
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
          >
            Create Another Share
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <ConfirmationModal
          domain={domain}
          scope={scope}
          expirationMinutes={expirationMinutes}
          recipientEmail={recipientEmail}
          hasPasscode={!!recipientPasscode}
          onConfirm={handleExecuteShare}
          onCancel={() => setIsConfirmOpen(false)}
          isLoading={isGenerating}
        />
      )}

      {/* QR Code Modal */}
      {showQrModal && qrDataUrl && shareResult && (
        <QRCodeModal
          qrDataUrl={qrDataUrl}
          shareUrl={shareResult.shareUrl}
          domain={shareResult.domain}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </div>
  );
};
