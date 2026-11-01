import React, { useEffect, useRef, useState } from 'react';
import {
  Grid2X2,
  Sun,
  Moon,
  Bell,
  BellOff,
  X,
  Search,
  Check,
  SlidersHorizontal,
  Sparkles,
  Layers,
  Wifi,
  WifiOff,
  Volume2,
  Volume1,
  VolumeX,
  Battery,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
  BatteryCharging,
} from 'lucide-react';
import { apps, type AppId } from './apps';
import { WindowLayer, useWindows } from './windows/WindowManager';
import { QuickSettingsPanel } from './components/QuickSettingsPanel';
import { NotificationCenter } from './components/NotificationCenter';
import { UniversalSearch } from './components/UniversalSearch';
import { saveRecentItem } from './searchUtils';
import { useBattery } from './battery';
import {
  loadStoredNotifications,
  saveStoredNotifications,
  isDNDActive,
  setDNDActive,
  sendOSNotification,
  type OSNotification,
} from './notificationSystem';
import { getSystemVolume, setSystemVolume, playSystemSound } from './audio';

const Workspace3D = React.lazy(() => import('./components/Workspace3D'));

function saved(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const { state: windows, dispatch, mobile } = useWindows();
  const battery = useBattery();
  const [theme, setTheme] = useState(() => saved('nexus-theme', 'light'));
  const [wall, setWall] = useState(() => saved('nexus-wall', 'stone'));
  const [now, setNow] = useState(new Date());
  const [panel, setPanel] = useState<'launcher' | 'notifications' | 'appearance' | 'quicksettings' | 'search' | null>(null);
  const [query, setQuery] = useState('');
  
  // Universal Search results for files and notes
  const [searchFiles, setSearchFiles] = useState<{ id: string; name: string; type: string }[]>([]);
  const [searchNotes, setSearchNotes] = useState<{ id: string; title: string; snippet: string }[]>([]);

  useEffect(() => {
    if (!query.trim() || panel !== 'launcher') {
      setSearchFiles([]);
      setSearchNotes([]);
      return;
    }

    const q = query.toLowerCase().trim();

    try {
      const fsReq = indexedDB.open('nexus-fs', 1);
      fsReq.onsuccess = () => {
        const db = fsReq.result;
        if (db.objectStoreNames.contains('nodes')) {
          const tx = db.transaction('nodes', 'readonly');
          const store = tx.objectStore('nodes');
          const getReq = store.getAll();
          getReq.onsuccess = () => {
            const nodes = (getReq.result || []) as Array<{ id: string; name: string; type: string }>;
            const matched = nodes
              .filter(n => n.name && n.name.toLowerCase().includes(q))
              .slice(0, 4)
              .map(n => ({ id: n.id, name: n.name, type: n.type }));
            setSearchFiles(matched);
          };
        }
      };
    } catch {}

    try {
      const notesReq = indexedDB.open('nexus-notes-db', 1);
      notesReq.onsuccess = () => {
        const db = notesReq.result;
        if (db.objectStoreNames.contains('notes')) {
          const tx = db.transaction('notes', 'readonly');
          const store = tx.objectStore('notes');
          const getReq = store.getAll();
          getReq.onsuccess = () => {
            const notesList = (getReq.result || []) as Array<{ id: string; title: string; content: string }>;
            const matched = notesList
              .filter(n => (n.title && n.title.toLowerCase().includes(q)) || (n.content && n.content.toLowerCase().includes(q)))
              .slice(0, 4)
              .map(n => ({
                id: n.id,
                title: n.title,
                snippet: (n.content || '').slice(0, 60),
              }));
            setSearchNotes(matched);
          };
        }
      };
    } catch {}
  }, [query, panel]);
  
  // OS Notifications & DND
  const [notifications, setNotifications] = useState<OSNotification[]>(() => loadStoredNotifications());
  const [dnd, setDndState] = useState<boolean>(() => isDNDActive());
  const [activeToast, setActiveToast] = useState<OSNotification | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Simulated Hardware Settings
  const [simWifi, setSimWifiState] = useState<boolean>(() => saved('nexus-sim-wifi', 'true') !== 'false');
  const [simBluetooth, setSimBluetoothState] = useState<boolean>(() => saved('nexus-sim-bluetooth', 'true') !== 'false');
  const [volume, setVolumeState] = useState<number>(() => getSystemVolume());
  const [brightness, setBrightnessState] = useState<number>(() => {
    try {
      const b = localStorage.getItem('nexus-brightness');
      if (b !== null) {
        const parsed = parseInt(b, 10);
        if (!isNaN(parsed) && parsed >= 30 && parsed <= 100) return parsed;
      }
    } catch {}
    return 100;
  });

  const setDnd = (val: boolean) => {
    setDndState(val);
    setDNDActive(val);
  };

  const setSimWifi = (val: boolean) => {
    setSimWifiState(val);
    try {
      localStorage.setItem('nexus-sim-wifi', JSON.stringify(val));
    } catch {}
  };

  const setSimBluetooth = (val: boolean) => {
    setSimBluetoothState(val);
    try {
      localStorage.setItem('nexus-sim-bluetooth', JSON.stringify(val));
    } catch {}
  };

  const setVolume = (val: number) => {
    setVolumeState(val);
    setSystemVolume(val);
  };

  const setBrightness = (val: number) => {
    setBrightnessState(val);
    try {
      localStorage.setItem('nexus-brightness', String(val));
    } catch {}
  };

  const handleDismissNotification = (id: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      saveStoredNotifications(updated);
      return updated;
    });
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    saveStoredNotifications([]);
  };

  const handleSendTestNotification = () => {
    sendOSNotification({
      appName: 'VEGA OS',
      title: 'Simulated Notification',
      message: 'Quick Settings and Notification Center are running smoothly.',
    });
  };

  // Spatial Workspaces (1: Main, 2: Dev, 3: Focus)
  const [workspace, setWorkspace] = useState<number>(() => {
    try {
      const parsed = parseInt(localStorage.getItem('nexus-active-workspace') || '1', 10);
      return isNaN(parsed) || parsed < 1 || parsed > 3 ? 1 : parsed;
    } catch {
      return 1;
    }
  });

  // 3D Workspace toggle & reduced-motion preferences
  const [enable3D, setEnable3D] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nexus-enable-3d') !== 'false';
    } catch {
      return true;
    }
  });

  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem('nexus-reduced-motion') === 'true' ||
        (typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      );
    } catch {
      return false;
    }
  });

  // Check if wallpaper is a 2D image (custom or preset photo)
  const [hasImageWallpaper, setHasImageWallpaper] = useState<boolean>(() => {
    try {
      const wp = localStorage.getItem('nexus-wallpaper');
      return Boolean(
        wp &&
          wp !== 'abstract' &&
          wp !== 'default' &&
          wp !== 'none' &&
          wp.trim().length > 0
      );
    } catch {
      return false;
    }
  });

  // Online / Offline connectivity detection
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const trigger = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('nexus-theme', theme);
      localStorage.setItem('nexus-wall', wall);
    } catch {}
  }, [theme, wall]);

  useEffect(() => {
    try {
      localStorage.setItem('nexus-active-workspace', String(workspace));
    } catch {}
  }, [workspace]);

  // Listen for setting changes dispatched from SettingsApp
  useEffect(() => {
    const on3DToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ enabled: boolean }>).detail;
      if (detail && typeof detail.enabled === 'boolean') {
        setEnable3D(detail.enabled);
      }
    };
    const onReducedMotion = () => {
      const isReduced =
        localStorage.getItem('nexus-reduced-motion') === 'true' ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setReducedMotion(isReduced);
    };
    const onWallpaperChange = (e: Event) => {
      const detail = (e as CustomEvent<{ wallpaper: string; isImage: boolean }>).detail;
      if (detail && typeof detail.isImage === 'boolean') {
        setHasImageWallpaper(detail.isImage);
      }
    };

    window.addEventListener('nexus-3d-toggle', on3DToggle);
    window.addEventListener('nexus-settings-change', onReducedMotion);
    window.addEventListener('nexus-wallpaper-change', onWallpaperChange);

    // Initial check for wallpaper class on <html>
    try {
      const wp = localStorage.getItem('nexus-wallpaper');
      const isImg = Boolean(
        wp &&
          wp !== 'abstract' &&
          wp !== 'default' &&
          wp !== 'none' &&
          wp.trim().length > 0
      );
      setHasImageWallpaper(isImg);
      if (isImg) {
        document.documentElement.classList.add('has-image-wallpaper');
      } else {
        document.documentElement.classList.remove('has-image-wallpaper');
      }
    } catch {}

    return () => {
      window.removeEventListener('nexus-3d-toggle', on3DToggle);
      window.removeEventListener('nexus-settings-change', onReducedMotion);
      window.removeEventListener('nexus-wallpaper-change', onWallpaperChange);
    };
  }, []);

  // Keyboard navigation & shortcuts
  useEffect(() => {
    if (panel) {
      panelRef.current?.querySelector<HTMLElement>('input,button')?.focus();
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && panel) {
        setPanel(null);
        trigger.current?.focus();
      }
      if (e.key === 'Tab' && panel) {
        const list = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input');
        if (!list?.length) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      // Universal Search shortcut: Cmd+K / Ctrl+K
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPanel(prev => (prev === 'search' ? null : 'search'));
      }

      // Spatial workspace shortcuts: Alt+1, Alt+2, Alt+3
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          setWorkspace(1);
        } else if (e.key === '2') {
          e.preventDefault();
          setWorkspace(2);
        } else if (e.key === '3') {
          e.preventDefault();
          setWorkspace(3);
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [panel]);

  // Click outside to close panel smoothly
  useEffect(() => {
    if (!panel) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        trigger.current &&
        !trigger.current.contains(target)
      ) {
        setPanel(null);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [panel]);

  // Real-time OS notification listener
  useEffect(() => {
    const handleNotifEvent = (e: Event) => {
      const notif = (e as CustomEvent<OSNotification>).detail;
      if (!notif) return;
      setNotifications(prev => {
        const next = [notif, ...prev.filter(n => n.id !== notif.id)].slice(0, 50);
        saveStoredNotifications(next);
        return next;
      });

      // Show toast banner if DND is disabled
      if (!dnd && !isDNDActive()) {
        setActiveToast(notif);
        playSystemSound('notification');
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
          setActiveToast(null);
        }, 4000);
      }
    };

    window.addEventListener('nexus-os-notification', handleNotifEvent);
    return () => {
      window.removeEventListener('nexus-os-notification', handleNotifEvent);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [dnd]);

  function toggle(p: typeof panel, e: React.MouseEvent<HTMLButtonElement>) {
    trigger.current = e.currentTarget;
    setPanel(panel === p ? null : p);
    setQuery('');
  }

  function close() {
    setPanel(null);
    trigger.current?.focus();
  }

  function launch(id: AppId) {
    setPanel(null);
    const appDef = apps.find(a => a.id === id);
    if (appDef) {
      saveRecentItem({ id, type: 'app', title: appDef.name, subtitle: appDef.detail });
    }
    dispatch({ type: 'open', id });
  }

  const clock = now
    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    .replace(/ (AM|PM)$/, '');

  const workspaceEyebrows = [
    'A LITTLE SPACE. ENDLESS POSSIBILITIES.',
    'WORKSPACE 02. CODE & CREATION.',
    'WORKSPACE 03. CALM & CONTEMPLATION.',
  ];

  const workspaceCaptions = [
    <>
      Your world,
      <br />
      <span>at your own pace.</span>
    </>,
    <>
      Deep focus,
      <br />
      <span>build with clarity.</span>
    </>,
    <>
      Quiet space,
      <br />
      <span>uncluttered thought.</span>
    </>,
  ];

  return (
    <main
      className={`desktop wallpaper-${wall} ${
        mobile && windows.activeId ? 'mobile-app-open' : ''
      }`}
    >
      {/* Offline Status Indicator */}
      {!isOnline && (
        <div className="offline-banner" role="status" aria-live="polite">
          <WifiOff size={14} />
          <span>Working Offline — Local files & apps are fully operational</span>
        </div>
      )}

      {/* Screen Brightness Dimming Overlay (Visual Simulation) */}
      {brightness < 100 && (
        <div
          className="desktop-brightness-overlay"
          style={{ opacity: (100 - brightness) * 0.0075 }}
          aria-hidden="true"
        />
      )}

      {/* Real-time Notification Toast Pop-up */}
      {activeToast && !dnd && (
        <div className="floating-toast-container" role="region" aria-label="Notification alerts">
          <div
            className="floating-toast"
            role="alert"
            onClick={() => {
              setPanel('notifications');
              setActiveToast(null);
            }}
          >
            <span className="notif-badge-icon" aria-hidden="true">
              <Sparkles size={16} />
            </span>
            <div className="notif-body">
              <div className="notif-meta flex items-center justify-between">
                <span className="notif-app-tag">{activeToast.appName}</span>
                <span className="notif-time">Just now</span>
              </div>
              <strong className="notif-title">{activeToast.title}</strong>
              <p className="notif-message">{activeToast.message}</p>
            </div>
            <button
              className="notif-dismiss-btn"
              onClick={e => {
                e.stopPropagation();
                setActiveToast(null);
              }}
              aria-label="Dismiss alert"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 2D/3D Background Layer */}
      <div className="wallpaper" aria-hidden="true">
        {!hasImageWallpaper && !enable3D && (
          <div className="sculpture">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        )}
      </div>

      {/* 3D Workspace Objects: only rendered for the abstract theme when 3D is active */}
      {enable3D && !reducedMotion && !hasImageWallpaper && (
        <React.Suspense fallback={null}>
          <Workspace3D
            workspace={workspace}
            theme={theme}
            enabled={enable3D}
            reducedMotion={reducedMotion}
          />
        </React.Suspense>
      )}

      <header className="topbar flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/vega-logo.png"
            alt="Vega"
            className="brand-logo w-6 h-6 rounded-md object-cover shadow-xs"
          />
          <span className="brand">
            VEGA <span>OS</span>
          </span>
          <span className="top-divider" />

          {/* Spatial Workspace Switcher */}
          <div
            className="workspace-switcher"
            role="tablist"
            aria-label="Spatial Workspaces"
          >
            {[
              { id: 1, name: 'Main', title: 'Workspace 1: Main (Alt+1)' },
              { id: 2, name: 'Dev', title: 'Workspace 2: Dev & Tools (Alt+2)' },
              { id: 3, name: 'Focus', title: 'Workspace 3: Focus & Notes (Alt+3)' },
            ].map(ws => (
              <button
                key={ws.id}
                role="tab"
                aria-selected={workspace === ws.id}
                className={`workspace-tab ${workspace === ws.id ? 'is-active' : ''}`}
                onClick={() => setWorkspace(ws.id)}
                title={ws.title}
                aria-label={ws.title}
              >
                <span className="workspace-dot" />
                <span>{ws.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Universal Search Trigger */}
        <button
          className={`topbar-search-btn ${panel === 'search' ? 'active' : ''}`}
          onClick={e => toggle('search', e)}
          aria-label="Universal Search (Cmd+K)"
          title="Universal Search (Cmd+K)"
        >
          <Search size={13} className="text-muted" />
          <span className="search-placeholder">Search apps, files, settings…</span>
          <kbd className="search-kbd">⌘K</kbd>
        </button>

        <div className="flex items-center gap-2 status-area">
          {/* Notification Center Button */}
          <button
            className={`status-btn notification-toggle ${panel === 'notifications' ? 'active' : ''}`}
            aria-label={`Notification Center${notifications.length ? ` (${notifications.length} alerts)` : ''}`}
            aria-expanded={panel === 'notifications'}
            onClick={e => toggle('notifications', e)}
            title="Notification Center"
          >
            {dnd ? <BellOff size={16} /> : <Bell size={16} />}
            {notifications.length > 0 && <span className="notification-dot" />}
          </button>

          {/* Quick Settings Control Center Pill Button */}
          <button
            className={`status-pill quick-settings-toggle ${panel === 'quicksettings' ? 'active' : ''}`}
            aria-label="Quick Settings Control Center"
            aria-expanded={panel === 'quicksettings'}
            onClick={e => toggle('quicksettings', e)}
            title="Quick Settings"
          >
            {simWifi ? <Wifi size={14} /> : <WifiOff size={14} className="opacity-50" />}
            {volume === 0 ? <VolumeX size={14} /> : volume < 50 ? <Volume1 size={14} /> : <Volume2 size={14} />}
            <div
              className="status-battery flex items-center gap-1"
              title={battery.supported ? `Battery: ${battery.level}% (${battery.charging ? 'Charging' : 'On Battery'})` : `Battery: ${battery.level}%`}
            >
              {battery.charging ? (
                <BatteryCharging size={14} className="text-[#668b7b]" />
              ) : battery.level > 75 ? (
                <BatteryFull size={14} />
              ) : battery.level > 25 ? (
                <BatteryMedium size={14} />
              ) : battery.level > 10 ? (
                <BatteryLow size={14} className="text-amber-500" />
              ) : (
                <BatteryWarning size={14} className="text-red-500" />
              )}
              <span className="text-[10px] font-mono font-medium">{battery.level}%</span>
            </div>
          </button>

          {/* Date & Time Button (opens Notification Center) */}
          <button
            className={`status-time-btn ${panel === 'notifications' ? 'active' : ''}`}
            onClick={e => toggle('notifications', e)}
            aria-label="Date and time, open notification center"
            title="Open Notification Center"
          >
            <span className="top-date">
              {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <span className="top-time font-medium">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </button>
        </div>
      </header>

      {/* Desktop Clock & Caption with smooth spatial parallax transitions */}
      <section
        className="desktop-clock"
        style={{
          transform: `translateX(${(workspace - 1) * -8}px)`,
        }}
      >
        <div className="eyebrow">{workspaceEyebrows[workspace - 1] || workspaceEyebrows[0]}</div>
        <time className="clock" dateTime={now.toISOString()}>
          {clock}
          <span>{now.getHours() >= 12 ? 'PM' : 'AM'}</span>
        </time>
        <p>{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </section>

      <div
        className="desktop-caption"
        style={{
          transform: `translateX(${(workspace - 1) * -8}px)`,
        }}
      >
        <span className="caption-line" />
        <p>{workspaceCaptions[workspace - 1] || workspaceCaptions[0]}</p>
      </div>

      <button
        className="wallpaper-button flex items-center gap-2"
        onClick={e => toggle('appearance', e)}
        aria-expanded={panel === 'appearance'}
      >
        <SlidersHorizontal size={14} />
        <span>Make it yours</span>
      </button>

      {/* Window Manager Layer */}
      <WindowLayer blocked={!!panel} />

      {/* Universal Search Spotlight Modal */}
      <UniversalSearch
        isOpen={panel === 'search'}
        onClose={close}
        onOpenApp={launch}
        onOpenQuickSettings={() => setPanel('quicksettings')}
        onOpenFileInEditor={() => launch('editor')}
      />

      {panel && panel !== 'search' && <div className="backdrop" onClick={close} />}

      {panel && panel !== 'search' && (
        <section
          ref={panelRef}
          className={`panel ${panel}`}
          role="dialog"
          aria-modal="true"
          aria-label={
            panel === 'launcher'
              ? 'Application launcher'
              : panel === 'appearance'
              ? 'Appearance'
              : panel === 'quicksettings'
              ? 'Quick Settings Control Center'
              : 'Notification Center'
          }
        >
          {(panel === 'launcher' || panel === 'appearance') && (
            <div className="panel-heading flex items-center justify-between">
              <div>
                <div className="eyebrow">YOUR VEGA</div>
                <h2>
                  {panel === 'launcher'
                    ? 'A place for everything.'
                    : 'Make yourself at home.'}
                </h2>
              </div>
              <button className="icon-button" aria-label="Close panel" onClick={close}>
                <X size={19} />
              </button>
            </div>
          )}

          {panel === 'launcher' && (
            <>
              <label className="search flex items-center gap-3">
                <Search size={17} />
                <input
                  aria-label="Universal Search across apps, files and notes"
                  placeholder="Search applications, files, notes… (Cmd+K)"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  autoFocus={!mobile}
                />
                <span className="text-[10px] text-muted font-mono">⌘K</span>
              </label>

              {!query.trim() ? (
                <>
                  <div className="section-label">
                    APPLICATIONS <span>ALL APPS</span>
                  </div>
                  <div className="app-grid">
                    {apps.map(a => (
                      <button
                        key={a.id}
                        className="app-card"
                        onClick={() => launch(a.id)}
                      >
                        <span className={`app-icon ${a.color}`}>
                          <a.icon size={25} />
                        </span>
                        <strong>{a.name}</strong>
                        <small>
                          {windows.windows.some(w => w.id === a.id) ? 'Open' : 'Preview'}
                        </small>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="universal-search-results space-y-4 my-3 max-h-[360px] overflow-y-auto pr-1">
                  {/* Matching Apps */}
                  {apps.some(a => a.name.toLowerCase().includes(query.toLowerCase()) || a.detail.toLowerCase().includes(query.toLowerCase())) && (
                    <div>
                      <div className="section-label">APPLICATIONS</div>
                      <div className="grid grid-cols-2 gap-2">
                        {apps
                          .filter(a => a.name.toLowerCase().includes(query.toLowerCase()) || a.detail.toLowerCase().includes(query.toLowerCase()))
                          .map(a => (
                            <button
                              key={a.id}
                              className="flex items-center gap-2.5 p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-left transition"
                              onClick={() => launch(a.id)}
                            >
                              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.color} shrink-0`}>
                                <a.icon size={16} />
                              </span>
                              <div className="min-w-0">
                                <strong className="text-xs block truncate text-ink">{a.name}</strong>
                                <small className="text-[10px] text-muted block truncate">{a.detail}</small>
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Files */}
                  {searchFiles.length > 0 && (
                    <div>
                      <div className="section-label">FILES & DOCUMENTS</div>
                      <div className="space-y-1.5">
                        {searchFiles.map(f => (
                          <button
                            key={f.id}
                            className="w-full flex items-center justify-between p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-left transition text-xs"
                            onClick={() => {
                              close();
                              launch('files');
                            }}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <span className="text-[#668b7b]">📄</span>
                              <span className="font-medium text-ink truncate">{f.name}</span>
                            </span>
                            <span className="text-[10px] text-muted font-mono uppercase">{f.type}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Notes */}
                  {searchNotes.length > 0 && (
                    <div>
                      <div className="section-label">NOTES</div>
                      <div className="space-y-1.5">
                        {searchNotes.map(n => (
                          <button
                            key={n.id}
                            className="w-full flex items-start gap-2 p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-left transition text-xs"
                            onClick={() => {
                              close();
                              launch('notes');
                            }}
                          >
                            <span className="text-purple-500 shrink-0 mt-0.5">📝</span>
                            <div className="min-w-0 flex-1">
                              <span className="font-medium block text-ink truncate">{n.title}</span>
                              <span className="text-[10px] text-muted block truncate">{n.snippet || 'Note entry'}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* System Shortcuts */}
                  {('settings'.includes(query.toLowerCase()) || 'quick settings'.includes(query.toLowerCase()) || 'appearance'.includes(query.toLowerCase())) && (
                    <div>
                      <div className="section-label">SYSTEM SHORTCUTS</div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => launch('settings')}
                          className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs flex items-center gap-1.5"
                        >
                          <SlidersHorizontal size={13} />
                          <span>Open Settings</span>
                        </button>
                        <button
                          onClick={e => toggle('quicksettings', e as any)}
                          className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs flex items-center gap-1.5"
                        >
                          <Sun size={13} />
                          <span>Quick Settings</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Empty state when nothing matches */}
                  {!apps.some(a => a.name.toLowerCase().includes(query.toLowerCase()) || a.detail.toLowerCase().includes(query.toLowerCase())) &&
                    searchFiles.length === 0 &&
                    searchNotes.length === 0 && (
                      <div className="empty py-8 text-center text-xs text-muted">
                        No applications, files, or notes matching "{query}".
                      </div>
                    )}
                </div>
              )}

              <div className="panel-foot">
                <span className="status-dot" /> Universal Search • Applications, Files & Notes
              </div>
            </>
          )}

          {panel === 'notifications' && (
            <NotificationCenter
              notifications={notifications}
              onDismiss={handleDismissNotification}
              onClearAll={handleClearAllNotifications}
              onClose={close}
              dnd={dnd}
              setDnd={setDnd}
              onSendTestNotification={handleSendTestNotification}
            />
          )}

          {panel === 'quicksettings' && (
            <QuickSettingsPanel
              onClose={close}
              onOpenSettings={() => launch('settings')}
              theme={theme}
              setTheme={setTheme}
              dnd={dnd}
              setDnd={setDnd}
              simWifi={simWifi}
              setSimWifi={setSimWifi}
              simBluetooth={simBluetooth}
              setSimBluetooth={setSimBluetooth}
              volume={volume}
              setVolume={setVolume}
              brightness={brightness}
              setBrightness={setBrightness}
              now={now}
              battery={battery}
            />
          )}

          {panel === 'appearance' && (
            <>
              <div className="section-label">WALLPAPER STYLE</div>
              <div className="wall-options">
                {['stone', 'sage', 'dusk'].map(w => (
                  <button
                    key={w}
                    aria-pressed={wall === w}
                    onClick={() => setWall(w)}
                  >
                    <span className={`swatch swatch-${w}`}>
                      {wall === w && <Check size={20} />}
                    </span>
                    <span>{w[0].toUpperCase() + w.slice(1)}</span>
                  </button>
                ))}
              </div>

              {/* 3D Spatial Workspace Quick Toggle */}
              <div className="theme-row">
                <div>
                  <strong>3D Spatial Workspace</strong>
                  <p>Restrained depth & smooth spatial transitions.</p>
                </div>
                <button
                  className="theme-switch"
                  onClick={() => {
                    const next = !enable3D;
                    setEnable3D(next);
                    try {
                      localStorage.setItem('nexus-enable-3d', JSON.stringify(next));
                      window.dispatchEvent(
                        new CustomEvent('nexus-3d-toggle', { detail: { enabled: next } })
                      );
                    } catch {}
                  }}
                  aria-pressed={enable3D}
                >
                  <Layers size={16} /> {enable3D ? 'Enabled (3D)' : '2D Only'}
                </button>
              </div>

              <div className="theme-row">
                <div>
                  <strong>Appearance</strong>
                  <p>A lighter day or a quieter night.</p>
                </div>
                <button
                  className="theme-switch"
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                >
                  {theme === 'light' ? <Sun size={16} /> : <Moon size={16} />}{' '}
                  {theme === 'light' ? 'Light' : 'Dark'}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* Dock */}
      <div className="dock-wrap">
        <nav className="dock" aria-label="Desktop dock">
          <button
            className={`dock-button launcher-button ${panel === 'launcher' ? 'active' : ''}`}
            aria-label="Open application launcher"
            aria-expanded={panel === 'launcher'}
            onClick={e => toggle('launcher', e)}
          >
            <Grid2X2 size={24} />
            <span className="tooltip">Launcher</span>
          </button>
          <div className="dock-separator" />
          {apps.map(a => (
            <button
              className={`dock-button ${a.color} ${
                windows.windows.some(w => w.id === a.id) ? 'is-open' : ''
              } ${windows.activeId === a.id ? 'is-selected' : ''}`}
              key={a.id}
              data-dock-app={a.id}
              aria-label={`Open ${a.name}`}
              aria-pressed={windows.activeId === a.id}
              onClick={() => launch(a.id)}
            >
              <a.icon size={25} />
              <span className="tooltip">{a.name}</span>
            </button>
          ))}
        </nav>
        <span className="dock-caption">
          VEGA OS <span>•</span> A SPACE OF YOUR OWN
        </span>
      </div>
    </main>
  );
}
