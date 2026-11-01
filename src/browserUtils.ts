// src/browserUtils.ts
/**
 * Core navigation, URL parsing, bookmarks, history and settings logic
 * for VEGA Browser.
 */

export type SearchEngineId = 'google' | 'duckduckgo' | 'bing' | 'ecosia';

export interface SearchEngine {
  id: SearchEngineId;
  name: string;
  queryUrl: string;
  homeUrl: string;
}

export const SEARCH_ENGINES: Record<SearchEngineId, SearchEngine> = {
  google: {
    id: 'google',
    name: 'Google',
    queryUrl: 'https://www.google.com/search?q=',
    homeUrl: 'https://www.google.com',
  },
  duckduckgo: {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    queryUrl: 'https://duckduckgo.com/?q=',
    homeUrl: 'https://duckduckgo.com',
  },
  bing: {
    id: 'bing',
    name: 'Bing',
    queryUrl: 'https://www.bing.com/search?q=',
    homeUrl: 'https://www.bing.com',
  },
  ecosia: {
    id: 'ecosia',
    name: 'Ecosia',
    queryUrl: 'https://www.ecosia.org/search?q=',
    homeUrl: 'https://www.ecosia.org',
  },
};

export interface BookmarkFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  folderId?: string | null;
  createdAt: number;
}

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  timestamp: number;
}

export interface BrowserSettings {
  searchEngine: SearchEngineId;
  homePage: string;
  theme: 'system' | 'light' | 'dark';
}

export interface TabLoadError {
  failedUrl: string;
  reason: 'frame-blocked' | 'timeout' | 'network-error' | 'security-policy';
  serviceName?: string;
  domain?: string;
  message?: string;
}

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  history: string[];
  historyIndex: number;
  loading: boolean;
  pinned?: boolean;
  loadError?: TabLoadError | null;
}

const BOOKMARKS_STORAGE_KEY = 'vega-browser-bookmarks';
const BOOKMARK_FOLDERS_STORAGE_KEY = 'vega-browser-bookmark-folders';
const HISTORY_STORAGE_KEY = 'vega-browser-history';
const SETTINGS_STORAGE_KEY = 'vega-browser-settings';
const TABS_STORAGE_KEY = 'vega-browser-tabs';
const ACTIVE_TAB_STORAGE_KEY = 'vega-browser-active-tab-id';

export const DEFAULT_BOOKMARK_FOLDERS: BookmarkFolder[] = [
  { id: 'bf-dev', name: 'Development', createdAt: 1700000000000 },
  { id: 'bf-tools', name: 'Reference & Tools', createdAt: 1700000001000 },
];

export const DEFAULT_BOOKMARKS: Bookmark[] = [
  { id: 'bm-ddg', url: 'https://duckduckgo.com', title: 'DuckDuckGo', folderId: 'bf-tools', createdAt: 1700000000000 },
  { id: 'bm-wiki', url: 'https://en.wikipedia.org', title: 'Wikipedia', folderId: 'bf-tools', createdAt: 1700000001000 },
  { id: 'bm-mdn', url: 'https://developer.mozilla.org', title: 'MDN Web Docs', folderId: 'bf-dev', createdAt: 1700000002000 },
  { id: 'bm-gh', url: 'https://github.com', title: 'GitHub', folderId: 'bf-dev', createdAt: 1700000003000 },
  { id: 'bm-w3c', url: 'https://www.w3.org', title: 'W3C Standards', folderId: 'bf-dev', createdAt: 1700000004000 },
  { id: 'bm-archive', url: 'https://archive.org', title: 'Internet Archive', folderId: 'bf-tools', createdAt: 1700000005000 },
];

export const DEFAULT_BROWSER_SETTINGS: BrowserSettings = {
  searchEngine: 'google',
  homePage: 'vega://newtab',
  theme: 'system',
};

/**
 * Resolves user input from the address bar into a validated URL.
 * Automatically handles domain formatting, https normalization,
 * web searches, local development ports, and internal vega:// protocol pages.
 */
export function resolveNavigationInput(
  rawInput: string,
  searchEngineId: SearchEngineId = 'google'
): { url: string; title: string; isSearch: boolean } {
  const trimmed = rawInput.trim();

  // 1. Empty input defaults to new tab
  if (!trimmed) {
    return { url: 'vega://newtab', title: 'New Tab', isSearch: false };
  }

  const lower = trimmed.toLowerCase();

  // 2. Reject hazardous script injection schemes
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return {
      url: 'vega://error?reason=security-blocked',
      title: 'Security Notice',
      isSearch: false,
    };
  }

  // 3. Built-in VEGA OS internal browser pages
  if (lower.startsWith('vega://')) {
    const pageName = lower.replace('vega://', '').split('?')[0];
    let title = 'VEGA Browser';
    if (pageName === 'newtab') title = 'New Tab';
    else if (pageName === 'bookmarks') title = 'Bookmarks';
    else if (pageName === 'history') title = 'History';
    else if (pageName === 'settings') title = 'Browser Settings';
    else if (pageName === 'error') title = 'Navigation Error';
    return { url: trimmed, title, isSearch: false };
  }

  // 4. Complete URL starting with http:// or https://
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      return { url: parsed.href, title: parsed.hostname || trimmed, isSearch: false };
    } catch {
      return {
        url: `vega://error?reason=invalid-url&target=${encodeURIComponent(trimmed)}`,
        title: 'Invalid URL',
        isSearch: false,
      };
    }
  }

  // 5. Check if input is a domain-style address or local server (localhost, IP, domain.tld)
  // Must not contain spaces and must match a domain, IP address, or localhost
  const hasSpaces = /\s/.test(trimmed);
  const isLocalhost = /^localhost(:\d+)?([\/?#].*)?$/i.test(trimmed);
  const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?([\/?#].*)?$/.test(trimmed);
  const isDomainPattern = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:\d+)?([\/?#].*)?$/i.test(trimmed);

  if (!hasSpaces && (isDomainPattern || isLocalhost || isIpAddress)) {
    const isLocal = isLocalhost || trimmed.startsWith('127.0.0.1') || trimmed.startsWith('0.0.0.0');
    const protocol = isLocal && !trimmed.startsWith('https://') ? 'http://' : 'https://';
    const candidate = `${protocol}${trimmed}`;
    try {
      const parsed = new URL(candidate);
      return { url: parsed.href, title: parsed.hostname || candidate, isSearch: false };
    } catch {}
  }

  // 6. Check for other URI schemes (e.g. ftp://, file://, mailto:, ws://)
  // Only valid if there are no spaces in the input (otherwise e.g. "price: $100" or "site: github" is a search query)
  const schemeMatch = !hasSpaces && lower.match(/^([a-z][a-z0-9+.-]*):(?!\d)/);
  if (schemeMatch) {
    const scheme = schemeMatch[1];
    if (scheme !== 'http' && scheme !== 'https' && scheme !== 'vega') {
      return {
        url: `vega://error?reason=unsupported-scheme&target=${encodeURIComponent(trimmed)}`,
        title: 'Unsupported Scheme',
        isSearch: false,
      };
    }
  }

  // 7. Otherwise, treat as a search query
  const engine = SEARCH_ENGINES[searchEngineId] || SEARCH_ENGINES.google;
  const searchUrl = `${engine.queryUrl}${encodeURIComponent(trimmed)}`;
  return {
    url: searchUrl,
    title: `${trimmed} — ${engine.name} Search`,
    isSearch: true,
  };
}

/**
 * Storage helpers for Bookmarks and Folders
 */
export function getStoredBookmarks(): Bookmark[] {
  if (typeof localStorage === 'undefined') return DEFAULT_BOOKMARKS;
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure migration compatibility: assign folderId: null if not present
        return parsed.map(b => ({
          ...b,
          folderId: b.folderId || null,
        }));
      }
    }
  } catch {}
  return DEFAULT_BOOKMARKS;
}

export function saveBookmark(
  item: { url: string; title: string; folderId?: string | null; id?: string },
  currentList: Bookmark[] = getStoredBookmarks()
): Bookmark[] {
  const cleanUrl = item.url.trim();
  const title = item.title.trim() || cleanUrl;
  const folderId = item.folderId !== undefined ? item.folderId : null;

  // Deduplicate by URL or existing ID:
  // If an ID is provided, or a bookmark with identical URL exists, update it
  const existingIndex = currentList.findIndex(
    b => (item.id && b.id === item.id) || b.url.toLowerCase() === cleanUrl.toLowerCase()
  );

  let updated: Bookmark[];
  if (existingIndex >= 0) {
    const existing = currentList[existingIndex];
    const updatedBookmark: Bookmark = {
      ...existing,
      url: cleanUrl,
      title,
      folderId: item.folderId !== undefined ? folderId : existing.folderId || null,
    };
    updated = [
      updatedBookmark,
      ...currentList.filter((_, idx) => idx !== existingIndex),
    ];
  } else {
    const newBookmark: Bookmark = {
      id: item.id || `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      url: cleanUrl,
      title,
      folderId,
      createdAt: Date.now(),
    };
    updated = [newBookmark, ...currentList];
  }

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }
  return updated;
}

export function removeBookmark(
  identifier: string,
  currentList: Bookmark[] = getStoredBookmarks()
): Bookmark[] {
  const clean = identifier.trim().toLowerCase();
  const updated = currentList.filter(
    b => b.id !== identifier && b.url.toLowerCase() !== clean
  );
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }
  return updated;
}

export function isBookmarked(url: string, currentList: Bookmark[] = getStoredBookmarks()): boolean {
  const clean = url.trim().toLowerCase();
  return currentList.some(b => b.url.toLowerCase() === clean);
}

export function getBookmarkByUrl(
  url: string,
  currentList: Bookmark[] = getStoredBookmarks()
): Bookmark | undefined {
  const clean = url.trim().toLowerCase();
  return currentList.find(b => b.url.toLowerCase() === clean);
}

export function getStoredBookmarkFolders(): BookmarkFolder[] {
  if (typeof localStorage === 'undefined') return DEFAULT_BOOKMARK_FOLDERS;
  try {
    const raw = localStorage.getItem(BOOKMARK_FOLDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return DEFAULT_BOOKMARK_FOLDERS;
}

export function createBookmarkFolder(
  name: string,
  currentList: BookmarkFolder[] = getStoredBookmarkFolders()
): { folders: BookmarkFolder[]; newFolder: BookmarkFolder } {
  const trimmed = name.trim() || 'New Folder';
  const newFolder: BookmarkFolder = {
    id: `bf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
    createdAt: Date.now(),
  };
  const updated = [...currentList, newFolder];
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(BOOKMARK_FOLDERS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }
  return { folders: updated, newFolder };
}

export function renameBookmarkFolder(
  folderId: string,
  newName: string,
  currentList: BookmarkFolder[] = getStoredBookmarkFolders()
): BookmarkFolder[] {
  const trimmed = newName.trim();
  if (!trimmed) return currentList;
  const updated = currentList.map(f => (f.id === folderId ? { ...f, name: trimmed } : f));
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(BOOKMARK_FOLDERS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }
  return updated;
}

export function deleteBookmarkFolder(
  folderId: string,
  folders: BookmarkFolder[] = getStoredBookmarkFolders(),
  bookmarks: Bookmark[] = getStoredBookmarks(),
  deleteContainedBookmarks = false
): { folders: BookmarkFolder[]; bookmarks: Bookmark[] } {
  const updatedFolders = folders.filter(f => f.id !== folderId);

  let updatedBookmarks: Bookmark[];
  if (deleteContainedBookmarks) {
    updatedBookmarks = bookmarks.filter(b => b.folderId !== folderId);
  } else {
    // Preserve bookmarks safely by moving them to the main collection (root)
    updatedBookmarks = bookmarks.map(b => (b.folderId === folderId ? { ...b, folderId: null } : b));
  }

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(BOOKMARK_FOLDERS_STORAGE_KEY, JSON.stringify(updatedFolders));
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(updatedBookmarks));
    } catch {}
  }
  return { folders: updatedFolders, bookmarks: updatedBookmarks };
}

export function moveBookmarkToFolder(
  bookmarkId: string,
  targetFolderId: string | null,
  bookmarks: Bookmark[] = getStoredBookmarks()
): Bookmark[] {
  const updated = bookmarks.map(b =>
    b.id === bookmarkId ? { ...b, folderId: targetFolderId } : b
  );
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }
  return updated;
}

export function searchBookmarks(query: string, bookmarks: Bookmark[]): Bookmark[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return bookmarks;
  return bookmarks.filter(
    b => b.title.toLowerCase().includes(trimmed) || b.url.toLowerCase().includes(trimmed)
  );
}

/**
 * Storage helpers for Browsing History
 */
export function getStoredHistory(): HistoryEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function addHistoryEntry(
  url: string,
  title: string,
  currentList: HistoryEntry[] = getStoredHistory()
): HistoryEntry[] {
  const cleanUrl = url.trim();
  // Don't record internal newtab or blank pages in history
  if (!cleanUrl || cleanUrl === 'vega://newtab' || cleanUrl === 'about:blank') {
    return currentList;
  }

  // Prevent consecutive duplicate entries for same URL
  if (currentList.length > 0 && currentList[0].url === cleanUrl) {
    return currentList;
  }

  const newEntry: HistoryEntry = {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    url: cleanUrl,
    title: title || cleanUrl,
    timestamp: Date.now(),
  };

  // Keep up to 100 history entries
  const updated = [newEntry, ...currentList].slice(0, 100);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }
  return updated;
}

export function removeHistoryEntry(
  id: string,
  currentList: HistoryEntry[] = getStoredHistory()
): HistoryEntry[] {
  const updated = currentList.filter(h => h.id !== id);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }
  return updated;
}

export function clearStoredHistory(): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {}
  }
}

/**
 * Storage helpers for Browser Settings
 */
export function getStoredBrowserSettings(): BrowserSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_BROWSER_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_BROWSER_SETTINGS, ...parsed };
    }
  } catch {}
  return DEFAULT_BROWSER_SETTINGS;
}

export function saveStoredBrowserSettings(
  partial: Partial<BrowserSettings>,
  current: BrowserSettings = getStoredBrowserSettings()
): BrowserSettings {
  const updated: BrowserSettings = { ...current, ...partial };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }
  return updated;
}

/**
 * Detects whether a website origin is known to enforce strict frame embedding
 * restrictions (X-Frame-Options: SAMEORIGIN / DENY or CSP frame-ancestors 'none').
 * In standard browser sandboxes, these domains cannot be rendered inside an iframe
 * and will produce a blank white screen unless rendered via an error screen with
 * external window/tab recovery.
 */
export function isKnownFrameBlocked(url: string): {
  isBlocked: boolean;
  domain: string;
  serviceName: string;
} {
  if (!url || !url.startsWith('http')) {
    return { isBlocked: false, domain: '', serviceName: '' };
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    // YouTube embed route explicitly allows frame embedding
    if (hostname.includes('youtube.com') && pathname.startsWith('/embed/')) {
      return { isBlocked: false, domain: hostname, serviceName: 'YouTube Embed' };
    }

    const BLOCKED_DOMAINS: Array<{ pattern: RegExp; name: string }> = [
      { pattern: /(^|\.)google\.[a-z]{2,}(\.[a-z]{2})?$/i, name: 'Google' },
      { pattern: /(^|\.)youtube\.com$/i, name: 'YouTube' },
      { pattern: /(^|\.)duckduckgo\.com$/i, name: 'DuckDuckGo' },
      { pattern: /(^|\.)bing\.com$/i, name: 'Bing' },
      { pattern: /(^|\.)ecosia\.org$/i, name: 'Ecosia' },
      { pattern: /(^|\.)yahoo\.com$/i, name: 'Yahoo' },
      { pattern: /(^|\.)github\.com$/i, name: 'GitHub' },
      { pattern: /(^|\.)twitter\.com$/i, name: 'Twitter' },
      { pattern: /(^|\.)x\.com$/i, name: 'X (Twitter)' },
      { pattern: /(^|\.)facebook\.com$/i, name: 'Facebook' },
      { pattern: /(^|\.)instagram\.com$/i, name: 'Instagram' },
      { pattern: /(^|\.)linkedin\.com$/i, name: 'LinkedIn' },
      { pattern: /(^|\.)reddit\.com$/i, name: 'Reddit' },
      { pattern: /(^|\.)netflix\.com$/i, name: 'Netflix' },
      { pattern: /(^|\.)amazon\.[a-z]{2,}(\.[a-z]{2})?$/i, name: 'Amazon' },
      { pattern: /(^|\.)apple\.com$/i, name: 'Apple' },
      { pattern: /(^|\.)microsoft\.com$/i, name: 'Microsoft' },
      { pattern: /(^|\.)tiktok\.com$/i, name: 'TikTok' },
      { pattern: /(^|\.)discord\.com$/i, name: 'Discord' },
    ];

    for (const item of BLOCKED_DOMAINS) {
      if (item.pattern.test(hostname)) {
        return { isBlocked: true, domain: hostname, serviceName: item.name };
      }
    }
  } catch {}

  return { isBlocked: false, domain: '', serviceName: '' };
}

/**
 * Tab Navigation and Management helpers
 */
export function createNewTab(
  initialUrl = 'vega://newtab',
  title = 'New Tab',
  pinned = false
): BrowserTab {
  const frameBlockCheck = isKnownFrameBlocked(initialUrl);
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    url: initialUrl,
    title,
    history: [initialUrl],
    historyIndex: 0,
    loading: false,
    pinned: Boolean(pinned),
    loadError: frameBlockCheck.isBlocked
      ? {
          failedUrl: initialUrl,
          reason: 'frame-blocked',
          serviceName: frameBlockCheck.serviceName,
          domain: frameBlockCheck.domain,
          message: `${frameBlockCheck.serviceName} specifies security headers (X-Frame-Options: SAMEORIGIN) that prevent it from being embedded in a frame.`,
        }
      : null,
  };
}

/**
 * Duplicates a tab, creating an independent clone with the same URL
 * and title, fresh navigation history, and isolated state.
 */
export function duplicateTab(tab: BrowserTab): BrowserTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    url: tab.url,
    title: tab.title,
    history: [tab.url],
    historyIndex: 0,
    loading: false,
    pinned: false,
    loadError: tab.loadError ? { ...tab.loadError } : null,
  };
}

/**
 * Reorders tabs so pinned tabs always precede unpinned tabs,
 * maintaining relative order within each partition.
 */
export function reorderTabsWithPinned(tabs: BrowserTab[]): BrowserTab[] {
  const pinned = tabs.filter(t => Boolean(t.pinned));
  const unpinned = tabs.filter(t => !t.pinned);
  return [...pinned, ...unpinned];
}

/**
 * Toggles a tab's pinned state and re-sorts tabs accordingly.
 */
export function togglePinTab(
  tabs: BrowserTab[],
  tabId: string
): { tabs: BrowserTab[]; updatedTab: BrowserTab | null } {
  const target = tabs.find(t => t.id === tabId);
  if (!target) return { tabs, updatedTab: null };

  const updatedTab: BrowserTab = { ...target, pinned: !target.pinned };
  const nextTabs = tabs.map(t => (t.id === tabId ? updatedTab : t));
  return {
    tabs: reorderTabsWithPinned(nextTabs),
    updatedTab,
  };
}

/**
 * Safely closes a tab:
 * - If closing the active tab, intelligently selects the adjacent tab.
 * - If closing the last remaining tab, resets to a fresh default new tab instead of closing the application.
 * - Guarantees non-empty tab array and valid activeTabId.
 */
export function closeTab(
  tabs: BrowserTab[],
  activeTabId: string,
  tabIdToClose: string,
  fallbackUrl = 'vega://newtab'
): { tabs: BrowserTab[]; activeTabId: string } {
  // If only one tab exists, reset it to newtab
  if (tabs.length <= 1) {
    const reset = createNewTab(fallbackUrl, 'New Tab');
    return { tabs: [reset], activeTabId: reset.id };
  }

  const indexToClose = tabs.findIndex(t => t.id === tabIdToClose);
  if (indexToClose === -1) {
    return { tabs, activeTabId };
  }

  const newTabs = tabs.filter(t => t.id !== tabIdToClose);

  // If the closing tab was active, choose next closest tab
  let nextActiveId = activeTabId;
  if (activeTabId === tabIdToClose) {
    const nextIndex = Math.min(indexToClose, newTabs.length - 1);
    nextActiveId = newTabs[nextIndex].id;
  }

  return { tabs: newTabs, activeTabId: nextActiveId };
}

/**
 * Derives a favicon image URL for web addresses using Google's public favicon service.
 * Returns null for internal vega:// protocol pages.
 */
export function getFaviconUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('vega://')) return null;

  try {
    const parsed = new URL(url);
    if (parsed.hostname) {
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=32`;
    }
  } catch {}
  return null;
}

/**
 * Storage helpers for Browser Tabs persistence
 */
export function getStoredTabs(): { tabs: BrowserTab[]; activeTabId: string | null } {
  if (typeof localStorage === 'undefined') {
    return { tabs: [], activeTabId: null };
  }

  try {
    const rawTabs = localStorage.getItem(TABS_STORAGE_KEY);
    const storedActiveId = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);

    if (rawTabs) {
      const parsed = JSON.parse(rawTabs);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Validate and sanitize stored tabs
        const validated: BrowserTab[] = parsed
          .filter(t => t && typeof t.id === 'string' && typeof t.url === 'string')
          .map(t => ({
            id: t.id,
            url: t.url,
            title: t.title || t.url,
            history: Array.isArray(t.history) && t.history.length > 0 ? t.history : [t.url],
            historyIndex: typeof t.historyIndex === 'number' ? t.historyIndex : 0,
            loading: false, // Always restore with idle loading state
            pinned: Boolean(t.pinned),
          }));

        if (validated.length > 0) {
          const sorted = reorderTabsWithPinned(validated);
          const activeId =
            storedActiveId && sorted.some(t => t.id === storedActiveId)
              ? storedActiveId
              : sorted[0].id;

          return { tabs: sorted, activeTabId: activeId };
        }
      }
    }
  } catch {}

  return { tabs: [], activeTabId: null };
}

export function saveStoredTabs(tabs: BrowserTab[], activeTabId: string): void {
  if (typeof localStorage === 'undefined') return;

  try {
    // Only persist lightweight and safe properties (no circular references or loading spinners)
    const sanitized = tabs.map(t => ({
      id: t.id,
      url: t.url,
      title: t.title,
      history: t.history.slice(-20), // Cap history stack length per tab
      historyIndex: Math.min(t.historyIndex, 19),
      pinned: Boolean(t.pinned),
    }));

    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(sanitized));
    if (activeTabId) {
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTabId);
    }
  } catch {}
}

export function navigateTab(
  tab: BrowserTab,
  targetUrl: string,
  title?: string
): BrowserTab {
  const cleanUrl = targetUrl.trim();
  // Truncate forward history if navigating from a past index
  const newHistory = [...tab.history.slice(0, tab.historyIndex + 1), cleanUrl];
  const frameBlockCheck = isKnownFrameBlocked(cleanUrl);

  return {
    ...tab,
    url: cleanUrl,
    title: title || cleanUrl,
    history: newHistory,
    historyIndex: newHistory.length - 1,
    loading: cleanUrl.startsWith('http') && !frameBlockCheck.isBlocked,
    loadError: frameBlockCheck.isBlocked
      ? {
          failedUrl: cleanUrl,
          reason: 'frame-blocked',
          serviceName: frameBlockCheck.serviceName,
          domain: frameBlockCheck.domain,
          message: `${frameBlockCheck.serviceName} specifies security headers (X-Frame-Options: SAMEORIGIN) that prevent it from being embedded in a frame.`,
        }
      : null,
  };
}

export function canGoBack(tab: BrowserTab): boolean {
  return tab.historyIndex > 0;
}

export function canGoForward(tab: BrowserTab): boolean {
  return tab.historyIndex < tab.history.length - 1;
}

export function goBack(tab: BrowserTab): BrowserTab {
  if (!canGoBack(tab)) return tab;
  const newIndex = tab.historyIndex - 1;
  const newUrl = tab.history[newIndex];
  const frameBlockCheck = isKnownFrameBlocked(newUrl);
  return {
    ...tab,
    historyIndex: newIndex,
    url: newUrl,
    title: newUrl,
    loading: newUrl.startsWith('http') && !frameBlockCheck.isBlocked,
    loadError: frameBlockCheck.isBlocked
      ? {
          failedUrl: newUrl,
          reason: 'frame-blocked',
          serviceName: frameBlockCheck.serviceName,
          domain: frameBlockCheck.domain,
          message: `${frameBlockCheck.serviceName} specifies security headers (X-Frame-Options: SAMEORIGIN) that prevent it from being embedded in a frame.`,
        }
      : null,
  };
}

export function goForward(tab: BrowserTab): BrowserTab {
  if (!canGoForward(tab)) return tab;
  const newIndex = tab.historyIndex + 1;
  const newUrl = tab.history[newIndex];
  const frameBlockCheck = isKnownFrameBlocked(newUrl);
  return {
    ...tab,
    historyIndex: newIndex,
    url: newUrl,
    title: newUrl,
    loading: newUrl.startsWith('http') && !frameBlockCheck.isBlocked,
    loadError: frameBlockCheck.isBlocked
      ? {
          failedUrl: newUrl,
          reason: 'frame-blocked',
          serviceName: frameBlockCheck.serviceName,
          domain: frameBlockCheck.domain,
          message: `${frameBlockCheck.serviceName} specifies security headers (X-Frame-Options: SAMEORIGIN) that prevent it from being embedded in a frame.`,
        }
      : null,
  };
}
