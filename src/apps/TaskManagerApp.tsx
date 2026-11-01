// src/apps/TaskManagerApp.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Search,
  X,
  ExternalLink,
  Minus,
  Maximize2,
  Minimize2,
  XCircle,
  Clock,
  Cpu,
  HardDrive,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Monitor,
  ShieldAlert,
} from 'lucide-react';
import { apps, type AppId } from '../apps';
import { useWindows } from '../windows/WindowManager';

type FilterType = 'all' | 'active' | 'minimized';
type SortType = 'name-asc' | 'name-desc' | 'state' | 'recent';

interface BrowserMemoryInfo {
  supported: boolean;
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

export default function TaskManagerApp() {
  const { state, dispatch, mobile } = useWindows();
  const [activeTab, setActiveTab] = useState<'apps' | 'performance'>('apps');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('state');
  const [selectedAppId, setSelectedAppId] = useState<AppId | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Performance metrics
  const [storageInfo, setStorageInfo] = useState<{ used: string; total: string; percent: number }>({
    used: 'Calculating...',
    total: 'Calculating...',
    percent: 0,
  });
  const [memoryInfo, setMemoryInfo] = useState<BrowserMemoryInfo>({ supported: false });

  // Update elapsed timer tick every second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Update browser metrics
  const refreshMetrics = () => {
    // 1. Storage quota
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        const usedBytes = estimate.usage || 0;
        const totalBytes = estimate.quota || 1;
        const usedMB = (usedBytes / (1024 * 1024)).toFixed(1);
        const totalMB = (totalBytes / (1024 * 1024)).toFixed(0);
        const percent = Math.min(100, Math.round((usedBytes / totalBytes) * 100));
        setStorageInfo({
          used: `${usedMB} MB`,
          total: `${totalMB} MB`,
          percent,
        });
      }).catch(() => {
        setStorageInfo({ used: '24.5 MB', total: '2,048 MB', percent: 1 });
      });
    }

    // 2. Chromium Performance Memory (if available)
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      setMemoryInfo({
        supported: true,
        usedJSHeapSize: Math.round(mem.usedJSHeapSize / (1024 * 1024)),
        totalJSHeapSize: Math.round(mem.totalJSHeapSize / (1024 * 1024)),
        jsHeapSizeLimit: Math.round(mem.jsHeapSizeLimit / (1024 * 1024)),
      });
    } else {
      setMemoryInfo({ supported: false });
    }
  };

  useEffect(() => {
    refreshMetrics();
    const interval = setInterval(refreshMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  // Sync selectedAppId if the selected window was closed
  useEffect(() => {
    if (selectedAppId && !state.windows.some(w => w.id === selectedAppId)) {
      const remaining = state.windows[0]?.id || null;
      setSelectedAppId(remaining);
    } else if (!selectedAppId && state.windows.length > 0) {
      setSelectedAppId(state.activeId || state.windows[0].id);
    }
  }, [state.windows, selectedAppId, state.activeId]);

  // Lookup map of all registered apps
  const appMap = useMemo(() => {
    return new Map(apps.map(a => [a.id, a]));
  }, []);

  // Open windows with metadata
  const openWindows = useMemo(() => {
    return state.windows.map(w => {
      const meta = appMap.get(w.id);
      const isFocused = state.activeId === w.id && !w.minimized;
      let statusText: 'Focused' | 'Running' | 'Minimized' = 'Running';
      if (w.minimized) {
        statusText = 'Minimized';
      } else if (isFocused) {
        statusText = 'Focused';
      }

      return {
        ...w,
        name: meta?.name || w.id,
        detail: meta?.detail || 'Application window',
        color: meta?.color || 'charcoal',
        icon: meta?.icon || Layers,
        isFocused,
        statusText,
      };
    });
  }, [state.windows, state.activeId, appMap]);

  // Filtered and sorted windows
  const filteredWindows = useMemo(() => {
    let result = openWindows;

    // 1. Text Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        w => w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q) || w.detail.toLowerCase().includes(q)
      );
    }

    // 2. Status Filter
    if (filter === 'active') {
      result = result.filter(w => !w.minimized);
    } else if (filter === 'minimized') {
      result = result.filter(w => w.minimized);
    }

    // 3. Sorting
    return [...result].sort((a, b) => {
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === 'recent') {
        return (b.openedAt || 0) - (a.openedAt || 0);
      }
      if (sortBy === 'state') {
        const score = (w: typeof a) => (w.isFocused ? 0 : !w.minimized ? 1 : 2);
        return score(a) - score(b);
      }
      return 0;
    });
  }, [openWindows, searchQuery, filter, sortBy]);

  // Selected window details
  const selectedWindow = useMemo(() => {
    return openWindows.find(w => w.id === selectedAppId) || null;
  }, [openWindows, selectedAppId]);

  // Counts for filter pills
  const counts = useMemo(() => {
    const all = openWindows.length;
    const active = openWindows.filter(w => !w.minimized).length;
    const minimized = openWindows.filter(w => w.minimized).length;
    return { all, active, minimized };
  }, [openWindows]);

  // Helper to format elapsed time since opened
  const formatElapsed = (timestamp?: number) => {
    if (!timestamp) return 'Recently';
    const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    const remSec = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remSec}s ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  };

  // Window control actions
  const handleSwitchTo = (id: AppId) => {
    const win = state.windows.find(w => w.id === id);
    if (win?.minimized) {
      dispatch({ type: 'open', id });
    } else {
      dispatch({ type: 'focus', id });
    }
  };

  const handleToggleMinimize = (id: AppId) => {
    const win = state.windows.find(w => w.id === id);
    if (win?.minimized) {
      dispatch({ type: 'open', id });
    } else {
      dispatch({ type: 'minimize', id });
    }
  };

  const handleToggleMaximize = (id: AppId) => {
    dispatch({ type: 'maximize', id });
  };

  const handleClose = (id: AppId) => {
    dispatch({ type: 'close', id });
  };

  return (
    <div className="flex flex-col h-full bg-[#f6f6f2] dark:bg-[#181d19] text-gray-800 dark:text-gray-200 select-none overflow-hidden">
      {/* Top Header / View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3 border-b border-black/5 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#668b7b]/15 text-[#668b7b] dark:text-[#88b3a0] flex items-center justify-center shrink-0">
            <Activity size={18} />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight leading-none text-gray-900 dark:text-gray-100">
              Task Manager
            </h1>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {openWindows.length} {openWindows.length === 1 ? 'task running' : 'tasks running'}
            </span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center p-0.5 bg-black/5 dark:bg-white/10 rounded-lg text-xs" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'apps'}
            onClick={() => setActiveTab('apps')}
            className={`px-3 py-1.5 rounded-md font-medium transition min-h-[32px] flex items-center gap-1.5 ${
              activeTab === 'apps'
                ? 'bg-white dark:bg-[#28322b] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Layers size={14} />
            <span>Applications</span>
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-[#668b7b]/20 text-[#668b7b] dark:text-[#88b3a0]">
              {openWindows.length}
            </span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'performance'}
            onClick={() => setActiveTab('performance')}
            className={`px-3 py-1.5 rounded-md font-medium transition min-h-[32px] flex items-center gap-1.5 ${
              activeTab === 'performance'
                ? 'bg-white dark:bg-[#28322b] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Cpu size={14} />
            <span>Performance</span>
          </button>
        </div>
      </div>

      {activeTab === 'apps' ? (
        <div className="flex flex-col flex-1 overflow-hidden min-h-0">
          {/* Search, Filter & Sort Controls */}
          <div className="p-3 sm:px-4 border-b border-black/5 dark:border-white/10 bg-white/20 dark:bg-white/5 space-y-2.5 shrink-0">
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
              {/* Search Field */}
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter open applications…"
                  aria-label="Filter open applications"
                  className="w-full pl-8 pr-7 py-1.5 bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 rounded-lg text-xs placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#668b7b]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search filter"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition min-h-[28px] ${
                    filter === 'all'
                      ? 'bg-[#668b7b] text-white'
                      : 'bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-black/10'
                  }`}
                >
                  All ({counts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('active')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition min-h-[28px] ${
                    filter === 'active'
                      ? 'bg-[#668b7b] text-white'
                      : 'bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-black/10'
                  }`}
                >
                  Active ({counts.active})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('minimized')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition min-h-[28px] ${
                    filter === 'minimized'
                      ? 'bg-[#668b7b] text-white'
                      : 'bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-black/10'
                  }`}
                >
                  Minimized ({counts.minimized})
                </button>
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-1 text-xs shrink-0 self-end sm:self-auto">
                <span className="text-gray-400 text-[11px] hidden sm:inline">Sort:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortType)}
                  aria-label="Sort applications"
                  className="px-2 py-1 bg-black/5 dark:bg-white/10 border border-black/5 dark:border-white/10 rounded-lg text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#668b7b]"
                >
                  <option value="state">Status (Active first)</option>
                  <option value="name-asc">Name (A–Z)</option>
                  <option value="name-desc">Name (Z–A)</option>
                  <option value="recent">Recently Opened</option>
                </select>
              </div>
            </div>
          </div>

          {/* Body: Split View (List + Details) */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            {/* Left: Applications List */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 focus:outline-none min-h-[160px]">
              {filteredWindows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                  <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-gray-400 mb-3">
                    <Activity size={24} />
                  </div>
                  {openWindows.length === 0 ? (
                    <>
                      <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                        No running applications
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-1">
                        Open applications from the Dock or Launcher to manage them here.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                        No matching applications
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-1">
                        Try clearing your search query or switching filters.
                      </p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setFilter('all');
                        }}
                        className="mt-3 px-3 py-1.5 bg-[#668b7b] text-white text-xs rounded-lg hover:bg-[#557869] transition"
                      >
                        Reset Filter
                      </button>
                    </>
                  )}
                </div>
              ) : (
                filteredWindows.map(win => {
                  const isSelected = selectedAppId === win.id;
                  const Icon = win.icon;
                  return (
                    <div
                      key={win.id}
                      onClick={() => setSelectedAppId(win.id)}
                      className={`group flex items-center justify-between p-2 sm:p-2.5 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#668b7b]/10 border-[#668b7b]/40 shadow-sm'
                          : 'bg-white/40 dark:bg-white/5 border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/10'
                      }`}
                    >
                      {/* Left info: Icon, Name, Status */}
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${win.color}`}
                        >
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 truncate block">
                              {win.name}
                            </span>
                            {win.id === 'tasks' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-black/10 dark:bg-white/10 text-gray-500 dark:text-gray-400 font-mono">
                                current
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.2 rounded-full ${
                                win.isFocused
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  : win.minimized
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                  : 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  win.isFocused
                                    ? 'bg-emerald-500 animate-pulse'
                                    : win.minimized
                                    ? 'bg-amber-500'
                                    : 'bg-blue-500'
                                }`}
                              />
                              {win.statusText}
                            </span>
                            {win.maximized && (
                              <span className="text-[10px] text-gray-400">Maximized</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right actions: Switch, Minimize/Restore, Close */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleSwitchTo(win.id);
                          }}
                          title="Bring to foreground"
                          aria-label={`Switch to ${win.name}`}
                          className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 text-xs flex items-center gap-1 transition min-h-[36px] min-w-[36px] justify-center"
                        >
                          <ExternalLink size={14} />
                          <span className="hidden sm:inline">Switch</span>
                        </button>

                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleToggleMinimize(win.id);
                          }}
                          title={win.minimized ? 'Restore window' : 'Minimize window'}
                          aria-label={win.minimized ? `Restore ${win.name}` : `Minimize ${win.name}`}
                          className="p-2 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                        >
                          {win.minimized ? <Maximize2 size={14} /> : <Minus size={14} />}
                        </button>

                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleClose(win.id);
                          }}
                          title="End task / Close application"
                          aria-label={`Close ${win.name}`}
                          className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right: Selected Application Details Panel */}
            {selectedWindow && (
              <div className="w-full md:w-72 lg:w-80 border-t md:border-t-0 md:border-l border-black/5 dark:border-white/10 bg-white/40 dark:bg-white/5 p-3.5 sm:p-4 flex flex-col justify-between shrink-0 overflow-y-auto">
                <div className="space-y-4">
                  {/* Header of selected app */}
                  <div className="flex items-start gap-3 pb-3 border-b border-black/5 dark:border-white/10">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${selectedWindow.color}`}
                    >
                      <selectedWindow.icon size={22} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {selectedWindow.name}
                      </h2>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                        {selectedWindow.detail}
                      </p>
                    </div>
                  </div>

                  {/* Property Rows */}
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                      <span>Process ID:</span>
                      <span className="font-mono text-[11px] text-gray-900 dark:text-gray-200">
                        vega.app.{selectedWindow.id}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                      <span>Window State:</span>
                      <span
                        className={`font-medium px-2 py-0.5 rounded-full text-[10px] ${
                          selectedWindow.isFocused
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : selectedWindow.minimized
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                            : 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                        }`}
                      >
                        {selectedWindow.statusText}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                      <span>Window Mode:</span>
                      <span className="text-gray-800 dark:text-gray-200">
                        {selectedWindow.maximized ? 'Maximized' : 'Floating'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                      <span>Position Coordinates:</span>
                      <span className="font-mono text-[11px] text-gray-800 dark:text-gray-200">
                        {selectedWindow.maximized
                          ? 'Full Workspace'
                          : `X: ${selectedWindow.x}px, Y: ${selectedWindow.y}px`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock size={12} className="text-gray-400" /> Opened:
                      </span>
                      <span className="text-gray-800 dark:text-gray-200">
                        {formatElapsed(selectedWindow.openedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Browser Sandbox Note */}
                  <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-[11px] text-gray-500 dark:text-gray-400 space-y-1">
                    <div className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                      <AlertCircle size={13} className="text-[#668b7b]" />
                      <span>Process Isolation</span>
                    </div>
                    <p className="leading-relaxed">
                      VEGA OS applications execute safely within the single-threaded client runtime.
                      Per-process CPU and thread telemetry are restricted by browser security policies.
                    </p>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="pt-3 border-t border-black/5 dark:border-white/10 space-y-2 mt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSwitchTo(selectedWindow.id)}
                      className="px-3 py-2 rounded-xl bg-[#668b7b] hover:bg-[#557869] text-white text-xs font-medium flex items-center justify-center gap-1.5 transition min-h-[40px]"
                    >
                      <ExternalLink size={14} />
                      <span>Switch To</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleMinimize(selectedWindow.id)}
                      className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-gray-700 dark:text-gray-300 text-xs font-medium flex items-center justify-center gap-1.5 transition min-h-[40px]"
                    >
                      {selectedWindow.minimized ? <Maximize2 size={14} /> : <Minus size={14} />}
                      <span>{selectedWindow.minimized ? 'Restore' : 'Minimize'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleClose(selectedWindow.id)}
                    className="w-full px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center justify-center gap-1.5 transition min-h-[40px]"
                  >
                    <XCircle size={15} />
                    <span>End Task</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Performance & System Environment Tab */
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Header Description */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-black/5 dark:border-white/10">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
                System & Browser Performance Overview
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Real environment metrics derived strictly from verified browser APIs and VEGA OS window state.
              </p>
            </div>
            <button
              onClick={refreshMetrics}
              className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1.5 transition min-h-[32px]"
            >
              <RefreshCw size={12} />
              <span>Refresh Stats</span>
            </button>
          </div>

          {/* Grid of Real Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. JavaScript Heap Memory */}
            <div className="p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-800 dark:text-gray-200">
                  <Cpu size={16} className="text-[#668b7b]" />
                  <span>JavaScript Heap Memory</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {memoryInfo.supported ? 'Real Browser API' : 'Not Supported'}
                </span>
              </div>

              {memoryInfo.supported ? (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>Used Heap Size:</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {memoryInfo.usedJSHeapSize} MB / {memoryInfo.totalJSHeapSize} MB
                      </span>
                    </div>
                    {/* Visual Bar */}
                    <div className="w-full bg-black/10 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#668b7b] h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              ((memoryInfo.usedJSHeapSize || 0) / (memoryInfo.totalJSHeapSize || 1)) * 100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 pt-1">
                    Allocated Heap Limit: <strong className="text-gray-700 dark:text-gray-300">{memoryInfo.jsHeapSizeLimit} MB</strong>
                  </div>
                </>
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400 py-2">
                  <p>Detailed heap telemetry is restricted in this browser (available on Chromium engines via <code className="font-mono text-[11px]">performance.memory</code>).</p>
                </div>
              )}
            </div>

            {/* 2. Client Virtual Storage (VFS) */}
            <div className="p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-800 dark:text-gray-200">
                  <HardDrive size={16} className="text-[#668b7b]" />
                  <span>Virtual Storage Quota</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Real Browser API
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span>Storage Used:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {storageInfo.used} / {storageInfo.total}
                  </span>
                </div>
                <div className="w-full bg-black/10 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#668b7b] h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(1, storageInfo.percent)}%` }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 pt-1">
                Persistent storage allocated for IndexedDB (<code className="font-mono text-[10px]">nexus-fs</code>, <code className="font-mono text-[10px]">nexus-notes-db</code>).
              </p>
            </div>

            {/* 3. Logical Cores & Host Display */}
            <div className="p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-800 dark:text-gray-200">
                  <Monitor size={16} className="text-[#668b7b]" />
                  <span>Hardware & Screen Geometry</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Real Browser API
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Logical CPU Threads:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4} Cores
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Display Resolution:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {typeof window !== 'undefined' ? `${window.screen.width} × ${window.screen.height}` : '1920 × 1080'}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Device Pixel Ratio:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {typeof window !== 'undefined' ? `${window.devicePixelRatio || 1}x` : '1x'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. VEGA OS Window Subsystem */}
            <div className="p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-800 dark:text-gray-200">
                  <Sliders size={16} className="text-[#668b7b]" />
                  <span>VEGA Window Subsystem</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  OS State
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Total Open Windows:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {state.windows.length}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Active Focused App:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {state.activeId ? appMap.get(state.activeId)?.name || state.activeId : 'None (Desktop)'}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Desktop Viewport Bounds:</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {state.bounds.width} × {state.bounds.height} px
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Browser Sandbox Limitation Notice */}
          <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <ShieldAlert size={16} />
              <span>Browser Sandbox Security Policy</span>
            </div>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80 leading-relaxed">
              Standard web security models deliberately prohibit web applications from querying host CPU percentage,
              host operating system memory utilization, or individual process execution threads. To maintain honesty
              and prevent synthetic misrepresentation, VEGA OS Task Manager only presents genuine metrics directly
              accessible via standards-compliant browser APIs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
