import React from 'react';
import { ShieldCheck, Radio } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({ activeTab }) => {
  return (
    <header className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
      <div className="flex items-center space-x-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-tight text-white leading-tight">Flow Session Share</h1>
          <p className="text-[10px] text-slate-400 font-medium">Session Delegation Protocol</p>
        </div>
      </div>
      <div className="flex items-center space-x-1.5 px-2 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30">
        <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
        <span className="text-[10px] font-semibold text-emerald-400">Gateway Active</span>
      </div>
    </header>
  );
};
