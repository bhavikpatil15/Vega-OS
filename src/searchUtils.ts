// src/searchUtils.ts
/**
 * Search and Recent Items Utilities for VEGA OS Universal Search.
 */

export interface RecentItem {
  id: string;
  type: 'app' | 'file' | 'setting';
  title: string;
  subtitle: string;
}

export interface RankedItem {
  id: string;
  category: 'Applications' | 'Files & Folders' | 'Settings' | 'Recent Items';
  title: string;
  subtitle: string;
  priority: number;
  [key: string]: any;
}

const RECENT_STORAGE_KEY = 'nexus-recent-items';

const DEFAULT_RECENTS: RecentItem[] = [
  { id: 'notes', type: 'app', title: 'Notes', subtitle: 'Quickly jot down ideas' },
  { id: 'terminal', type: 'app', title: 'Terminal', subtitle: 'A different way to explore' },
  { id: 'files', type: 'app', title: 'Files', subtitle: 'Manage your virtual files' },
  { id: 'settings', type: 'app', title: 'Settings', subtitle: 'Configure OS preferences & 3D workspace' },
];

/**
 * Retrieve recent items from localStorage.
 */
export function getRecentItems(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_RECENTS;
}

/**
 * Save an item to recent history with de-duplication (keeps up to 8 items).
 */
export function saveRecentItem(item: RecentItem): void {
  try {
    const current = getRecentItems();
    const filtered = current.filter(r => !(r.id === item.id && r.type === item.type));
    const updated = [item, ...filtered].slice(0, 8);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

/**
 * Clear recent items history.
 */
export function clearRecentItems(): void {
  try {
    localStorage.removeItem(RECENT_STORAGE_KEY);
  } catch {}
}

/**
 * Asynchronously fetch nodes from IndexedDB nexus-fs.
 */
export async function fetchVirtualNodes(): Promise<Array<{ id: string; name: string; type: 'folder' | 'file'; mime?: string }>> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve([]);
      const req = indexedDB.open('nexus-fs', 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('nodes')) {
          db.close();
          return resolve([]);
        }
        const tx = db.transaction('nodes', 'readonly');
        const store = tx.objectStore('nodes');
        const getReq = store.getAll();
        getReq.onsuccess = () => {
          db.close();
          resolve((getReq.result || []) as any[]);
        };
        getReq.onerror = () => {
          db.close();
          resolve([]);
        };
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Calculate search priority for scoring.
 */
export function calculateMatchScore(title: string, subtitle: string, query: string, isApp = false): number {
  const q = query.toLowerCase().trim();
  const t = title.toLowerCase();
  const s = subtitle.toLowerCase();

  let score = 0;
  if (t === q) score = 100;
  else if (t.startsWith(q)) score = 80;
  else if (t.includes(q)) score = 60;
  else if (s.includes(q)) score = 40;

  if (score > 0 && isApp) {
    score += 15; // Application priority boost
  }

  return score;
}
