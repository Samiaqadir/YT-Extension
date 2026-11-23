import React from 'react';
import { AlertTriangle, Lock, ShieldCheck } from 'lucide-react';

interface ConfirmationModalProps {
  domain: string;
  scope: string;
  expirationMinutes: number;
  recipientEmail?: string;
  hasPasscode: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  domain,
  scope,
  expirationMinutes,
  recipientEmail,
  hasPasscode,
  onConfirm,
  onCancel,
  isLoading,
}) => {
  const expText = expirationMinutes >= 60 ? `${expirationMinutes / 60} hour(s)` : `${expirationMinutes} minutes`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
        <div className="flex items-center space-x-3 text-amber-400">
          <div className="w-9 h-9 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Explicit Confirmation</h3>
            <p className="text-xs text-slate-400">Review session delegation grant</p>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Target Website:</span>
            <span className="font-mono font-semibold text-blue-400">{domain}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Delegated Scope:</span>
            <span className="font-semibold text-slate-200 uppercase">{scope}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Expiration Window:</span>
            <span className="font-medium text-emerald-400">{expText}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Recipient Restriction:</span>
            <span className="text-slate-300">{recipientEmail || 'Anyone with link'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Passcode Protection:</span>
            <span className="font-medium text-slate-200">{hasPasscode ? 'Enabled 🔒' : 'None'}</span>
          </div>
        </div>

        <div className="bg-blue-950/40 border border-blue-500/20 rounded-xl p-2.5 flex items-start space-x-2 text-[11px] text-blue-200">
          <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p>
            Zero-Knowledge Guarantee: Your passwords and master browser cookies are never read or transmitted. Access can be revoked anytime.
          </p>
        </div>

        <div className="flex space-x-2 pt-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2 px-3 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 transition flex items-center justify-center space-x-1.5"
          >
            {isLoading ? (
              <span>Generating...</span>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Confirm & Share</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
