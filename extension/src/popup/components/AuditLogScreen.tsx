import React, { useState, useEffect } from 'react';
import { RefreshCw, FileText, CheckCircle2, ShieldAlert, XCircle, ArrowUpRight } from 'lucide-react';
import { ApiService, AuditLogItem } from '../services/api.service';

export const AuditLogScreen: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getAuditLogs('user_owner_default');
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'CREATED':
        return <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />;
      case 'CLAIMED':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'REVOKED':
        return <XCircle className="w-3.5 h-3.5 text-red-400" />;
      case 'ACCESS_GATEWAY':
        return <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center">
          <FileText className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
          Security Audit Trail
        </h2>
        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-500">
          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          <p>No audit events recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {logs.map((log) => (
            <div
              key={log.id}
              className="bg-slate-900 border border-slate-800/80 rounded-xl p-2.5 text-xs flex items-start space-x-2.5"
            >
              <div className="p-1 rounded-lg bg-slate-950 border border-slate-800 mt-0.5">
                {getEventIcon(log.event_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-[11px]">{log.event_type}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono truncate">
                  Domain: {log.domain}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center justify-between mt-0.5">
                  <span>Actor: {log.actor_id}</span>
                  {log.ip_address && <span>IP: {log.ip_address}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
