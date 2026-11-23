import React, { useState, useEffect } from 'react';
import { RefreshCw, Ban, Clock, Globe, Shield } from 'lucide-react';
import { ApiService, ActiveShareItem } from '../services/api.service';

interface ActiveSharesScreenProps {
  onRevokeSuccess?: () => void;
}

export const ActiveSharesScreen: React.FC<ActiveSharesScreenProps> = ({ onRevokeSuccess }) => {
  const [shares, setShares] = useState<ActiveShareItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchShares = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getActiveShares('user_owner_default');
      setShares(data);
    } catch (err) {
      console.error('Failed to load active shares:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, []);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await ApiService.revokeShare(id);
      await fetchShares();
      if (onRevokeSuccess) onRevokeSuccess();
    } catch (err: any) {
      alert('Revocation failed: ' + err.message);
    } finally {
      setRevokingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
            Active
          </span>
        );
      case 'claimed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950 text-blue-400 border border-blue-500/30">
            Claimed
          </span>
        );
      case 'revoked':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-950 text-red-400 border border-red-500/30">
            Revoked
          </span>
        );
      case 'expired':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            Expired
          </span>
        );
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center">
          <Shield className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
          Active Delegations
        </h2>
        <button
          onClick={fetchShares}
          disabled={isLoading}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {shares.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
          <Clock className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          <p>No active or recent session shares found.</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {shares.map((share) => {
            const isAlive = share.status === 'active' || share.status === 'claimed';
            return (
              <div
                key={share.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-1.5 font-mono text-blue-300 font-semibold text-[11px]">
                    <Globe className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    <span className="truncate max-w-[170px]">{share.domain}</span>
                  </div>
                  {getStatusBadge(share.status)}
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>Scope: <strong className="text-slate-200 uppercase">{share.delegated_scope}</strong></span>
                  <span>Expires: {new Date(share.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {isAlive && (
                  <div className="pt-2 border-t border-slate-800/80 flex justify-end">
                    <button
                      onClick={() => handleRevoke(share.id)}
                      disabled={revokingId === share.id}
                      className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/60 text-red-400 border border-red-500/30 text-[10px] font-semibold flex items-center space-x-1 transition"
                    >
                      <Ban className="w-3 h-3" />
                      <span>{revokingId === share.id ? 'Revoking...' : 'Revoke Access'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
