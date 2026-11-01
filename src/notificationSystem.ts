// src/notificationSystem.ts
/**
 * Operating System Notification System for VEGA OS.
 * Manages notification storage, dispatching, dismissal, and Do Not Disturb (DND) modes.
 */

export interface OSNotification {
  id: string;
  appName: string;
  title: string;
  message: string;
  timestamp: number;
}

const STORAGE_KEY = 'nexus-notifications';
const DND_STORAGE_KEY = 'nexus-dnd';

const INITIAL_NOTIFICATIONS: OSNotification[] = [
  {
    id: 'welcome-system-01',
    appName: 'System',
    title: 'Welcome to VEGA OS',
    message: 'Your personal workspace is ready. Experience calm, focused computing.',
    timestamp: Date.now() - 1000 * 60 * 5, // 5 minutes ago
  },
  {
    id: 'welcome-system-02',
    appName: 'Files',
    title: 'Storage Ready',
    message: 'Virtual file system mounted with IndexedDB persistence.',
    timestamp: Date.now() - 1000 * 60 * 2, // 2 minutes ago
  },
];

/**
 * Load persisted notifications from localStorage.
 */
export function loadStoredNotifications(): OSNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_NOTIFICATIONS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {}
  return INITIAL_NOTIFICATIONS;
}

/**
 * Save notifications list to localStorage.
 */
export function saveStoredNotifications(notifications: OSNotification[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {}
}

/**
 * Check if Do Not Disturb mode is active.
 */
export function isDNDActive(): boolean {
  try {
    return localStorage.getItem(DND_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Set Do Not Disturb mode.
 */
export function setDNDActive(enabled: boolean): void {
  try {
    localStorage.setItem(DND_STORAGE_KEY, JSON.stringify(enabled));
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nexus-dnd-change', { detail: { enabled } }));
  }
}

/**
 * Dispatch an OS-wide notification from any application.
 */
export function sendOSNotification(
  input: Omit<OSNotification, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
): OSNotification {
  const notif: OSNotification = {
    id: input.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    appName: input.appName || 'System',
    title: input.title,
    message: input.message,
    timestamp: input.timestamp || Date.now(),
  };

  // Persist into stored notifications
  const existing = loadStoredNotifications();
  const updated = [notif, ...existing.filter(n => n.id !== notif.id)].slice(0, 50); // limit to 50
  saveStoredNotifications(updated);

  // Dispatch custom window event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nexus-os-notification', { detail: notif }));
  }

  return notif;
}
