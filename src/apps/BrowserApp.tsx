// src/apps/BrowserApp.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  X,
  Home,
  Plus,
  Star,
  ExternalLink,
  Search,
  Lock,
  Globe,
  MoreVertical,
  Bookmark as BookmarkIcon,
  Clock,
  Settings as SettingsIcon,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Check,
  Pin,
  Copy,
  ChevronDown,
  Folder,
  FolderPlus,
  Pencil,
  Undo2,
} from 'lucide-react';
import {
  type SearchEngineId,
  type Bookmark,
  type BookmarkFolder,
  type HistoryEntry,
  type BrowserSettings,
  type BrowserTab,
  SEARCH_ENGINES,
  DEFAULT_BOOKMARKS,
  DEFAULT_BROWSER_SETTINGS,
  resolveNavigationInput,
  getStoredBookmarks,
  saveBookmark,
  removeBookmark,
  isBookmarked,
  getBookmarkByUrl,
  getStoredBookmarkFolders,
  createBookmarkFolder,
  renameBookmarkFolder,
  deleteBookmarkFolder,
  searchBookmarks,
  getStoredHistory,
  addHistoryEntry,
  removeHistoryEntry,
  clearStoredHistory,
  getStoredBrowserSettings,
  saveStoredBrowserSettings,
  createNewTab,
  duplicateTab,
  reorderTabsWithPinned,
  togglePinTab,
  closeTab,
  getFaviconUrl,
  getStoredTabs,
  saveStoredTabs,
  navigateTab,
  canGoBack,
  canGoForward,
  goBack,
  goForward,
} from '../browserUtils';

export default function BrowserApp() {
  // Tabs state - restored from storage
  const [tabs, setTabs] = useState<BrowserTab[]>(() => {
    const stored = getStoredTabs();
    if (stored.tabs.length > 0) return stored.tabs;
    return [createNewTab(DEFAULT_BROWSER_SETTINGS.homePage, 'New Tab')];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const stored = getStoredTabs();
    if (stored.activeTabId && stored.tabs.some(t => t.id === stored.activeTabId)) {
      return stored.activeTabId;
    }
    return tabs[0]?.id || 'default';
  });

  // Address bar input state
  const [inputUrl, setInputUrl] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);

  // Tab Context Menu state
  const [tabContextMenu, setTabContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    tabId: string | null;
  }>({ isOpen: false, x: 0, y: 0, tabId: null });

  // Failed favicons cache
  const [failedFavicons, setFailedFavicons] = useState<Record<string, boolean>>({});

  // Bookmarks, Folders, History & Settings
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(getStoredBookmarks);
  const [bookmarkFolders, setBookmarkFolders] = useState<BookmarkFolder[]>(getStoredBookmarkFolders);
  const [history, setHistory] = useState<HistoryEntry[]>(getStoredHistory);
  const [settings, setSettings] = useState<BrowserSettings>(getStoredBrowserSettings);

  // Bookmarks Manager view state
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [bookmarkSearchQuery, setBookmarkSearchQuery] = useState('');

  // Quick Bookmarks Bar folder dropdown
  const [activeQuickFolderId, setActiveQuickFolderId] = useState<string | null>(null);

  // Address bar Bookmark Popover state
  const [bookmarkPopover, setBookmarkPopover] = useState<{
    isOpen: boolean;
    isExisting: boolean;
    bookmarkId?: string;
    title: string;
    url: string;
    folderId: string | null;
  } | null>(null);

  // Add / Edit Bookmark Dialog in Bookmarks Manager
  const [bookmarkModal, setBookmarkModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    bookmarkId?: string;
    title: string;
    url: string;
    folderId: string | null;
  } | null>(null);

  // Folder Create / Rename Dialog
  const [folderModal, setFolderModal] = useState<{
    isOpen: boolean;
    mode: 'create' | 'rename';
    folderId?: string;
    name: string;
  } | null>(null);

  // Delete Folder Safety Confirmation Dialog
  const [deleteFolderDialog, setDeleteFolderDialog] = useState<{
    isOpen: boolean;
    folderId: string;
    folderName: string;
    count: number;
  } | null>(null);

  // Undo Delete Toast state
  const [undoToast, setUndoToast] = useState<{
    isOpen: boolean;
    bookmark: Bookmark;
  } | null>(null);

  // Refs for DOM elements
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const overviewRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const bookmarkPopoverRef = useRef<HTMLDivElement>(null);
  const quickBarRef = useRef<HTMLDivElement>(null);
  const tabStripRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // Persist tabs and activeTabId to localStorage
  useEffect(() => {
    saveStoredTabs(tabs, activeTabId);
  }, [tabs, activeTabId]);

  // Ensure activeTabId always points to an existing tab
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some(t => t.id === activeTabId)) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  // Sync address input when active tab changes URL
  useEffect(() => {
    if (activeTab) {
      setInputUrl(activeTab.url);
      // Close bookmark popover on tab switch to avoid out-of-sync edits
      setBookmarkPopover(null);
    }
  }, [activeTab?.id, activeTab?.url]);

  // Auto-scroll active tab into view in tab strip
  useEffect(() => {
    const activeEl = document.getElementById(`tab-elem-${activeTabId}`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTabId]);

  // Close menus and popovers on outside click or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
      if (overviewRef.current && !overviewRef.current.contains(e.target as Node)) {
        setIsOverviewOpen(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setTabContextMenu({ isOpen: false, x: 0, y: 0, tabId: null });
      }
      if (bookmarkPopoverRef.current && !bookmarkPopoverRef.current.contains(e.target as Node)) {
        // Only close if not clicking the star toggle button
        const target = e.target as HTMLElement;
        if (!target.closest('.bookmark-star-toggle')) {
          setBookmarkPopover(null);
        }
      }
      if (quickBarRef.current && !quickBarRef.current.contains(e.target as Node)) {
        setActiveQuickFolderId(null);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        setIsOverviewOpen(false);
        setTabContextMenu({ isOpen: false, x: 0, y: 0, tabId: null });
        setBookmarkPopover(null);
        setBookmarkModal(null);
        setFolderModal(null);
        setDeleteFolderDialog(null);
        setActiveQuickFolderId(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Tab Operations
  const handleOpenNewTab = (initialUrl = settings.homePage, title?: string, pinned = false) => {
    const newTab = createNewTab(
      initialUrl,
      title || (initialUrl === 'vega://newtab' ? 'New Tab' : initialUrl),
      pinned
    );
    setTabs(prev => reorderTabsWithPinned([...prev, newTab]));
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (tabIdToClose: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    delete iframeRefs.current[tabIdToClose];
    const result = closeTab(tabs, activeTabId, tabIdToClose, settings.homePage);
    setTabs(result.tabs);
    setActiveTabId(result.activeTabId);
  };

  const handleDuplicateTab = (tabIdToDuplicate: string) => {
    const target = tabs.find(t => t.id === tabIdToDuplicate);
    if (!target) return;
    const newTab = duplicateTab(target);
    const targetIndex = tabs.findIndex(t => t.id === tabIdToDuplicate);
    const updated = [...tabs.slice(0, targetIndex + 1), newTab, ...tabs.slice(targetIndex + 1)];
    const sorted = reorderTabsWithPinned(updated);
    setTabs(sorted);
    setActiveTabId(newTab.id);
  };

  const handleTogglePinTab = (tabIdToToggle: string) => {
    const { tabs: reordered } = togglePinTab(tabs, tabIdToToggle);
    setTabs(reordered);
  };

  const handleCloseOtherTabs = (tabIdToKeep: string) => {
    const kept = tabs.filter(t => t.id === tabIdToKeep || t.pinned);
    setTabs(reorderTabsWithPinned(kept));
    setActiveTabId(tabIdToKeep);
  };

  const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 200;
    const menuHeight = 220;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
    setTabContextMenu({
      isOpen: true,
      x: Math.max(10, x),
      y: Math.max(10, y),
      tabId,
    });
  };

  const handleTabStripWheel = (e: React.WheelEvent) => {
    if (tabStripRef.current && e.deltaY !== 0) {
      tabStripRef.current.scrollLeft += e.deltaY;
    }
  };

  // Perform navigation for specified tab (defaults to activeTab)
  const handleNavigate = (rawTarget: string, tabIdToNavigate = activeTabId) => {
    if (reloadTimerRef.current && tabIdToNavigate === activeTabId) {
      clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
    }

    const resolved = resolveNavigationInput(rawTarget, settings.searchEngine);
    const isLoading = resolved.url.startsWith('http');

    setTabs(prev =>
      prev.map(t =>
        t.id === tabIdToNavigate
          ? { ...navigateTab(t, resolved.url, resolved.title), loading: isLoading }
          : t
      )
    );

    if (tabIdToNavigate === activeTabId) {
      setInputUrl(resolved.url);
    }

    if (isLoading) {
      reloadTimerRef.current = setTimeout(() => {
        setTabs(prev => prev.map(t => (t.id === tabIdToNavigate ? { ...t, loading: false } : t)));
        reloadTimerRef.current = null;
      }, 5000);
    }

    if (resolved.url.startsWith('http')) {
      const updatedHistory = addHistoryEntry(resolved.url, resolved.title, history);
      setHistory(updatedHistory);
    }
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    handleNavigate(inputUrl);
  };

  // Navigation button controls
  const handleBack = () => {
    if (!canGoBack(activeTab)) return;
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
    }
    const updated = goBack(activeTab);
    setTabs(prev => prev.map(t => (t.id === activeTab.id ? updated : t)));
    setInputUrl(updated.url);
  };

  const handleForward = () => {
    if (!canGoForward(activeTab)) return;
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
    }
    const updated = goForward(activeTab);
    setTabs(prev => prev.map(t => (t.id === activeTab.id ? updated : t)));
    setInputUrl(updated.url);
  };

  const handleReload = () => {
    if (activeTab.loading) {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      setTabs(prev => prev.map(t => (t.id === activeTab.id ? { ...t, loading: false } : t)));
      return;
    }

    setTabs(prev =>
      prev.map(t => (t.id === activeTab.id ? { ...t, loadError: null, loading: true } : t))
    );
    const activeIframe = iframeRefs.current[activeTab.id];
    if (activeIframe) {
      try {
        activeIframe.src = activeTab.url;
      } catch {}
    }
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      setTabs(prev => prev.map(t => (t.id === activeTab.id ? { ...t, loading: false } : t)));
      reloadTimerRef.current = null;
    }, 4000);
  };

  const handleRetryTab = (tabIdToRetry: string) => {
    setTabs(prev =>
      prev.map(t => (t.id === tabIdToRetry ? { ...t, loadError: null, loading: true } : t))
    );
    const targetIframe = iframeRefs.current[tabIdToRetry];
    if (targetIframe) {
      try {
        const targetTab = tabs.find(t => t.id === tabIdToRetry);
        if (targetTab) targetIframe.src = targetTab.url;
      } catch {}
    }
    if (reloadTimerRef.current && tabIdToRetry === activeTabId) {
      clearTimeout(reloadTimerRef.current);
    }
    reloadTimerRef.current = setTimeout(() => {
      setTabs(prev => prev.map(t => (t.id === tabIdToRetry ? { ...t, loading: false } : t)));
      reloadTimerRef.current = null;
    }, 4000);
  };

  const handleReloadSpecificTab = (tabIdToReload: string) => {
    setTabs(prev => prev.map(t => (t.id === tabIdToReload ? { ...t, loading: true } : t)));
    const targetIframe = iframeRefs.current[tabIdToReload];
    if (targetIframe) {
      try {
        const targetTab = tabs.find(t => t.id === tabIdToReload);
        if (targetTab) targetIframe.src = targetTab.url;
      } catch {}
    }
    setTimeout(() => {
      setTabs(prev => prev.map(t => (t.id === tabIdToReload ? { ...t, loading: false } : t)));
    }, 3000);
  };

  const handleHome = () => {
    handleNavigate(settings.homePage);
  };

  // Bookmark Star Click Handler (opens edit/add popover)
  const isCurrentBookmarked = isBookmarked(activeTab.url, bookmarks);
  const handleStarClick = () => {
    if (bookmarkPopover?.isOpen) {
      setBookmarkPopover(null);
      return;
    }
    const existing = getBookmarkByUrl(activeTab.url, bookmarks);
    if (existing) {
      setBookmarkPopover({
        isOpen: true,
        isExisting: true,
        bookmarkId: existing.id,
        title: existing.title,
        url: existing.url,
        folderId: existing.folderId || null,
      });
    } else {
      setBookmarkPopover({
        isOpen: true,
        isExisting: false,
        title: activeTab.title || activeTab.url,
        url: activeTab.url,
        folderId: null,
      });
    }
  };

  const handleSaveBookmarkFromPopover = () => {
    if (!bookmarkPopover) return;
    const updated = saveBookmark(
      {
        id: bookmarkPopover.bookmarkId,
        url: bookmarkPopover.url,
        title: bookmarkPopover.title,
        folderId: bookmarkPopover.folderId,
      },
      bookmarks
    );
    setBookmarks(updated);
    setBookmarkPopover(null);
  };

  const handleRemoveBookmarkFromPopover = () => {
    if (!bookmarkPopover) return;
    const updated = removeBookmark(bookmarkPopover.bookmarkId || bookmarkPopover.url, bookmarks);
    setBookmarks(updated);
    setBookmarkPopover(null);
  };

  // Open external tab
  const handleOpenExternal = (urlToOpen = activeTab.url) => {
    if (urlToOpen.startsWith('vega://')) return;
    window.open(urlToOpen, '_blank', 'noopener,noreferrer');
  };

  // Clear history
  const handleClearHistory = () => {
    clearStoredHistory();
    setHistory([]);
  };

  // Update Settings
  const handleUpdateSettings = (partial: Partial<BrowserSettings>) => {
    const updated = saveStoredBrowserSettings(partial, settings);
    setSettings(updated);
  };

  // Delete Bookmark with Undo Toast
  const handleDeleteBookmark = (bookmarkToDelete: Bookmark) => {
    const updated = removeBookmark(bookmarkToDelete.id, bookmarks);
    setBookmarks(updated);
    setUndoToast({ isOpen: true, bookmark: bookmarkToDelete });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      setUndoToast(null);
      undoTimerRef.current = null;
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (!undoToast?.bookmark) return;
    const restored = saveBookmark(undoToast.bookmark, bookmarks);
    setBookmarks(restored);
    setUndoToast(null);
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  // Folder management handlers
  const handleCreateFolder = (name: string) => {
    const { folders: updatedFolders } = createBookmarkFolder(name, bookmarkFolders);
    setBookmarkFolders(updatedFolders);
    setFolderModal(null);
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    const updated = renameBookmarkFolder(folderId, newName, bookmarkFolders);
    setBookmarkFolders(updated);
    setFolderModal(null);
  };

  const promptDeleteFolder = (folder: BookmarkFolder) => {
    const containedCount = bookmarks.filter(b => b.folderId === folder.id).length;
    if (containedCount === 0) {
      // Empty folder, safe to delete immediately
      const result = deleteBookmarkFolder(folder.id, bookmarkFolders, bookmarks, false);
      setBookmarkFolders(result.folders);
      setBookmarks(result.bookmarks);
      if (selectedFolderId === folder.id) setSelectedFolderId('all');
    } else {
      setDeleteFolderDialog({
        isOpen: true,
        folderId: folder.id,
        folderName: folder.name,
        count: containedCount,
      });
    }
  };

  const confirmDeleteFolder = (deleteBookmarks: boolean) => {
    if (!deleteFolderDialog) return;
    const result = deleteBookmarkFolder(
      deleteFolderDialog.folderId,
      bookmarkFolders,
      bookmarks,
      deleteBookmarks
    );
    setBookmarkFolders(result.folders);
    setBookmarks(result.bookmarks);
    if (selectedFolderId === deleteFolderDialog.folderId) {
      setSelectedFolderId('all');
    }
    setDeleteFolderDialog(null);
  };

  // Favicon / Icon renderer
  const renderTabIcon = (tab: BrowserTab, isActive: boolean) => {
    if (tab.loading) {
      return <RotateCw size={12} className="animate-spin text-[#668b7b] shrink-0" />;
    }

    const faviconUrl = getFaviconUrl(tab.url);
    if (faviconUrl && !failedFavicons[faviconUrl]) {
      return (
        <img
          src={faviconUrl}
          alt=""
          className="w-3.5 h-3.5 rounded-sm object-contain shrink-0"
          onError={() => setFailedFavicons(prev => ({ ...prev, [faviconUrl]: true }))}
        />
      );
    }

    if (tab.url.startsWith('vega://newtab')) {
      return <Globe size={13} className={isActive ? 'text-[#668b7b]' : 'text-gray-400 shrink-0'} />;
    }
    if (tab.url.startsWith('vega://bookmarks')) {
      return <BookmarkIcon size={13} className={isActive ? 'text-[#668b7b]' : 'text-gray-400 shrink-0'} />;
    }
    if (tab.url.startsWith('vega://history')) {
      return <Clock size={13} className={isActive ? 'text-[#668b7b]' : 'text-gray-400 shrink-0'} />;
    }
    if (tab.url.startsWith('vega://settings')) {
      return <SettingsIcon size={13} className={isActive ? 'text-[#668b7b]' : 'text-gray-400 shrink-0'} />;
    }
    if (tab.url.startsWith('vega://error')) {
      return <ShieldAlert size={13} className="text-red-500 shrink-0" />;
    }

    return <Globe size={13} className={isActive ? 'text-[#668b7b]' : 'text-gray-400 shrink-0'} />;
  };

  // Filtered bookmarks for Bookmarks Manager
  const getFilteredBookmarks = () => {
    let result = bookmarks;
    if (selectedFolderId === 'root') {
      result = result.filter(b => !b.folderId);
    } else if (selectedFolderId !== 'all') {
      result = result.filter(b => b.folderId === selectedFolderId);
    }
    if (bookmarkSearchQuery.trim()) {
      result = searchBookmarks(bookmarkSearchQuery, result);
    }
    return result;
  };

  // Helper to render content per tab
  const renderTabContent = (tab: BrowserTab) => {
    if (tab.url === 'vega://newtab') {
      return (
        <div className="h-full overflow-y-auto p-4 sm:p-8 flex flex-col items-center">
          <div className="w-full max-w-4xl mx-auto my-auto space-y-6 text-center">
            {/* Brand Header */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-[#668b7b]/15 text-[#668b7b] flex items-center justify-center shadow-sm">
                <Globe size={28} />
              </div>
              <h1 className="text-2xl font-light tracking-tight text-gray-900 dark:text-gray-100">
                VEGA <span className="font-semibold">Browser</span>
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Clean, quiet web exploration with built-in sandbox security.
              </p>
            </div>

            {/* Start Search Bar */}
            <form onSubmit={handleAddressSubmit} className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={`Search the web with ${SEARCH_ENGINES[settings.searchEngine]?.name || 'Google'}…`}
                aria-label="Search the web"
                className="w-full pl-10 pr-24 py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl text-xs sm:text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#668b7b] shadow-sm transition"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleNavigate((e.target as HTMLInputElement).value, tab.id);
                  }
                }}
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-[#668b7b] text-white text-xs font-medium hover:bg-[#557869] transition"
              >
                Search
              </button>
            </form>

            {/* Curated Top Destinations */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-left">
                Favorites & Shortcuts
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-left">
                {DEFAULT_BOOKMARKS.map(bm => (
                  <button
                    key={bm.id}
                    onClick={() => handleNavigate(bm.url, tab.id)}
                    onAuxClick={e => {
                      if (e.button === 1) {
                        e.preventDefault();
                        handleOpenNewTab(bm.url);
                      }
                    }}
                    className="p-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/5 dark:border-white/5 flex items-center justify-between transition text-xs group"
                  >
                    <div className="min-w-0 pr-2">
                      <strong className="block truncate text-gray-900 dark:text-gray-100 font-medium">
                        {bm.title}
                      </strong>
                      <span className="text-[10px] text-gray-400 truncate block">
                        {bm.url.replace('https://', '')}
                      </span>
                    </div>
                    <ExternalLink size={12} className="text-gray-400 group-hover:text-[#668b7b] shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Technical Security Notice */}
            <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-[11px] text-gray-500 dark:text-gray-400 text-left space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                <ShieldCheck size={14} className="text-[#668b7b]" />
                <span>Browser Architecture & Cross-Origin Security</span>
              </div>
              <p className="leading-relaxed">
                VEGA OS executes within a secure web browser sandbox. Standard web origins enforce{' '}
                <code className="font-mono text-[10px]">X-Frame-Options: SAMEORIGIN</code> to protect
                user sessions. Use the <strong className="text-gray-700 dark:text-gray-300">Open in Real Tab ↗</strong>{' '}
                button anytime a destination website forbids embedded frame rendering.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (tab.url === 'vega://bookmarks') {
      const filtered = getFilteredBookmarks();
      const currentFolder = bookmarkFolders.find(f => f.id === selectedFolderId);

      return (
        <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-[#1a1f1b] select-none">
          {/* Top Control Bar */}
          <div className="p-4 border-b border-black/5 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#668b7b]/15 text-[#668b7b] flex items-center justify-center">
                <BookmarkIcon size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Bookmarks Manager
                </h2>
                <span className="text-[11px] text-gray-400">
                  {bookmarks.length} {bookmarks.length === 1 ? 'bookmark' : 'bookmarks'} in{' '}
                  {bookmarkFolders.length} {bookmarkFolders.length === 1 ? 'folder' : 'folders'}
                </span>
              </div>
            </div>

            {/* Search Input & Action Buttons */}
            <div className="flex items-center gap-2 flex-1 max-w-md ml-auto">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search bookmarks by title or URL…"
                  value={bookmarkSearchQuery}
                  onChange={e => setBookmarkSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#668b7b]"
                />
                {bookmarkSearchQuery && (
                  <button
                    onClick={() => setBookmarkSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <button
                onClick={() => setFolderModal({ isOpen: true, mode: 'create', name: '' })}
                className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 text-xs font-medium flex items-center gap-1.5 transition shrink-0"
              >
                <FolderPlus size={13} className="text-[#668b7b]" />
                <span className="hidden sm:inline">New Folder</span>
              </button>

              <button
                onClick={() =>
                  setBookmarkModal({
                    isOpen: true,
                    mode: 'create',
                    title: '',
                    url: '',
                    folderId: selectedFolderId !== 'all' && selectedFolderId !== 'root' ? selectedFolderId : null,
                  })
                }
                className="px-3 py-1.5 rounded-xl bg-[#668b7b] hover:bg-[#557869] text-white text-xs font-medium flex items-center gap-1.5 transition shadow-sm shrink-0"
              >
                <Plus size={13} />
                <span>Add Bookmark</span>
              </button>
            </div>
          </div>

          {/* Main Manager Layout: Folders Sidebar + Bookmarks Content */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            {/* Folders Navigation Sidebar */}
            <div className="w-full md:w-56 p-3 border-b md:border-b-0 md:border-r border-black/5 dark:border-white/10 overflow-x-auto md:overflow-y-auto shrink-0 bg-black/[0.02] dark:bg-white/[0.02] flex md:flex-col gap-1">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1 hidden md:block">
                Collections
              </div>

              <button
                onClick={() => setSelectedFolderId('all')}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition ${
                  selectedFolderId === 'all'
                    ? 'bg-[#668b7b]/15 text-[#668b7b] dark:text-[#88b3a0]'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <BookmarkIcon size={14} />
                  <span>All Bookmarks</span>
                </span>
                <span className="text-[10px] opacity-70 bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-full">
                  {bookmarks.length}
                </span>
              </button>

              <button
                onClick={() => setSelectedFolderId('root')}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition ${
                  selectedFolderId === 'root'
                    ? 'bg-[#668b7b]/15 text-[#668b7b] dark:text-[#88b3a0]'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Folder size={14} className="text-gray-400" />
                  <span>Main Collection</span>
                </span>
                <span className="text-[10px] opacity-70 bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-full">
                  {bookmarks.filter(b => !b.folderId).length}
                </span>
              </button>

              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 pt-3 pb-1 hidden md:block">
                Folders
              </div>

              {bookmarkFolders.map(folder => {
                const count = bookmarks.filter(b => b.folderId === folder.id).length;
                const isSelected = selectedFolderId === folder.id;
                return (
                  <div
                    key={folder.id}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#668b7b]/15 text-[#668b7b] dark:text-[#88b3a0]'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                    onClick={() => setSelectedFolderId(folder.id)}
                  >
                    <span className="flex items-center gap-2 truncate pr-1">
                      <Folder size={14} className="text-amber-500 shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] opacity-70 bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-full group-hover:hidden">
                        {count}
                      </span>
                      {/* Folder quick actions on hover */}
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setFolderModal({
                              isOpen: true,
                              mode: 'rename',
                              folderId: folder.id,
                              name: folder.name,
                            });
                          }}
                          title="Rename folder"
                          className="p-1 hover:text-gray-900 dark:hover:text-white rounded"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            promptDeleteFolder(folder);
                          }}
                          title="Delete folder"
                          className="p-1 hover:text-red-500 rounded"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bookmarks List View */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-2">
                <div>
                  <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    {selectedFolderId === 'all'
                      ? 'All Saved Bookmarks'
                      : selectedFolderId === 'root'
                      ? 'Main Collection (Unfiled)'
                      : currentFolder?.name || 'Folder'}
                    {bookmarkSearchQuery && (
                      <span className="text-gray-400 font-normal">
                        — matching &quot;{bookmarkSearchQuery}&quot;
                      </span>
                    )}
                  </h3>
                </div>
                <span className="text-[11px] text-gray-400">
                  {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {filtered.length === 0 ? (
                /* Helpful Empty State */
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-gray-400 mb-3">
                    <BookmarkIcon size={22} />
                  </div>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {bookmarkSearchQuery
                      ? 'No bookmarks match your search'
                      : 'No bookmarks in this collection'}
                  </h4>
                  <p className="text-[11px] text-gray-400 max-w-xs mt-1">
                    {bookmarkSearchQuery
                      ? 'Try another search term or clear the filter.'
                      : 'Add bookmarks using the star button in the address bar or create one here.'}
                  </p>
                  <button
                    onClick={() =>
                      setBookmarkModal({
                        isOpen: true,
                        mode: 'create',
                        title: '',
                        url: '',
                        folderId:
                          selectedFolderId !== 'all' && selectedFolderId !== 'root'
                            ? selectedFolderId
                            : null,
                      })
                    }
                    className="mt-4 px-3.5 py-1.5 rounded-xl bg-[#668b7b] text-white text-xs font-medium hover:bg-[#557869] transition"
                  >
                    + Add New Bookmark
                  </button>
                </div>
              ) : (
                /* Bookmark Items Grid */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {filtered.map(bm => {
                    const bmFolder = bookmarkFolders.find(f => f.id === bm.folderId);
                    return (
                      <div
                        key={bm.id}
                        className="group p-3 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/5 dark:border-white/5 transition flex flex-col justify-between space-y-2.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              onClick={() => handleNavigate(bm.url, tab.id)}
                              className="text-left font-medium text-xs text-gray-900 dark:text-gray-100 hover:text-[#668b7b] transition truncate flex-1"
                              title={bm.title}
                            >
                              {bm.title}
                            </button>
                          </div>

                          <div className="text-[10px] text-gray-400 truncate mt-0.5" title={bm.url}>
                            {bm.url}
                          </div>

                          {bmFolder && (
                            <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-medium">
                              <Folder size={10} />
                              <span>{bmFolder.name}</span>
                            </span>
                          )}
                        </div>

                        {/* Card Action Toolbar */}
                        <div className="flex items-center justify-between border-t border-black/5 dark:border-white/10 pt-2 text-gray-400">
                          <button
                            onClick={() => handleNavigate(bm.url, tab.id)}
                            title="Open in current tab"
                            className="hover:text-[#668b7b] p-1 rounded transition text-[11px] flex items-center gap-1"
                          >
                            <span>Open</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenNewTab(bm.url, bm.title)}
                              title="Open in new tab"
                              className="p-1 hover:text-gray-700 dark:hover:text-gray-200 rounded"
                            >
                              <Plus size={13} />
                            </button>
                            <button
                              onClick={() => handleOpenExternal(bm.url)}
                              title="Open in external browser window"
                              className="p-1 hover:text-gray-700 dark:hover:text-gray-200 rounded"
                            >
                              <ExternalLink size={13} />
                            </button>
                            <button
                              onClick={() =>
                                setBookmarkModal({
                                  isOpen: true,
                                  mode: 'edit',
                                  bookmarkId: bm.id,
                                  title: bm.title,
                                  url: bm.url,
                                  folderId: bm.folderId || null,
                                })
                              }
                              title="Edit bookmark"
                              className="p-1 hover:text-gray-700 dark:hover:text-gray-200 rounded"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteBookmark(bm)}
                              title="Delete bookmark"
                              className="p-1 hover:text-red-500 rounded"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (tab.url === 'vega://history') {
      return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 w-full max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="text-[#668b7b]" size={20} />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Browsing History</h2>
            </div>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="px-3 py-1.5 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 text-xs rounded-lg font-medium transition flex items-center gap-1"
              >
                <Trash2 size={13} />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              No browsing history recorded yet. Visited web pages will appear here.
            </div>
          ) : (
            <div className="space-y-1.5">
              {history.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/5 dark:border-white/5 transition"
                >
                  <button
                    onClick={() => handleNavigate(item.url, tab.id)}
                    className="flex-1 text-left min-w-0 pr-2"
                  >
                    <strong className="block text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                      {item.title}
                    </strong>
                    <span className="text-[10px] text-gray-400 block truncate">{item.url}</span>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-gray-400">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => handleOpenNewTab(item.url, item.title)}
                      title="Open in new tab"
                      className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      onClick={() => {
                        const updated = removeHistoryEntry(item.id, history);
                        setHistory(updated);
                      }}
                      title="Remove from history"
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (tab.url === 'vega://settings') {
      return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 w-full max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-2 border-b border-black/5 dark:border-white/10 pb-4">
            <SettingsIcon className="text-[#668b7b]" size={20} />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Browser Settings</h2>
          </div>

          {/* Search Engine Selection */}
          <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 space-y-3">
            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
              Default Search Engine
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Queries entered directly into the address bar will be routed to this provider.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(SEARCH_ENGINES) as SearchEngineId[]).map(id => {
                const engine = SEARCH_ENGINES[id];
                const isSelected = settings.searchEngine === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleUpdateSettings({ searchEngine: id })}
                    className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-[#668b7b]/15 border-[#668b7b] text-[#668b7b] dark:text-[#88b3a0]'
                        : 'bg-white/50 dark:bg-white/5 border-black/5 dark:border-white/5 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span>{engine.name}</span>
                    {isSelected && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Home Page Config */}
          <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 space-y-3">
            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">Home Page</div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              The destination opened when clicking the Home icon or creating new tabs.
            </p>
            <input
              type="text"
              value={settings.homePage}
              onChange={e => handleUpdateSettings({ homePage: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-[#202722] border border-black/10 dark:border-white/10 rounded-xl text-xs"
            />
          </div>

          {/* Clear Browser Data */}
          <div className="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">Browsing Data</div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Clear stored navigation history safely without affecting other VEGA OS apps.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearHistory}
              className="px-3.5 py-1.5 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 text-xs font-medium rounded-xl transition"
            >
              Clear History
            </button>
          </div>
        </div>
      );
    }

    if (tab.url.startsWith('vega://error')) {
      let reason = 'unknown';
      let target = '';
      try {
        const queryPart = tab.url.split('?')[1] || '';
        const searchParams = new URLSearchParams(queryPart);
        reason = searchParams.get('reason') || 'unknown';
        target = searchParams.get('target') || '';
      } catch {}

      const isSecurity = reason === 'security-blocked';
      const isUnsupported = reason === 'unsupported-scheme';
      const isInvalid = reason === 'invalid-url';

      const title = isSecurity
        ? 'Navigation Blocked'
        : isUnsupported
        ? 'Unsupported Web Protocol'
        : isInvalid
        ? 'Invalid Web Address'
        : 'Navigation Error';

      const description = isSecurity
        ? 'Arbitrary script execution schemes (javascript:, data:, vbscript:) are blocked by VEGA OS to protect system state and user data.'
        : isUnsupported
        ? `The protocol scheme in "${target || 'this address'}" cannot be navigated directly inside VEGA Browser.`
        : isInvalid
        ? `The address "${target || ''}" could not be recognized as a valid URL.`
        : 'The requested page could not be displayed.';

      return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-arrive">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm ${
              isSecurity ? 'bg-red-500/15 text-red-500' : 'bg-amber-500/15 text-amber-500'
            }`}
          >
            <ShieldAlert size={28} />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mt-2 leading-relaxed">
            {description}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {target && !isSecurity && (
              <button
                type="button"
                onClick={() => {
                  const engine = SEARCH_ENGINES[settings.searchEngine] || SEARCH_ENGINES.google;
                  handleNavigate(`${engine.queryUrl}${encodeURIComponent(target)}`, tab.id);
                }}
                className="px-4 py-2 bg-[#668b7b] text-white text-xs font-medium rounded-xl hover:bg-[#557869] transition shadow-sm flex items-center gap-1.5"
              >
                <Search size={13} />
                <span>Search for destination</span>
              </button>
            )}

            {target && target.startsWith('http') && (
              <button
                type="button"
                onClick={() => handleOpenExternal(target)}
                className="px-4 py-2 bg-black/5 dark:bg-white/10 text-gray-800 dark:text-gray-200 text-xs font-medium rounded-xl hover:bg-black/10 dark:hover:bg-white/15 transition flex items-center gap-1.5"
              >
                <ExternalLink size={13} />
                <span>Open in Real Tab ↗</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleNavigate('vega://newtab', tab.id)}
              className="px-4 py-2 bg-black/5 dark:bg-white/10 text-gray-800 dark:text-gray-200 text-xs font-medium rounded-xl hover:bg-black/10 dark:hover:bg-white/15 transition"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    // 4. Handle Known Frame-Blocked Error or Tab Load Error
    if (tab.loadError) {
      const failedUrl = tab.loadError.failedUrl || tab.url;
      let searchQuery = '';
      try {
        const parsed = new URL(failedUrl);
        if (parsed.searchParams.has('q')) {
          searchQuery = parsed.searchParams.get('q') || '';
        }
      } catch {}

      return (
        <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-arrive overflow-y-auto">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mb-4 shadow-sm">
            <ShieldAlert size={32} />
          </div>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Website Security Restrictions Prevent In-Frame Display
          </h3>

          {/* Failed URL Chip */}
          <div className="mt-3 max-w-xl px-3 py-1.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl font-mono text-xs text-gray-700 dark:text-gray-300 truncate">
            {failedUrl}
          </div>

          <div className="max-w-lg mt-3 space-y-2 text-xs text-gray-600 dark:text-gray-400 leading-relaxed text-center">
            <p>
              {tab.loadError.message}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Modern websites protect user sessions and prevent clickjacking by sending{' '}
              <code className="font-mono text-[10px] bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">X-Frame-Options: SAMEORIGIN</code> or{' '}
              <code className="font-mono text-[10px] bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded">frame-ancestors 'self'</code> headers.
              These prevent in-browser operating environments from rendering the site inside an embedded frame.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => handleOpenExternal(failedUrl)}
              className="px-4 py-2 bg-[#668b7b] hover:bg-[#557869] text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <ExternalLink size={14} />
              <span>Open in Real Tab ↗</span>
            </button>

            <button
              type="button"
              onClick={() => handleRetryTab(tab.id)}
              className="px-4 py-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-gray-800 dark:text-gray-200 text-xs font-medium rounded-xl transition flex items-center gap-1.5"
            >
              <RotateCw size={13} />
              <span>Retry Loading</span>
            </button>

            {searchQuery && (
              <button
                type="button"
                onClick={() =>
                  handleNavigate(
                    `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(searchQuery)}`,
                    tab.id
                  )
                }
                className="px-4 py-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-gray-800 dark:text-gray-200 text-xs font-medium rounded-xl transition flex items-center gap-1.5"
                title="Search on Wikipedia, which allows embedded viewing"
              >
                <Search size={13} className="text-[#668b7b]" />
                <span>Search Wikipedia (Embeddable)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleNavigate('vega://newtab', tab.id)}
              className="px-4 py-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-gray-800 dark:text-gray-200 text-xs font-medium rounded-xl transition flex items-center gap-1.5"
            >
              <Home size={13} />
              <span>Return Home</span>
            </button>
          </div>
        </div>
      );
    }

    // Live Web Page (Iframe + Sandbox Notice)
    return (
      <div className="flex flex-col h-full w-full flex-1 min-h-0 relative">
        {/* Cross-Origin Banner */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/10 text-[11px] text-gray-500 dark:text-gray-400 shrink-0">
          <span className="flex items-center gap-1.5 truncate pr-2">
            <Globe size={12} className="text-[#668b7b] shrink-0" />
            <span className="truncate">Viewing {tab.url} (Embedded Frame)</span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setTabs(prev =>
                  prev.map(t =>
                    t.id === tab.id
                      ? {
                          ...t,
                          loadError: {
                            reason: 'frame-blocked',
                            failedUrl: tab.url,
                            message: `The website at ${tab.url} may be preventing embedded display or failing to respond inside an iframe.`,
                          },
                        }
                      : t
                  )
                );
              }}
              className="px-2 py-0.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-[10px] transition"
              title="If the screen is blank or not responding, open diagnostic options"
            >
              Blank screen?
            </button>
            <button
              type="button"
              onClick={() => handleOpenExternal(tab.url)}
              className="px-2.5 py-1 bg-[#668b7b] text-white rounded-lg text-[10px] font-medium flex items-center gap-1 shrink-0 hover:bg-[#557869] transition"
            >
              <ExternalLink size={11} />
              <span>Open in Real Tab ↗</span>
            </button>
          </div>
        </div>

        {/* Loading Overlay */}
        {tab.loading && (
          <div className="absolute inset-x-0 top-8 bottom-0 bg-[#f6f6f2]/80 dark:bg-[#181d19]/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <RotateCw size={24} className="animate-spin text-[#668b7b]" />
            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              Loading {tab.title || tab.url}…
            </span>
          </div>
        )}

        {/* Embedded Web Frame */}
        <iframe
          ref={el => {
            iframeRefs.current[tab.id] = el;
          }}
          src={tab.url}
          title={tab.title}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          className="w-full h-full flex-1 border-none bg-white min-h-0"
          onLoad={() => {
            if (tab.id === activeTab.id && reloadTimerRef.current) {
              clearTimeout(reloadTimerRef.current);
              reloadTimerRef.current = null;
            }
            setTabs(prev => prev.map(t => (t.id === tab.id ? { ...t, loading: false } : t)));
          }}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#f6f6f2] dark:bg-[#181d19] text-gray-800 dark:text-gray-200 select-none overflow-hidden font-sans relative">
      {/* 1. Browser Tab Bar */}
      <div className="flex items-center gap-1 px-2 pt-2 bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/10 shrink-0 select-none">
        {/* Scrollable Tab Strip Container */}
        <div
          ref={tabStripRef}
          onWheel={handleTabStripWheel}
          className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto scrollbar-none scroll-smooth"
        >
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId;
            if (tab.pinned) {
              return (
                <div
                  id={`tab-elem-${tab.id}`}
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  onContextMenu={e => handleTabContextMenu(e, tab.id)}
                  title={`${tab.title || 'Tab'} (Pinned)`}
                  className={`group relative flex items-center justify-center rounded-t-xl cursor-pointer transition w-9 h-8 border-t border-x shrink-0 ${
                    isActive
                      ? 'bg-white dark:bg-[#202722] text-gray-900 dark:text-white border-black/10 dark:border-white/10 shadow-sm'
                      : 'bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-transparent hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  {renderTabIcon(tab, isActive)}
                  <Pin size={8} className="absolute bottom-1 right-1 text-[#668b7b] opacity-80" />
                </div>
              );
            }

            return (
              <div
                id={`tab-elem-${tab.id}`}
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                onContextMenu={e => handleTabContextMenu(e, tab.id)}
                title={tab.title || tab.url}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-xl text-xs font-medium cursor-pointer transition max-w-[180px] min-w-[100px] border-t border-x shrink-0 ${
                  isActive
                    ? 'bg-white dark:bg-[#202722] text-gray-900 dark:text-white border-black/10 dark:border-white/10 shadow-sm'
                    : 'bg-black/5 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-transparent hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                {renderTabIcon(tab, isActive)}
                <span className="truncate flex-1">{tab.title || 'New Tab'}</span>
                <button
                  type="button"
                  onClick={e => handleCloseTab(tab.id, e)}
                  title="Close Tab"
                  aria-label="Close tab"
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/20 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>

        {/* New Tab Button */}
        <button
          type="button"
          onClick={() => handleOpenNewTab()}
          title="New Tab"
          aria-label="Open new browser tab"
          className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition shrink-0"
        >
          <Plus size={15} />
        </button>

        {/* Tab Overview Dropdown */}
        <div className="relative" ref={overviewRef}>
          <button
            type="button"
            onClick={() => setIsOverviewOpen(prev => !prev)}
            title="Tab overview"
            aria-label="Tab overview"
            aria-expanded={isOverviewOpen}
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition shrink-0"
          >
            <ChevronDown size={14} />
          </button>

          {isOverviewOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-64 max-h-72 overflow-y-auto rounded-xl bg-white dark:bg-[#202722] border border-black/10 dark:border-white/10 shadow-xl py-1 z-50 text-xs animate-arrive">
              <div className="px-3 py-1.5 border-b border-black/5 dark:border-white/5 font-semibold text-[11px] text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>Open Tabs ({tabs.length})</span>
                <button
                  onClick={() => {
                    handleOpenNewTab();
                    setIsOverviewOpen(false);
                  }}
                  className="text-[#668b7b] hover:underline normal-case font-normal text-xs"
                >
                  + New Tab
                </button>
              </div>
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  onClick={() => {
                    setActiveTabId(tab.id);
                    setIsOverviewOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer transition hover:bg-black/5 dark:hover:bg-white/5 ${
                    tab.id === activeTabId
                      ? 'bg-black/5 dark:bg-white/5 font-medium text-[#668b7b]'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    {renderTabIcon(tab, tab.id === activeTabId)}
                    <span className="truncate">{tab.title || 'New Tab'}</span>
                    {tab.pinned && <Pin size={10} className="text-[#668b7b] shrink-0" />}
                  </div>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleCloseTab(tab.id);
                    }}
                    title="Close Tab"
                    aria-label="Close tab"
                    className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Navigation & Address Bar */}
      <div className="flex items-center gap-1.5 p-2 px-3 bg-white dark:bg-[#202722] border-b border-black/5 dark:border-white/10 shrink-0 relative">
        {/* Navigation Buttons */}
        <button
          type="button"
          onClick={handleBack}
          disabled={!canGoBack(activeTab)}
          title="Back"
          aria-label="Back"
          className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          <ArrowLeft size={16} />
        </button>
        <button
          type="button"
          onClick={handleForward}
          disabled={!canGoForward(activeTab)}
          title="Forward"
          aria-label="Forward"
          className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          <ArrowRight size={16} />
        </button>
        <button
          type="button"
          onClick={handleReload}
          title={activeTab.loading ? 'Stop loading' : 'Reload'}
          aria-label={activeTab.loading ? 'Stop loading' : 'Reload'}
          className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          {activeTab.loading ? <X size={16} /> : <RotateCw size={15} />}
        </button>
        <button
          type="button"
          onClick={handleHome}
          title="Home"
          aria-label="Home"
          className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          <Home size={16} />
        </button>

        {/* Omnibox / Address Field */}
        <form onSubmit={handleAddressSubmit} className="flex-1 flex items-center relative min-w-0">
          <div className="absolute left-2.5 flex items-center text-gray-400 pointer-events-none">
            {activeTab.loading ? (
              <RotateCw size={13} className="animate-spin text-[#668b7b]" />
            ) : activeTab.loadError ? (
              <ShieldAlert size={14} className="text-amber-500" />
            ) : activeTab.url.startsWith('https://') ? (
              <Lock size={13} className="text-emerald-500" />
            ) : activeTab.url.startsWith('vega://error') ? (
              <ShieldAlert size={14} className="text-red-500" />
            ) : activeTab.url.startsWith('vega://') ? (
              <ShieldCheck size={14} className="text-[#668b7b]" />
            ) : (
              <Search size={13} />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            onFocus={e => e.target.select()}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                setInputUrl(activeTab.url);
                inputRef.current?.blur();
              }
            }}
            placeholder={`Search with ${SEARCH_ENGINES[settings.searchEngine]?.name || 'Google'} or enter address…`}
            aria-label="Address and search bar"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full pl-8 pr-20 py-1.5 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-xl text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#668b7b]"
          />

          <div className="absolute right-2 flex items-center gap-0.5">
            {/* Clear Input Button */}
            {inputUrl.length > 0 && (
              <button
                type="button"
                onClick={e => {
                  e.preventDefault();
                  setInputUrl('');
                  inputRef.current?.focus();
                }}
                title="Clear address bar"
                aria-label="Clear address bar"
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition"
              >
                <X size={12} />
              </button>
            )}

            {/* Bookmark star (opens bookmark popover) */}
            <button
              type="button"
              onClick={handleStarClick}
              title={isCurrentBookmarked ? 'Edit bookmark for this page' : 'Bookmark this tab'}
              aria-label={isCurrentBookmarked ? 'Edit bookmark for this page' : 'Bookmark this tab'}
              className="bookmark-star-toggle p-1 text-gray-400 hover:text-amber-500 transition rounded"
            >
              <Star
                size={14}
                className={isCurrentBookmarked ? 'fill-amber-400 text-amber-400' : ''}
              />
            </button>

            {/* External Tab Popout */}
            {activeTab.url.startsWith('http') && (
              <button
                type="button"
                onClick={() => handleOpenExternal(activeTab.url)}
                title="Open in external browser window"
                aria-label="Open in external browser window"
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
              >
                <ExternalLink size={13} />
              </button>
            )}
          </div>
        </form>

        {/* Address Bar Bookmark Popover */}
        {bookmarkPopover?.isOpen && (
          <div
            ref={bookmarkPopoverRef}
            className="absolute right-12 top-full mt-2 w-80 rounded-2xl bg-white dark:bg-[#202722] border border-black/10 dark:border-white/10 shadow-2xl p-4 z-50 text-xs animate-arrive font-sans"
          >
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10 mb-3">
              <div className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-gray-100">
                <Star size={14} className="fill-amber-400 text-amber-400" />
                <span>{bookmarkPopover.isExisting ? 'Edit Bookmark' : 'Add Bookmark'}</span>
              </div>
              <button
                type="button"
                onClick={() => setBookmarkPopover(null)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
              >
                <X size={14} />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                handleSaveBookmarkFromPopover();
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={bookmarkPopover.title}
                  onChange={e =>
                    setBookmarkPopover(prev => (prev ? { ...prev, title: e.target.value } : null))
                  }
                  className="w-full px-3 py-1.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#668b7b]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  URL
                </label>
                <input
                  type="text"
                  value={bookmarkPopover.url}
                  onChange={e =>
                    setBookmarkPopover(prev => (prev ? { ...prev, url: e.target.value } : null))
                  }
                  className="w-full px-3 py-1.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#668b7b]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Folder
                </label>
                <select
                  value={bookmarkPopover.folderId || ''}
                  onChange={e =>
                    setBookmarkPopover(prev =>
                      prev ? { ...prev, folderId: e.target.value || null } : null
                    )
                  }
                  className="w-full px-3 py-1.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#668b7b]"
                >
                  <option value="">Main Collection (Unfiled)</option>
                  {bookmarkFolders.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between pt-2">
                {bookmarkPopover.isExisting ? (
                  <button
                    type="button"
                    onClick={handleRemoveBookmarkFromPopover}
                    className="px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-lg text-xs font-medium transition"
                  >
                    Remove
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBookmarkPopover(null)}
                    className="px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300 font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-[#668b7b] hover:bg-[#557869] text-white rounded-lg text-xs font-medium transition shadow-sm"
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Browser More Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            title="Browser menu"
            aria-label="Browser menu"
            aria-expanded={isMenuOpen}
            className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition"
          >
            <MoreVertical size={16} />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-white dark:bg-[#202722] border border-black/10 dark:border-white/10 shadow-lg py-1 z-50 text-xs animate-arrive">
              <button
                onClick={() => {
                  handleOpenNewTab();
                  setIsMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
              >
                <Plus size={14} className="text-gray-400" />
                <span>New Tab</span>
              </button>

              <button
                onClick={() => {
                  handleNavigate('vega://bookmarks');
                  setIsMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
              >
                <BookmarkIcon size={14} className="text-gray-400" />
                <span>Bookmarks Manager</span>
              </button>

              <button
                onClick={() => {
                  handleNavigate('vega://history');
                  setIsMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
              >
                <Clock size={14} className="text-gray-400" />
                <span>Browsing History</span>
              </button>

              <button
                onClick={() => {
                  handleNavigate('vega://settings');
                  setIsMenuOpen(false);
                }}
                className="w-full px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
              >
                <SettingsIcon size={14} className="text-gray-400" />
                <span>Browser Settings</span>
              </button>

              {activeTab.url.startsWith('http') && (
                <>
                  <div className="h-px bg-black/5 dark:bg-white/5 my-1" />
                  <button
                    onClick={() => {
                      handleOpenExternal(activeTab.url);
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 text-[#668b7b]"
                  >
                    <ExternalLink size={14} />
                    <span>Open in Real Tab ↗</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Bookmarks Quick Bar */}
      <div
        ref={quickBarRef}
        className="flex items-center gap-1.5 px-3 py-1 bg-black/5 dark:bg-white/5 border-b border-black/5 dark:border-white/10 overflow-x-auto scrollbar-none text-[11px] shrink-0 select-none"
      >
        <button
          onClick={() => handleNavigate('vega://bookmarks')}
          title="Open Bookmarks Manager"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[#668b7b] hover:bg-black/10 dark:hover:bg-white/10 transition shrink-0 font-medium"
        >
          <BookmarkIcon size={12} />
          <span>Bookmarks</span>
        </button>

        <div className="w-px h-3 bg-black/10 dark:bg-white/10 shrink-0 mx-0.5" />

        {/* Bookmark Folders in Quick Bar */}
        {bookmarkFolders.map(folder => {
          const folderBookmarks = bookmarks.filter(b => b.folderId === folder.id);
          const isOpen = activeQuickFolderId === folder.id;
          return (
            <div key={folder.id} className="relative shrink-0">
              <button
                onClick={() => setActiveQuickFolderId(prev => (prev === folder.id ? null : folder.id))}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition text-gray-700 dark:text-gray-300 ${
                  isOpen ? 'bg-black/10 dark:hover:bg-white/10' : ''
                }`}
              >
                <Folder size={12} className="text-amber-500 shrink-0" />
                <span className="truncate max-w-[120px]">{folder.name}</span>
                <ChevronDown size={10} className="text-gray-400 shrink-0" />
              </button>

              {isOpen && (
                <div className="absolute left-0 top-full mt-1 w-52 max-h-60 overflow-y-auto rounded-xl bg-white dark:bg-[#202722] border border-black/10 dark:border-white/10 shadow-xl py-1 z-50 text-xs animate-arrive">
                  {folderBookmarks.length === 0 ? (
                    <div className="px-3 py-2 text-gray-400 text-[11px] text-center">Empty folder</div>
                  ) : (
                    folderBookmarks.map(bm => (
                      <button
                        key={bm.id}
                        onClick={() => {
                          handleNavigate(bm.url);
                          setActiveQuickFolderId(null);
                        }}
                        onAuxClick={e => {
                          if (e.button === 1) {
                            e.preventDefault();
                            handleOpenNewTab(bm.url, bm.title);
                            setActiveQuickFolderId(null);
                          }
                        }}
                        title={bm.url}
                        className="w-full px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 truncate text-gray-800 dark:text-gray-200"
                      >
                        <Globe size={11} className="text-gray-400 shrink-0" />
                        <span className="truncate flex-1">{bm.title}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Root Bookmarks in Quick Bar */}
        {bookmarks
          .filter(b => !b.folderId)
          .slice(0, 8)
          .map(bm => (
            <button
              key={bm.id}
              onClick={() => handleNavigate(bm.url)}
              onAuxClick={e => {
                if (e.button === 1) {
                  e.preventDefault();
                  handleOpenNewTab(bm.url, bm.title);
                }
              }}
              title={bm.url}
              className="px-2 py-0.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 whitespace-nowrap transition shrink-0"
            >
              {bm.title}
            </button>
          ))}
      </div>

      {/* 4. Tab Context Menu Overlay */}
      {tabContextMenu.isOpen && tabContextMenu.tabId && (() => {
        const menuTab = tabs.find(t => t.id === tabContextMenu.tabId);
        if (!menuTab) return null;

        return (
          <div
            ref={contextMenuRef}
            style={{ top: `${tabContextMenu.y}px`, left: `${tabContextMenu.x}px` }}
            className="fixed w-48 rounded-xl bg-white dark:bg-[#202722] border border-black/10 dark:border-white/10 shadow-2xl py-1 z-[100] text-xs animate-arrive font-sans select-none"
            onClick={e => e.stopPropagation()}
          >
            {/* Pin / Unpin */}
            <button
              onClick={() => {
                handleTogglePinTab(menuTab.id);
                setTabContextMenu({ isOpen: false, x: 0, y: 0, tabId: null });
              }}
              className="w-full px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 text-gray-700 dark:text-gray-200"
            >
              <Pin size={13} className={menuTab.pinned ? 'text-[#668b7b]' : 'text-gray-400'} />
              <span>{menuTab.pinned ? 'Unpin Tab' : 'Pin Tab'}</span>
            </button>

            {/* Duplicate Tab */}
            <button
              onClick={() => {
                handleDuplicateTab(menuTab.id);
                setTabContextMenu({ isOpen: false, x: 0, y: 0, tabId: null });
              }}
              className="w-full px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 text-gray-700 dark:text-gray-200"
            >
              <Copy size={13} className="text-gray-400" />
              <span>Duplicate Tab</span>
            </button>

            {/* Reload Tab */}
            <button
              onClick={() => {
                handleReloadSpecificTab(menuTab.id);
                setTabContextMenu({ isOpen: false, x: 0, y: 0, tabId: null });
              }}
              className="w-full px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 text-gray-700 dark:text-gray-200"
            >
              <RotateCw size={13} className="text-gray-400" />
              <span>Reload Tab</span>
            </button>

            <div className="h-px bg-black/5 dark:bg-white/5 my-1" />

            {/* Close Tab */}
            <button
              onClick={() => {
                handleCloseTab(menuTab.id);
                setTabContextMenu({ isOpen: false, x: 0, y: 0, tabId: null });
              }}
              className="w-full px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 text-red-600 dark:text-red-400"
            >
              <X size={13} />
              <span>Close Tab</span>
            </button>

            {/* Close Other Tabs */}
            {tabs.length > 1 && (
              <button
                onClick={() => {
                  handleCloseOtherTabs(menuTab.id);
                  setTabContextMenu({ isOpen: false, x: 0, y: 0, tabId: null });
                }}
                className="w-full px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 text-gray-500 dark:text-gray-400"
              >
                <span>Close Other Tabs</span>
              </button>
            )}
          </div>
        );
      })()}

      {/* 5. Add / Edit Bookmark Modal */}
      {bookmarkModal?.isOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4 z-[110] animate-arrive">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#202722] border border-black/10 dark:border-white/10 shadow-2xl p-5 space-y-4 font-sans select-none">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <BookmarkIcon size={16} className="text-[#668b7b]" />
                <span>{bookmarkModal.mode === 'edit' ? 'Edit Bookmark' : 'Add New Bookmark'}</span>
              </h3>
              <button
                onClick={() => setBookmarkModal(null)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
              >
                <X size={14} />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                const updated = saveBookmark(
                  {
                    id: bookmarkModal.bookmarkId,
                    title: bookmarkModal.title,
                    url: bookmarkModal.url,
                    folderId: bookmarkModal.folderId,
                  },
                  bookmarks
                );
                setBookmarks(updated);
                setBookmarkModal(null);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="Bookmark Title"
                  value={bookmarkModal.title}
                  onChange={e =>
                    setBookmarkModal(prev => (prev ? { ...prev, title: e.target.value } : null))
                  }
                  className="w-full px-3 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#668b7b]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  URL
                </label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={bookmarkModal.url}
                  onChange={e =>
                    setBookmarkModal(prev => (prev ? { ...prev, url: e.target.value } : null))
                  }
                  className="w-full px-3 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#668b7b]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Folder
                </label>
                <select
                  value={bookmarkModal.folderId || ''}
                  onChange={e =>
                    setBookmarkModal(prev =>
                      prev ? { ...prev, folderId: e.target.value || null } : null
                    )
                  }
                  className="w-full px-3 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#668b7b]"
                >
                  <option value="">Main Collection (Unfiled)</option>
                  {bookmarkFolders.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBookmarkModal(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-[#668b7b] hover:bg-[#557869] text-white font-medium transition shadow-sm"
                >
                  Save Bookmark
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Folder Create / Rename Modal */}
      {folderModal?.isOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4 z-[110] animate-arrive">
          <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#202722] border border-black/10 dark:border-white/10 shadow-2xl p-5 space-y-4 font-sans select-none">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <Folder size={16} className="text-amber-500" />
                <span>{folderModal.mode === 'create' ? 'Create Folder' : 'Rename Folder'}</span>
              </h3>
              <button
                onClick={() => setFolderModal(null)}
                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded"
              >
                <X size={14} />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (folderModal.mode === 'create') {
                  handleCreateFolder(folderModal.name);
                } else if (folderModal.folderId) {
                  handleRenameFolder(folderModal.folderId, folderModal.name);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Work Projects"
                  value={folderModal.name}
                  onChange={e =>
                    setFolderModal(prev => (prev ? { ...prev, name: e.target.value } : null))
                  }
                  autoFocus
                  className="w-full px-3 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#668b7b]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFolderModal(null)}
                  className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-[#668b7b] hover:bg-[#557869] text-white font-medium transition shadow-sm"
                >
                  {folderModal.mode === 'create' ? 'Create' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Delete Folder Confirmation Dialog */}
      {deleteFolderDialog?.isOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4 z-[110] animate-arrive">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#202722] border border-black/10 dark:border-white/10 shadow-2xl p-5 space-y-4 font-sans select-none">
            <div className="flex items-center gap-2 text-amber-500">
              <Folder size={20} />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Delete &quot;{deleteFolderDialog.folderName}&quot;?
              </h3>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              This folder contains{' '}
              <strong className="text-gray-800 dark:text-gray-200">
                {deleteFolderDialog.count}{' '}
                {deleteFolderDialog.count === 1 ? 'bookmark' : 'bookmarks'}
              </strong>
              . Choose what should happen to the saved bookmarks inside:
            </p>

            <div className="space-y-2 pt-1 text-xs">
              <button
                type="button"
                onClick={() => confirmDeleteFolder(false)}
                className="w-full p-2.5 rounded-xl bg-[#668b7b]/15 text-[#668b7b] dark:text-[#88b3a0] hover:bg-[#668b7b]/25 font-medium text-left transition flex items-center justify-between"
              >
                <span>Move bookmarks to Main Collection (Recommended)</span>
                <Check size={14} />
              </button>

              <button
                type="button"
                onClick={() => confirmDeleteFolder(true)}
                className="w-full p-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 font-medium text-left transition"
              >
                Delete folder and its contained bookmarks
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDeleteFolderDialog(null)}
                className="px-3.5 py-1.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 font-medium transition text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Undo Bookmark Delete Toast */}
      {undoToast?.isOpen && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-2xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 px-4 py-2.5 shadow-2xl flex items-center gap-3 z-[120] text-xs animate-arrive font-sans">
          <span className="truncate max-w-[200px]">
            Bookmark &quot;{undoToast.bookmark.title}&quot; deleted
          </span>
          <button
            onClick={handleUndoDelete}
            className="px-2.5 py-1 rounded-lg bg-white/20 dark:bg-black/10 font-medium hover:bg-white/30 dark:hover:bg-black/20 transition flex items-center gap-1 shrink-0 text-[#668b7b] dark:text-[#557869]"
          >
            <Undo2 size={12} />
            <span>Undo</span>
          </button>
          <button
            onClick={() => setUndoToast(null)}
            className="p-0.5 text-gray-400 hover:text-white dark:hover:text-black rounded"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* 9. Content Area - Multi-tab preservation container */}
      <div className="flex-1 relative overflow-hidden bg-white dark:bg-[#1a1f1b]">
        {/* Loading Progress Bar for active tab */}
        {activeTab.loading && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#668b7b] animate-pulse z-20" />
        )}

        {/* Render each tab pane; active tab is visible, others hidden to preserve DOM/iframe state */}
        {tabs.map(tab => {
          const isCurrentTabActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className="w-full h-full flex-col flex-1"
              style={{ display: isCurrentTabActive ? 'flex' : 'none' }}
            >
              {renderTabContent(tab)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
