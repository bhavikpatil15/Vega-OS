// src/apps/AboutApp.tsx
import React, { useState, useEffect } from 'react';
import {
  Laptop,
  HardDrive,
  Cpu,
  Monitor,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useWindows } from '../windows/WindowManager';

export default function AboutApp() {
  const { dispatch } = useWindows();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<{ used: string; total: string }>({
    used: 'Calculating...',
    total: 'Calculating...',
  });

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        const usedMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(1);
        const totalMB = ((estimate.quota || 0) / (1024 * 1024)).toFixed(0);
        setStorageInfo({
          used: `${usedMB} MB`,
          total: `${totalMB} MB`,
        });
      }).catch(() => {
        setStorageInfo({ used: '24.5 MB', total: '2,048 MB' });
      });
    } else {
      setStorageInfo({ used: '18.2 MB', total: '1,024 MB' });
    }
  }, []);

  const handleCheckUpdate = () => {
    setCheckingUpdate(true);
    setUpdateMessage(null);
    setTimeout(() => {
      setCheckingUpdate(false);
      setUpdateMessage('VEGA OS is fully up to date. Version 2.0.0 (Build 2026.10).');
    }, 1000);
  };

  const screenDim = typeof window !== 'undefined' ? `${window.screen.width} × ${window.screen.height}` : '1920 × 1080';
  const dpr = typeof window !== 'undefined' ? `${window.devicePixelRatio || 1}x` : '1x';

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 sm:p-6 text-gray-800 dark:text-gray-200">
      {/* Brand Hero */}
      <div className="flex flex-col items-center text-center pb-6 border-b border-black/5 dark:border-white/10">
        <img
          src="/vega-logo.png"
          alt="Vega OS Logo"
          className="w-16 h-16 rounded-2xl shadow-md mb-3 object-cover"
        />
        <h1 className="text-xl sm:text-2xl font-light tracking-tight text-gray-900 dark:text-gray-100">
          VEGA <span className="font-semibold">OS</span>
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Version 2.0.0 • Spatial Web Operating Environment
        </p>
      </div>

      {/* System Specifications Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
        <div className="p-3.5 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 flex items-start gap-3">
          <Cpu className="text-[#668b7b] shrink-0 mt-0.5" size={18} />
          <div className="text-xs">
            <span className="font-semibold block text-gray-700 dark:text-gray-300">Runtime Kernel</span>
            <span className="text-gray-500 dark:text-gray-400">React 19 + TypeScript + Vite</span>
          </div>
        </div>

        <div className="p-3.5 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 flex items-start gap-3">
          <Monitor className="text-[#668b7b] shrink-0 mt-0.5" size={18} />
          <div className="text-xs">
            <span className="font-semibold block text-gray-700 dark:text-gray-300">Display & Graphics</span>
            <span className="text-gray-500 dark:text-gray-400">{screenDim} @ {dpr} (Three.js WebGL)</span>
          </div>
        </div>

        <div className="p-3.5 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 flex items-start gap-3">
          <HardDrive className="text-[#668b7b] shrink-0 mt-0.5" size={18} />
          <div className="text-xs">
            <span className="font-semibold block text-gray-700 dark:text-gray-300">Virtual Storage (VFS)</span>
            <span className="text-gray-500 dark:text-gray-400">{storageInfo.used} used of {storageInfo.total} allocated</span>
          </div>
        </div>

        <div className="p-3.5 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5 flex items-start gap-3">
          <ShieldCheck className="text-[#668b7b] shrink-0 mt-0.5" size={18} />
          <div className="text-xs">
            <span className="font-semibold block text-gray-700 dark:text-gray-300">Security & Sandboxing</span>
            <span className="text-gray-500 dark:text-gray-400">Client-Isolated IndexedDB & PWA Shell</span>
          </div>
        </div>
      </div>

      {/* Update Check & Actions */}
      <div className="mt-auto pt-4 border-t border-black/5 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleCheckUpdate}
            disabled={checkingUpdate}
            className="px-4 py-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 rounded-xl text-xs font-medium flex items-center gap-2 transition min-h-[36px]"
          >
            <RefreshCw size={14} className={checkingUpdate ? 'animate-spin' : ''} />
            <span>{checkingUpdate ? 'Checking...' : 'Check for Updates'}</span>
          </button>

          <button
            onClick={() => dispatch({ type: 'open', id: 'settings' })}
            className="px-4 py-2 bg-[#668b7b] text-white hover:bg-[#557869] rounded-xl text-xs font-medium flex items-center gap-2 transition min-h-[36px]"
          >
            <Settings size={14} />
            <span>OS Preferences</span>
          </button>
        </div>

        <span className="text-[10px] text-gray-400 flex items-center gap-1">
          <Sparkles size={12} className="text-[#668b7b]" /> Designed for calm, uncluttered computing
        </span>
      </div>

      {updateMessage && (
        <div className="mt-3 p-2.5 bg-[#668b7b]/10 text-[#668b7b] dark:text-[#88b3a0] rounded-xl text-xs flex items-center gap-2 border border-[#668b7b]/20 animate-arrive">
          <CheckCircle2 size={16} />
          <span>{updateMessage}</span>
        </div>
      )}
    </div>
  );
}
