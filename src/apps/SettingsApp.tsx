// src/apps/SettingsApp.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Sun,
  Moon,
  Monitor,
  Check,
  RotateCcw,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Palette,
  Image as ImageIcon,
  Zap,
  Activity,
  X,
  Sparkles,
  Layers,
} from 'lucide-react';
import { sendOSNotification } from '../notificationSystem';

/**
 * Shape of preferences persisted in IndexedDB and localStorage
 */
export type Settings = {
  theme: 'light' | 'dark' | 'system';
  accent: string; // CSS color string like '#ff6600'
  wallpaper: string; // URL or relative path to wallpaper image
  animations: boolean;
  reducedMotion: boolean;
  enable3D: boolean;
};

export type Node = {
  id: string;
  name?: string;
  type: 'folder' | 'file' | 'meta';
  parentId?: string | null;
  size?: number;
  mime?: string;
  content?: string;
};

const DB_NAME = 'nexus-fs';
const STORE_NAME = 'nodes';
const DB_VERSION = 1;

/**
 * Open IndexedDB nexus-fs database
 */
export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieve all nodes from IndexedDB
 */
export function getAllNodes(db: IDBDatabase): Promise<Node[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as Node[]);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Store or update a node in IndexedDB
 */
export function putNode(db: IDBDatabase, node: Node): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(node);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Delete a node from IndexedDB by ID
 */
export function deleteNode(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Utility helper to generate unique IDs
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: '#668b7b',
  wallpaper: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80',
  animations: true,
  reducedMotion: false,
  enable3D: true,
};

const THEME_OPTIONS: { id: 'light' | 'dark' | 'system'; label: string; icon: typeof Sun; description: string }[] = [
  { id: 'light', label: 'Light', icon: Sun, description: 'Bright and crisp styling' },
  { id: 'dark', label: 'Dark', icon: Moon, description: 'Deep, calm tones' },
  { id: 'system', label: 'System', icon: Monitor, description: 'Adapts to OS settings' },
];

const PRESET_ACCENTS: { name: string; value: string }[] = [
  { name: 'Sage Green', value: '#668b7b' },
  { name: 'Sky Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Sunset Orange', value: '#ff6600' },
  { name: 'Rose Pink', value: '#ec4899' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Amber Gold', value: '#eab308' },
  { name: 'Crimson Red', value: '#ef4444' },
];

const PRESET_WALLPAPERS: { id: string; name: string; url: string; thumb: string }[] = [
  {
    id: 'abstract-sculpture',
    name: 'Classic Abstract',
    url: 'abstract',
    thumb: 'abstract',
  },
  {
    id: 'misty-peaks',
    name: 'Misty Alpine',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'minimal-dune',
    name: 'Minimal Dune',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'deep-space',
    name: 'Deep Nebula',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'emerald-forest',
    name: 'Emerald Pines',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'sage-gradient',
    name: 'Sage Gradient',
    url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'fluid-waves',
    name: 'Fluid Waves',
    url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1920&q=80',
    thumb: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=400&q=80',
  },
];

/**
 * Apply settings globally to DOM, CSS variables, and document attributes
 */
function applyGlobalSettings(s: Settings) {
  if (typeof document === 'undefined') return;

  // 1. Theme application (light / dark / system)
  let activeTheme = s.theme;
  if (s.theme === 'system') {
    const isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    activeTheme = isDark ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', activeTheme);
  document.documentElement.dataset.theme = activeTheme;

  // 2. CSS custom property --accent
  document.documentElement.style.setProperty('--accent', s.accent);

  // 3. Class reduced-motion on <html>
  if (s.reducedMotion) {
    document.documentElement.classList.add('reduced-motion');
  } else {
    document.documentElement.classList.remove('reduced-motion');
  }

  // 4. Determine if wallpaper is an image or the classic abstract sculpture
  const isImageWallpaper = Boolean(
    s.wallpaper &&
      s.wallpaper !== 'abstract' &&
      s.wallpaper !== 'default' &&
      s.wallpaper !== 'none' &&
      s.wallpaper.trim().length > 0
  );

  if (isImageWallpaper) {
    document.documentElement.classList.add('has-image-wallpaper');
  } else {
    document.documentElement.classList.remove('has-image-wallpaper');
  }

  const wallpaperEls = document.querySelectorAll<HTMLElement>('.wallpaper');
  wallpaperEls.forEach(el => {
    if (isImageWallpaper) {
      el.style.backgroundImage = `url("${s.wallpaper}")`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    } else {
      el.style.backgroundImage = '';
      el.style.backgroundSize = '';
      el.style.backgroundPosition = '';
    }
  });

  // Inject or update global style block to guarantee styling across elements
  let styleEl = document.getElementById('nexus-settings-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'nexus-settings-style';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    :root {
      --accent: ${s.accent};
      --win-transition: ${s.animations && !s.reducedMotion ? '0.2s' : '0s'};
    }
    ${
      isImageWallpaper
        ? `.wallpaper {
            background-image: url("${s.wallpaper}") !important;
            background-size: cover !important;
            background-position: center !important;
          }
          .sculpture, .workspace-3d-container {
            display: none !important;
          }`
        : `.wallpaper {
            background-image: none !important;
          }`
    }
    .reduced-motion,
    .reduced-motion *,
    .reduced-motion *::before,
    .reduced-motion *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
  `;

  // 5. CSS variable --win-transition (0.2s when animations true and not reducedMotion, else 0s)
  const winTransition = s.animations && !s.reducedMotion ? '0.2s' : '0s';
  document.documentElement.style.setProperty('--win-transition', winTransition);

  // 6. 3D Workspace effect toggle attribute & event
  document.documentElement.dataset.enable3d = s.enable3D ? 'true' : 'false';
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nexus-3d-toggle', { detail: { enabled: s.enable3D } }));
    window.dispatchEvent(
      new CustomEvent('nexus-wallpaper-change', {
        detail: { wallpaper: s.wallpaper, isImage: isImageWallpaper },
      })
    );
  }
}

/**
 * Main SettingsApp Component
 */
export default function SettingsApp() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [db, setDb] = useState<IDBDatabase | null>(null);

  // Loaded/current settings state
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  // Persisted state to track changes for Save button
  const [savedSettings, setSavedSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // Modals & UI status
  const [showResetModal, setShowResetModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Saved!');
  const [customWallpaper, setCustomWallpaper] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Helper to load settings from storage
  const loadStoredSettings = async (database: IDBDatabase): Promise<Settings> => {
    let resolved = { ...DEFAULT_SETTINGS };

    // Try reading from IndexedDB 'settings' node
    try {
      const nodes = await getAllNodes(database);
      const settingsNode = nodes.find(n => n.id === 'settings');
      if (settingsNode && settingsNode.content) {
        const parsed = JSON.parse(settingsNode.content) as Partial<Settings>;
        resolved = {
          theme: parsed.theme || DEFAULT_SETTINGS.theme,
          accent: parsed.accent || DEFAULT_SETTINGS.accent,
          wallpaper: parsed.wallpaper || DEFAULT_SETTINGS.wallpaper,
          animations: parsed.animations !== undefined ? Boolean(parsed.animations) : DEFAULT_SETTINGS.animations,
          reducedMotion: parsed.reducedMotion !== undefined ? Boolean(parsed.reducedMotion) : DEFAULT_SETTINGS.reducedMotion,
          enable3D: parsed.enable3D !== undefined ? Boolean(parsed.enable3D) : DEFAULT_SETTINGS.enable3D,
        };
        return resolved;
      }
    } catch (err) {
      console.warn('Error reading settings from IndexedDB, checking localStorage:', err);
    }

    // Fallback to localStorage
    try {
      const fullJson = localStorage.getItem('nexus-settings');
      if (fullJson) {
        const parsed = JSON.parse(fullJson) as Partial<Settings>;
        resolved = {
          theme: parsed.theme || DEFAULT_SETTINGS.theme,
          accent: parsed.accent || DEFAULT_SETTINGS.accent,
          wallpaper: parsed.wallpaper || DEFAULT_SETTINGS.wallpaper,
          animations: parsed.animations !== undefined ? Boolean(parsed.animations) : DEFAULT_SETTINGS.animations,
          reducedMotion: parsed.reducedMotion !== undefined ? Boolean(parsed.reducedMotion) : DEFAULT_SETTINGS.reducedMotion,
          enable3D: parsed.enable3D !== undefined ? Boolean(parsed.enable3D) : DEFAULT_SETTINGS.enable3D,
        };
        return resolved;
      }

      const storedTheme = localStorage.getItem('nexus-theme');
      if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
        resolved.theme = storedTheme;
      }
      const storedAccent = localStorage.getItem('nexus-accent');
      if (storedAccent) resolved.accent = storedAccent;

      const storedWallpaper = localStorage.getItem('nexus-wallpaper');
      if (storedWallpaper) resolved.wallpaper = storedWallpaper;

      const storedAnimations = localStorage.getItem('nexus-animations');
      if (storedAnimations !== null) resolved.animations = storedAnimations === 'true';

      const storedReduced = localStorage.getItem('nexus-reduced-motion');
      if (storedReduced !== null) resolved.reducedMotion = storedReduced === 'true';

      const stored3D = localStorage.getItem('nexus-enable-3d');
      if (stored3D !== null) resolved.enable3D = stored3D === 'true';
    } catch (err) {
      console.warn('Error reading settings from localStorage:', err);
    }

    return resolved;
  };

  // Mount effect: Open DB and load settings
  useEffect(() => {
    let active = true;

    openDb()
      .then(database => {
        if (!active) return;
        setDb(database);
        return loadStoredSettings(database);
      })
      .then(loaded => {
        if (!active || !loaded) return;
        setSettings(loaded);
        setSavedSettings(loaded);
        applyGlobalSettings(loaded);
      })
      .catch(err => {
        console.error('Failed to initialize settings database:', err);
        // Fallback apply defaults
        applyGlobalSettings(DEFAULT_SETTINGS);
      });

    return () => {
      active = false;
    };
  }, []);

  // Sync system theme changes if theme === 'system'
  useEffect(() => {
    if (settings.theme !== 'system' || typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      applyGlobalSettings(settings);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [settings.theme, settings]);

  // Update setting state, preview globally, and persist to storage
  const updateSettings = (partial: Partial<Settings>) => {
    setSettings(prev => {
      const next: Settings = { ...prev, ...partial };
      applyGlobalSettings(next);

      // Write back to IndexedDB
      if (db) {
        putNode(db, {
          id: 'settings',
          name: 'System Settings',
          type: 'meta',
          parentId: null,
          content: JSON.stringify(next),
        }).catch(err => console.error('Failed to update IndexedDB:', err));
      }

      // Store each field in localStorage for quick reads
      try {
        localStorage.setItem('nexus-settings', JSON.stringify(next));
        localStorage.setItem('nexus-theme', next.theme);
        localStorage.setItem('nexus-accent', next.accent);
        localStorage.setItem('nexus-wallpaper', next.wallpaper);
        localStorage.setItem('nexus-animations', JSON.stringify(next.animations));
        localStorage.setItem('nexus-reduced-motion', JSON.stringify(next.reducedMotion));
        localStorage.setItem('nexus-enable-3d', JSON.stringify(next.enable3D));
      } catch (e) {
        console.warn('Failed to store in localStorage:', e);
      }

      return next;
    });
  };

  // Close window action
  const handleClose = () => {
    if (containerRef.current) {
      const parentWindow = containerRef.current.closest('.application-window');
      if (parentWindow) {
        const closeBtn = parentWindow.querySelector<HTMLButtonElement>('.window-close');
        if (closeBtn) {
          closeBtn.click();
          return;
        }
      }
    }
    window.dispatchEvent(new CustomEvent('nexus-close-window', { detail: { id: 'settings' } }));
    window.dispatchEvent(new CustomEvent('nexus-close-app', { detail: { id: 'settings' } }));
  };

  // Save changes explicitly
  const handleSave = async () => {
    try {
      let database = db;
      if (!database) {
        database = await openDb();
        setDb(database);
      }

      await putNode(database, {
        id: 'settings',
        name: 'System Settings',
        type: 'meta',
        parentId: null,
        content: JSON.stringify(settings),
      });

      localStorage.setItem('nexus-settings', JSON.stringify(settings));
      localStorage.setItem('nexus-theme', settings.theme);
      localStorage.setItem('nexus-accent', settings.accent);
      localStorage.setItem('nexus-wallpaper', settings.wallpaper);
      localStorage.setItem('nexus-animations', JSON.stringify(settings.animations));
      localStorage.setItem('nexus-reduced-motion', JSON.stringify(settings.reducedMotion));
      localStorage.setItem('nexus-enable-3d', JSON.stringify(settings.enable3D));

      applyGlobalSettings(settings);
      setSavedSettings(settings);

      sendOSNotification({
        appName: 'Settings',
        title: 'Settings Saved',
        message: 'Theme and system preferences updated',
      });

      setToastMessage('Saved!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setToastMessage('Error saving settings');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    }
  };

  // Reset to defaults confirmation
  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      let database = db;
      if (!database) {
        database = await openDb();
        setDb(database);
      }

      await deleteNode(database, 'settings');

      localStorage.removeItem('nexus-settings');
      localStorage.removeItem('nexus-theme');
      localStorage.removeItem('nexus-accent');
      localStorage.removeItem('nexus-wallpaper');
      localStorage.removeItem('nexus-animations');
      localStorage.removeItem('nexus-reduced-motion');
      localStorage.removeItem('nexus-enable-3d');

      setSettings(DEFAULT_SETTINGS);
      setSavedSettings(DEFAULT_SETTINGS);
      applyGlobalSettings(DEFAULT_SETTINGS);

      setShowResetModal(false);
      window.location.reload();
    } catch (err) {
      console.error('Failed to reset settings:', err);
      setIsResetting(false);
    }
  };

  // Clear application data confirmation
  const handleConfirmClearData = async () => {
    setIsClearing(true);
    try {
      let database = db;
      if (!database) {
        database = await openDb();
        setDb(database);
      }

      const allNodes = await getAllNodes(database);
      for (const node of allNodes) {
        // Retain only the root folder node
        const isRoot = node.id === 'root' || (node.type === 'folder' && !node.parentId);
        if (!isRoot) {
          await deleteNode(database, node.id);
        }
      }

      localStorage.clear();
      setShowClearModal(false);
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear application data:', err);
      setIsClearing(false);
    }
  };

  // Check if current settings differ from saved settings
  const hasChanges =
    settings.theme !== savedSettings.theme ||
    settings.accent !== savedSettings.accent ||
    settings.wallpaper !== savedSettings.wallpaper ||
    settings.animations !== savedSettings.animations ||
    settings.reducedMotion !== savedSettings.reducedMotion ||
    settings.enable3D !== savedSettings.enable3D;

  // Keyboard navigation for radio group
  const handleThemeKeyDown = (e: React.KeyboardEvent, currentIdx: number) => {
    let nextIdx = currentIdx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIdx = (currentIdx + 1) % THEME_OPTIONS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIdx = (currentIdx - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length;
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      updateSettings({ theme: THEME_OPTIONS[currentIdx].id });
      return;
    }

    if (nextIdx !== currentIdx) {
      const targetId = THEME_OPTIONS[nextIdx].id;
      updateSettings({ theme: targetId });
      const targetEl = document.getElementById(`theme-radio-${targetId}`);
      targetEl?.focus();
    }
  };

  // Apply custom wallpaper
  const handleApplyCustomWallpaper = () => {
    if (!customWallpaper.trim()) return;
    updateSettings({ wallpaper: customWallpaper.trim() });
    setCustomWallpaper('');
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full w-full bg-[#29332d] text-gray-200 select-none overflow-hidden font-sans relative"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 bg-[#232c26]/90 border-b border-white/10 backdrop-blur shrink-0 z-10 pt-[max(0.75rem,env(safe-area-inset-top))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[44px] min-w-[44px] p-2 rounded-xl flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all focus-visible:outline-2 focus-visible:outline-[#668b7b] focus-visible:outline-offset-2"
            aria-label="Close Settings window"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-semibold tracking-wide text-white">Settings</h1>
            <p className="text-xs text-gray-400 hidden sm:block">Personalize and configure your system preferences</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 flex items-center gap-1.5">
            <Sliders size={13} className="text-[#668b7b]" />
            Preferences
          </span>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        {/* Section: Theme */}
        <section aria-labelledby="section-theme" className="space-y-3">
          <div className="flex items-center gap-2">
            <Sun size={17} className="text-[#668b7b]" />
            <h2 id="section-theme" className="text-sm font-semibold tracking-wider uppercase text-gray-300">
              System Theme
            </h2>
          </div>
          <p className="text-xs text-gray-400">Choose between light, dark, or automatic system appearance.</p>

          <div
            role="radiogroup"
            aria-label="Theme selection"
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1"
          >
            {THEME_OPTIONS.map((t, idx) => {
              const isSelected = settings.theme === t.id;
              const IconComp = t.icon;
              return (
                <button
                  key={t.id}
                  id={`theme-radio-${t.id}`}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => updateSettings({ theme: t.id })}
                  onKeyDown={e => handleThemeKeyDown(e, idx)}
                  className={`min-h-[52px] p-3.5 rounded-xl border flex items-center justify-between text-left transition-all focus-visible:outline-2 focus-visible:outline-[#668b7b] focus-visible:outline-offset-2 ${
                    isSelected
                      ? 'border-[#668b7b] bg-[#668b7b]/15 text-white shadow-sm ring-1 ring-[#668b7b]/50'
                      : 'border-white/10 bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`p-2 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-[#668b7b] text-white' : 'bg-black/20 text-gray-400'
                      }`}
                    >
                      <IconComp size={18} />
                    </span>
                    <div>
                      <span className="block text-sm font-medium text-white">{t.label}</span>
                      <span className="block text-[11px] text-gray-400">{t.description}</span>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                      isSelected ? 'border-[#668b7b] bg-[#668b7b]' : 'border-gray-500'
                    }`}
                  >
                    {isSelected && <Check size={13} className="text-white" strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section: Accent Color */}
        <section aria-labelledby="section-accent" className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Palette size={17} className="text-[#668b7b]" />
            <h2 id="section-accent" className="text-sm font-semibold tracking-wider uppercase text-gray-300">
              Accent Color
            </h2>
          </div>
          <p className="text-xs text-gray-400">
            Select a theme accent color for highlights, focus rings, and interface badges.
          </p>

          <div className="space-y-4 pt-1">
            {/* Color circles grid */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {PRESET_ACCENTS.map(accent => {
                const isSelected = settings.accent.toLowerCase() === accent.value.toLowerCase();
                return (
                  <button
                    key={accent.value}
                    type="button"
                    role="button"
                    aria-label={`Select ${accent.name} accent (${accent.value})`}
                    aria-pressed={isSelected}
                    onClick={() => updateSettings({ accent: accent.value })}
                    className="min-h-[44px] min-w-[44px] p-1 flex flex-col items-center justify-center gap-1.5 rounded-xl hover:bg-white/5 transition-colors focus-visible:outline-2 focus-visible:outline-[#668b7b] focus-visible:outline-offset-2"
                  >
                    <span
                      style={{ backgroundColor: accent.value }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-transform ${
                        isSelected ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                      }`}
                    >
                      {isSelected && <Check size={18} className="text-white drop-shadow" strokeWidth={3} />}
                    </span>
                    <span className="text-[10px] text-gray-400 truncate max-w-full">{accent.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Color Picker input */}
            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl max-w-md">
              <label
                htmlFor="custom-accent-picker"
                className="flex items-center gap-2 text-xs font-medium text-gray-300 cursor-pointer"
              >
                <div
                  style={{ backgroundColor: settings.accent }}
                  className="w-7 h-7 rounded-lg border border-white/20 shadow-inner flex items-center justify-center overflow-hidden relative"
                >
                  <input
                    id="custom-accent-picker"
                    type="color"
                    value={settings.accent}
                    onChange={e => updateSettings({ accent: e.target.value })}
                    aria-label="Custom accent color picker"
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </div>
                <span>Custom color:</span>
              </label>
              <input
                type="text"
                value={settings.accent}
                onChange={e => {
                  const val = e.target.value;
                  if (/^#?[0-9A-Fa-f]{0,6}$/.test(val)) {
                    const formatted = val.startsWith('#') ? val : `#${val}`;
                    updateSettings({ accent: formatted });
                  }
                }}
                maxLength={7}
                placeholder="#668b7b"
                aria-label="Hex color value"
                className="min-h-[44px] px-3 py-1.5 bg-black/30 border border-white/15 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-[#668b7b] w-28 uppercase"
              />
              <span className="text-[11px] text-gray-400">Current CSS variable: <code className="text-gray-300">--accent</code></span>
            </div>
          </div>
        </section>

        {/* Section: Wallpaper */}
        <section aria-labelledby="section-wallpaper" className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <ImageIcon size={17} className="text-[#668b7b]" />
            <h2 id="section-wallpaper" className="text-sm font-semibold tracking-wider uppercase text-gray-300">
              Desktop Wallpaper
            </h2>
          </div>
          <p className="text-xs text-gray-400">Choose a background image for your VEGA OS workspace.</p>

          {/* Scrollable horizontal thumbnail list */}
          <div
            role="listbox"
            aria-label="Wallpaper presets"
            className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-thin snap-x touch-pan-x"
          >
            {PRESET_WALLPAPERS.map(wp => {
              const isSelected = settings.wallpaper === wp.url;
              return (
                <button
                  key={wp.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => updateSettings({ wallpaper: wp.url })}
                  className={`min-h-[44px] snap-start shrink-0 w-44 rounded-xl overflow-hidden border text-left transition-all focus-visible:outline-2 focus-visible:outline-[#668b7b] focus-visible:outline-offset-2 ${
                    isSelected
                      ? 'border-[#668b7b] ring-2 ring-[#668b7b] shadow-lg'
                      : 'border-white/10 hover:border-white/30 bg-black/20'
                  }`}
                >
                  <div className="h-24 w-full relative overflow-hidden bg-gray-900 flex items-center justify-center">
                    {wp.thumb === 'abstract' ? (
                      <div className="w-full h-full bg-gradient-to-br from-[#e4e5dd] to-[#b7c0b0] dark:from-[#2d3831] dark:to-[#1a231d] flex items-center justify-center relative overflow-hidden">
                        <div className="w-16 h-20 rounded-[48%] border-2 border-white/60 dark:border-white/20 bg-white/30 dark:bg-white/10 shadow-inner rotate-35" />
                        <div className="absolute inset-2 rounded-[48%] border border-white/40 dark:border-white/10 rotate-35 pointer-events-none" />
                      </div>
                    ) : (
                      <img
                        src={wp.thumb}
                        alt={wp.name}
                        className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                        loading="lazy"
                      />
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 bg-[#668b7b]/30 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="w-7 h-7 rounded-full bg-[#668b7b] flex items-center justify-center text-white shadow-md">
                          <Check size={16} strokeWidth={3} />
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 bg-white/5 flex items-center justify-between">
                    <span className="text-xs font-medium text-white truncate">{wp.name}</span>
                    {isSelected && <span className="text-[10px] text-[#668b7b] font-semibold">Active</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom URL Input */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1 max-w-xl">
            <input
              type="url"
              placeholder="Or enter custom image URL (https://...)"
              value={customWallpaper}
              onChange={e => setCustomWallpaper(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyCustomWallpaper();
                }
              }}
              aria-label="Custom wallpaper image URL"
              className="min-h-[44px] flex-1 px-3.5 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#668b7b]"
            />
            <button
              type="button"
              onClick={handleApplyCustomWallpaper}
              disabled={!customWallpaper.trim()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-[#668b7b] focus-visible:outline-offset-2 shrink-0"
            >
              Apply Image
            </button>
          </div>
        </section>

        {/* Section: Window Animations & Reduced Motion */}
        <section aria-labelledby="section-motion" className="space-y-4 pt-2">
          <div className="flex items-center gap-2">
            <Zap size={17} className="text-[#668b7b]" />
            <h2 id="section-motion" className="text-sm font-semibold tracking-wider uppercase text-gray-300">
              Animation & Accessibility
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Window Animations Switch */}
            <div className="p-4 rounded-xl border border-white/10 bg-white/5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="block text-sm font-medium text-white">Enable window animations</span>
                <p className="text-xs text-gray-400">
                  Enables fluid transitions when opening, resizing, maximizing, and minimizing windows.
                </p>
                <div className="pt-1">
                  <span className="text-[10px] text-gray-400 font-mono">
                    Transition duration: {settings.animations && !settings.reducedMotion ? '0.2s' : '0s'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={settings.animations}
                aria-label="Enable window animations"
                onClick={() => updateSettings({ animations: !settings.animations })}
                onKeyDown={e => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    updateSettings({ animations: !settings.animations });
                  }
                }}
                className={`min-h-[44px] min-w-[44px] p-2 flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-[#668b7b] focus-visible:outline-offset-2 rounded-xl`}
              >
                <span
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    settings.animations ? 'bg-[#668b7b]' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      settings.animations ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            </div>

            {/* Reduced Motion Switch */}
            <div className="p-4 rounded-xl border border-white/10 bg-white/5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Activity size={15} className="text-[#668b7b]" />
                  <span className="block text-sm font-medium text-white">Reduced motion (accessibility)</span>
                </div>
                <p className="text-xs text-gray-400">
                  Disables all desktop, dock, and window animations to accommodate vestibular sensitivity.
                </p>
                <div className="pt-1">
                  <span className="text-[10px] text-gray-400 font-mono">
                    Root class: {settings.reducedMotion ? '.reduced-motion active' : 'None'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={settings.reducedMotion}
                aria-label="Reduced motion (accessibility)"
                onClick={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
                onKeyDown={e => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    updateSettings({ reducedMotion: !settings.reducedMotion });
                  }
                }}
                className={`min-h-[44px] min-w-[44px] p-2 flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-[#668b7b] focus-visible:outline-offset-2 rounded-xl`}
              >
                <span
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    settings.reducedMotion ? 'bg-[#668b7b]' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      settings.reducedMotion ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            </div>

            {/* 3D Spatial Workspace Switch */}
            <div className="p-4 rounded-xl border border-white/10 bg-white/5 flex items-start justify-between gap-4 md:col-span-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Layers size={15} className="text-[#668b7b]" />
                  <span className="block text-sm font-medium text-white">Spatial 3D workspace background</span>
                </div>
                <p className="text-xs text-gray-400">
                  Subtle Three.js spatial background with gentle organic depth and parallax transitions between workspaces. Seamlessly falls back to 2D when disabled, on lower-tier devices, or with reduced motion.
                </p>
                <div className="pt-1">
                  <span className="text-[10px] text-gray-400 font-mono">
                    Status: {settings.enable3D && !settings.reducedMotion ? 'Active (WebGL 3D Accelerated)' : '2D Fallback'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={settings.enable3D}
                aria-label="Spatial 3D workspace background"
                onClick={() => updateSettings({ enable3D: !settings.enable3D })}
                onKeyDown={e => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    updateSettings({ enable3D: !settings.enable3D });
                  }
                }}
                className={`min-h-[44px] min-w-[44px] p-2 flex items-center justify-center shrink-0 focus-visible:outline-2 focus-visible:outline-[#668b7b] focus-visible:outline-offset-2 rounded-xl`}
              >
                <span
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    settings.enable3D ? 'bg-[#668b7b]' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      settings.enable3D ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Section: Management & Danger Zone */}
        <section aria-labelledby="section-system-ops" className="space-y-3 pt-4 border-t border-white/10">
          <h2 id="section-system-ops" className="text-sm font-semibold tracking-wider uppercase text-gray-400">
            System Maintenance
          </h2>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            {/* Reset to defaults button */}
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-gray-200 flex items-center justify-center gap-2 text-xs sm:text-sm font-medium transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-[#668b7b] focus-visible:outline-offset-2"
            >
              <RotateCcw size={16} />
              <span>Reset to defaults</span>
            </button>

            {/* Clear Application Data button */}
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-950/20 hover:bg-red-900/30 text-red-300 hover:text-red-200 flex items-center justify-center gap-2 text-xs sm:text-sm font-medium transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-red-400 focus-visible:outline-offset-2"
            >
              <Trash2 size={16} />
              <span>Clear Application Data</span>
            </button>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="p-3 sm:p-4 bg-[#232c26]/95 border-t border-white/10 backdrop-blur flex items-center justify-between shrink-0 z-10 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-[#668b7b]" />
          <span>{hasChanges ? 'Unsaved changes pending' : 'All preferences synced'}</span>
        </div>

        {/* Save button (disabled if no changes) */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges}
          className={`min-h-[44px] px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-[#668b7b] focus-visible:outline-offset-2 ${
            hasChanges
              ? 'bg-[#668b7b] hover:bg-[#577769] text-white shadow-md'
              : 'bg-white/10 text-gray-500 opacity-40 cursor-not-allowed'
          }`}
          aria-label="Save changes"
        >
          <Save size={16} />
          <span>Save</span>
        </button>
      </footer>

      {/* Toast Notification */}
      {showToast && (
        <div
          role="status"
          aria-live="polite"
          className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-[#1d2621] border border-[#668b7b] text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs sm:text-sm z-50 animate-bounce"
        >
          <CheckCircle2 size={16} className="text-[#668b7b]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modal: Reset to Defaults Confirmation */}
      {showResetModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-[#242e27] border border-white/15 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400">
                <RotateCcw size={20} />
                <h3 id="reset-modal-title" className="text-base font-semibold text-white">
                  Reset to defaults?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                aria-label="Cancel reset"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              This will clear the settings node, reset all UI controls to their original factory defaults, restore default system appearance, and reload the workspace.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs sm:text-sm font-medium text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#668b7b] hover:bg-[#577769] text-xs sm:text-sm font-semibold text-white transition-colors flex items-center gap-1.5"
              >
                {isResetting ? 'Resetting...' : 'Yes, Reset Defaults'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Clear Application Data Warning */}
      {showClearModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-data-modal-title"
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-[#2d1b1d] border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle size={20} />
                <h3 id="clear-data-modal-title" className="text-base font-semibold text-white">
                  Clear Application Data
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                aria-label="Cancel clear data"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl space-y-1">
              <span className="text-xs font-semibold text-red-300 block">Critical Warning:</span>
              <p className="text-xs text-red-200 leading-relaxed">
                This operation will delete all stored user documents, notes, files, and preferences from IndexedDB (excluding the root folder) and completely clear local storage.
              </p>
            </div>

            <p className="text-xs text-gray-300">
              Are you sure you want to proceed? VEGA OS will reload immediately after data deletion.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={isClearing}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs sm:text-sm font-medium text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearData}
                disabled={isClearing}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs sm:text-sm font-semibold text-white transition-colors flex items-center gap-1.5"
              >
                {isClearing ? 'Clearing Data...' : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
