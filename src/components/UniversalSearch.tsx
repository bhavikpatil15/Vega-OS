// src/components/UniversalSearch.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  X,
  Folder,
  File,
  Settings,
  SlidersHorizontal,
  Sun,
  Moon,
  Layers,
  Volume2,
  Wifi,
  Bluetooth,
  BellOff,
  Clock,
  ArrowRight,
  CornerDownLeft,
  Sparkles,
  History,
  Trash2,
  FileText,
} from 'lucide-react';
import { apps, type AppId } from '../apps';
import {
  getRecentItems,
  saveRecentItem,
  clearRecentItems,
  fetchVirtualNodes,
  type RecentItem,
} from '../searchUtils';

export interface SearchResultItem {
  id: string;
  category: 'Applications' | 'Files & Folders' | 'Settings' | 'Recent Items';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  action: () => void;
  priority: number; // Higher ranks higher
}

interface UniversalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenApp: (id: AppId) => void;
  onOpenSettingsSection?: (section?: string) => void;
  onOpenQuickSettings: () => void;
  onOpenFileInEditor: (fileId: string) => void;
}

// Highlight matching substring
function renderHighlighted(text: string, query: string) {
  if (!query.trim()) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + lowerQuery.length);
  const after = text.slice(index + lowerQuery.length);

  return (
    <>
      {before}
      <mark className="search-highlight">{match}</mark>
      {after}
    </>
  );
}

export const UniversalSearch: React.FC<UniversalSearchProps> = ({
  isOpen,
  onClose,
  onOpenApp,
  onOpenSettingsSection,
  onOpenQuickSettings,
  onOpenFileInEditor,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [virtualNodes, setVirtualNodes] = useState<Array<{ id: string; name: string; type: 'folder' | 'file'; mime?: string }>>([]);
  const [recentItems, setRecentItems] = useState(getRecentItems);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setRecentItems(getRecentItems());
      // Load virtual nodes once when opened
      fetchVirtualNodes().then(nodes => setVirtualNodes(nodes));
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  // Defined OS Settings searchable entries
  const availableSettings = useMemo(() => [
    {
      id: 'setting-theme',
      title: 'Appearance & Themes',
      subtitle: 'Light, Dark, and System styling options',
      icon: <Sun size={15} />,
      action: () => {
        saveRecentItem({ id: 'setting-theme', type: 'setting', title: 'Appearance & Themes', subtitle: 'Settings' });
        onOpenApp('settings');
        onClose();
      },
      keywords: ['theme', 'dark', 'light', 'mode', 'color', 'appearance'],
    },
    {
      id: 'setting-accent',
      title: 'Accent Colors',
      subtitle: 'Customize OS system highlight color',
      icon: <Sparkles size={15} />,
      action: () => {
        saveRecentItem({ id: 'setting-accent', type: 'setting', title: 'Accent Colors', subtitle: 'Settings' });
        onOpenApp('settings');
        onClose();
      },
      keywords: ['accent', 'color', 'palette', 'green', 'blue', 'orange'],
    },
    {
      id: 'setting-wallpaper',
      title: 'Wallpaper Selection',
      subtitle: 'Abstract 3D sculpture or photography backgrounds',
      icon: <SlidersHorizontal size={15} />,
      action: () => {
        saveRecentItem({ id: 'setting-wallpaper', type: 'setting', title: 'Wallpaper Selection', subtitle: 'Settings' });
        onOpenApp('settings');
        onClose();
      },
      keywords: ['wallpaper', 'background', 'photo', 'dune', 'mountain', 'space'],
    },
    {
      id: 'setting-3d',
      title: '3D Spatial Workspace',
      subtitle: 'Spatial depth, Three.js WebGL, and parallax options',
      icon: <Layers size={15} />,
      action: () => {
        saveRecentItem({ id: 'setting-3d', type: 'setting', title: '3D Spatial Workspace', subtitle: 'Settings' });
        onOpenApp('settings');
        onClose();
      },
      keywords: ['3d', 'spatial', 'workspace', 'webgl', 'depth', 'parallax'],
    },
    {
      id: 'setting-motion',
      title: 'Animations & Reduced Motion',
      subtitle: 'Toggle motion effects and UI transitions',
      icon: <SlidersHorizontal size={15} />,
      action: () => {
        saveRecentItem({ id: 'setting-motion', type: 'setting', title: 'Animations & Reduced Motion', subtitle: 'Settings' });
        onOpenApp('settings');
        onClose();
      },
      keywords: ['animation', 'reduced', 'motion', 'accessibility'],
    },
    {
      id: 'setting-volume',
      title: 'Sound & Audio Volume',
      subtitle: 'Adjust browser master sound level',
      icon: <Volume2 size={15} />,
      action: () => {
        saveRecentItem({ id: 'setting-volume', type: 'setting', title: 'Sound & Audio Volume', subtitle: 'Quick Settings' });
        onOpenQuickSettings();
        onClose();
      },
      keywords: ['volume', 'audio', 'sound', 'mute', 'speaker'],
    },
    {
      id: 'setting-brightness',
      title: 'Display Brightness',
      subtitle: 'Simulate screen backlight brightness',
      icon: <Sun size={15} />,
      action: () => {
        saveRecentItem({ id: 'setting-brightness', type: 'setting', title: 'Display Brightness', subtitle: 'Quick Settings' });
        onOpenQuickSettings();
        onClose();
      },
      keywords: ['brightness', 'display', 'screen', 'dim'],
    },
    {
      id: 'setting-wifi',
      title: 'Wi-Fi Network',
      subtitle: 'Simulated network connection status',
      icon: <Wifi size={15} />,
      action: () => {
        saveRecentItem({ id: 'setting-wifi', type: 'setting', title: 'Wi-Fi Network', subtitle: 'Quick Settings' });
        onOpenQuickSettings();
        onClose();
      },
      keywords: ['wifi', 'network', 'internet', 'connection', 'wireless'],
    },
    {
      id: 'setting-bluetooth',
      title: 'Bluetooth',
      subtitle: 'Simulated peripheral connectivity',
      icon: <Bluetooth size={15} />,
      action: () => {
        saveRecentItem({ id: 'setting-bluetooth', type: 'setting', title: 'Bluetooth', subtitle: 'Quick Settings' });
        onOpenQuickSettings();
        onClose();
      },
      keywords: ['bluetooth', 'peripherals', 'wireless', 'pairing'],
    },
    {
      id: 'setting-dnd',
      title: 'Do Not Disturb (DND)',
      subtitle: 'Mute floating notification alert banners',
      icon: <BellOff size={15} />,
      action: () => {
        saveRecentItem({ id: 'setting-dnd', type: 'setting', title: 'Do Not Disturb', subtitle: 'Quick Settings' });
        onOpenQuickSettings();
        onClose();
      },
      keywords: ['dnd', 'disturb', 'notification', 'mute', 'alerts', 'quiet'],
    },
    {
      id: 'setting-reset',
      title: 'Reset Preferences & Storage',
      subtitle: 'Clear local application data and restore defaults',
      icon: <Trash2 size={15} />,
      action: () => {
        saveRecentItem({ id: 'setting-reset', type: 'setting', title: 'Reset Preferences', subtitle: 'Settings' });
        onOpenApp('settings');
        onClose();
      },
      keywords: ['reset', 'clear', 'storage', 'defaults', 'wipe'],
    },
  ], [onOpenApp, onOpenQuickSettings, onClose]);

  // Compute results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    // 1. When query is empty: Show Recent Items + Default Suggestions
    if (!q) {
      const recentResults: SearchResultItem[] = recentItems.map(item => {
        if (item.type === 'app') {
          const appDef = apps.find(a => a.id === item.id);
          const IconComponent = appDef ? appDef.icon : Sparkles;
          return {
            id: `recent-${item.id}`,
            category: 'Recent Items',
            title: item.title,
            subtitle: item.subtitle,
            icon: <IconComponent size={16} />,
            action: () => {
              saveRecentItem(item);
              onOpenApp(item.id as AppId);
              onClose();
            },
            priority: 10,
          };
        } else if (item.type === 'file') {
          return {
            id: `recent-file-${item.id}`,
            category: 'Recent Items',
            title: item.title,
            subtitle: item.subtitle,
            icon: <File size={16} />,
            action: () => {
              saveRecentItem(item);
              onOpenFileInEditor(item.id);
              onClose();
            },
            priority: 9,
          };
        } else {
          return {
            id: `recent-setting-${item.id}`,
            category: 'Recent Items',
            title: item.title,
            subtitle: item.subtitle,
            icon: <Settings size={16} />,
            action: () => {
              saveRecentItem(item);
              if (item.subtitle.includes('Quick')) {
                onOpenQuickSettings();
              } else {
                onOpenApp('settings');
              }
              onClose();
            },
            priority: 8,
          };
        }
      });

      // Quick Applications list as suggestions
      const appSuggestions: SearchResultItem[] = apps.slice(0, 4).map(a => ({
        id: `sugg-app-${a.id}`,
        category: 'Applications',
        title: a.name,
        subtitle: a.detail,
        icon: <a.icon size={16} />,
        action: () => {
          saveRecentItem({ id: a.id, type: 'app', title: a.name, subtitle: a.detail });
          onOpenApp(a.id);
          onClose();
        },
        priority: 5,
      }));

      return [...recentResults, ...appSuggestions];
    }

    // 2. When query is populated: Search Applications, Files, and Settings
    const matchedItems: SearchResultItem[] = [];

    // Category: Applications
    apps.forEach(a => {
      const name = a.name.toLowerCase();
      const detail = a.detail.toLowerCase();
      let score = 0;

      if (name === q) score = 100; // Exact match
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else if (detail.includes(q)) score = 40;

      if (score > 0) {
        matchedItems.push({
          id: `app-${a.id}`,
          category: 'Applications',
          title: a.name,
          subtitle: a.detail,
          icon: <a.icon size={16} />,
          action: () => {
            saveRecentItem({ id: a.id, type: 'app', title: a.name, subtitle: a.detail });
            onOpenApp(a.id);
            onClose();
          },
          priority: score + 10, // Applications prioritize over files/settings
        });
      }
    });

    // Category: Files and Folders
    virtualNodes.forEach(node => {
      const name = node.name.toLowerCase();
      let score = 0;

      if (name === q) score = 90;
      else if (name.startsWith(q)) score = 70;
      else if (name.includes(q)) score = 50;

      if (score > 0) {
        const isFolder = node.type === 'folder';
        matchedItems.push({
          id: `node-${node.id}`,
          category: 'Files & Folders',
          title: node.name,
          subtitle: isFolder ? 'Virtual Directory • Files' : 'Text Document • Editor',
          icon: isFolder ? <Folder size={16} className="text-[#668b7b]" /> : <File size={16} className="text-blue-500" />,
          action: () => {
            saveRecentItem({ id: node.id, type: 'file', title: node.name, subtitle: isFolder ? 'Directory' : 'File' });
            if (isFolder) {
              onOpenApp('files');
            } else {
              onOpenFileInEditor(node.id);
            }
            onClose();
          },
          priority: score,
        });
      }
    });

    // Category: Settings
    availableSettings.forEach(s => {
      const title = s.title.toLowerCase();
      const subtitle = s.subtitle.toLowerCase();
      let score = 0;

      if (title === q) score = 85;
      else if (title.startsWith(q)) score = 65;
      else if (title.includes(q)) score = 45;
      else if (subtitle.includes(q)) score = 30;
      else if (s.keywords.some(k => k.includes(q) || q.includes(k))) score = 40;

      if (score > 0) {
        matchedItems.push({
          id: s.id,
          category: 'Settings',
          title: s.title,
          subtitle: s.subtitle,
          icon: s.icon,
          action: s.action,
          priority: score,
        });
      }
    });

    // Sort: High priority first
    return matchedItems.sort((a, b) => b.priority - a.priority);
  }, [query, recentItems, virtualNodes, availableSettings, onOpenApp, onOpenFileInEditor, onOpenQuickSettings, onClose]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Keyboard navigation inside search panel
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        results[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [results, selectedIndex, onClose]);

  // Auto-scroll selected element into view
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;
    const selectedEl = listEl.querySelector<HTMLElement>('.is-selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  // Group results by category for clean UI sectioning
  const groupedCategories = results.reduce<Record<string, SearchResultItem[]>>((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});

  let globalItemIndex = 0;

  return (
    <div
      className="universal-search-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Universal Search Spotlight"
      onPointerDown={e => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div className="universal-search-modal" ref={containerRef} onKeyDown={handleKeyDown}>
        {/* Search Input Bar */}
        <div className="search-input-wrap">
          <Search size={18} className="search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search applications, files, settings… (↑↓ to select, ↵ to open)"
            aria-label="Search VEGA OS"
            className="search-input"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="clear-search-btn"
              aria-label="Clear search query"
            >
              <X size={15} />
            </button>
          ) : (
            <kbd className="esc-badge">esc</kbd>
          )}
        </div>

        {/* Results Container */}
        <div className="search-results-list" ref={listRef} role="listbox">
          {results.length > 0 ? (
            Object.entries(groupedCategories).map(([category, items]) => (
              <div key={category} className="search-category-group">
                <div className="search-category-header flex items-center justify-between">
                  <span>{category.toUpperCase()}</span>
                  {category === 'Recent Items' && recentItems.length > 0 && !query && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        clearRecentItems();
                        setRecentItems([]);
                      }}
                      className="clear-recent-btn"
                      title="Clear Recent History"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  {items.map(item => {
                    const currentIndex = globalItemIndex++;
                    const isSelected = currentIndex === selectedIndex;

                    return (
                      <div
                        key={item.id}
                        role="option"
                        aria-selected={isSelected}
                        className={`search-result-row ${isSelected ? 'is-selected' : ''}`}
                        onClick={item.action}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                      >
                        <span className="result-icon-badge" aria-hidden="true">
                          {item.icon}
                        </span>

                        <div className="result-text-group min-w-0 flex-1">
                          <strong className="result-title truncate">
                            {renderHighlighted(item.title, query)}
                          </strong>
                          <span className="result-subtitle truncate">
                            {renderHighlighted(item.subtitle, query)}
                          </span>
                        </div>

                        <span className="result-action-hint" aria-hidden="true">
                          {isSelected && <CornerDownLeft size={13} />}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="search-empty-state">
              <Search size={32} className="text-muted opacity-30 mb-2.5 mx-auto" />
              <strong>No results found for "{query}"</strong>
              <p>Try searching for an installed app, file, or setting.</p>
            </div>
          )}
        </div>

        {/* Keyboard Footer Bar */}
        <div className="search-footer-bar flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-muted">
            <span className="flex items-center gap-1">
              <kbd className="key-cap">↑</kbd>
              <kbd className="key-cap">↓</kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="key-cap">↵</kbd>
              <span>Open</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="key-cap">esc</kbd>
              <span>Close</span>
            </span>
          </div>

          <span className="text-[10px] text-muted font-medium">
            VEGA OS Spotlight
          </span>
        </div>
      </div>
    </div>
  );
};
