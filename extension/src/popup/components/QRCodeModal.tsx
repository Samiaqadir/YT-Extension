import React from 'react';
import { X, Download, Copy, Check } from 'lucide-react';

interface QRCodeModalProps {
  qrDataUrl: string;
  shareUrl: string;
  domain: string;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  qrDataUrl,
  shareUrl,
  domain,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `flow-share-${domain}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xs p-5 shadow-2xl relative text-center">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <h3 className="font-bold text-sm text-white mb-1">Scan QR Code</h3>
        <p className="text-[11px] text-slate-400 mb-4">Recipient can scan to connect directly</p>

        <div className="bg-white p-3 rounded-xl inline-block shadow-inner mb-4">
          <img src={qrDataUrl} alt="Session QR Code" className="w-48 h-48 block mx-auto" />
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-2 px-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center justify-center space-x-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Link' : 'Copy Link'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="py-2 px-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center justify-center space-x-1"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
