import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  Save,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  Check,
  Menu,
  ArrowLeft,
  FileCode,
} from 'lucide-react';
import { useWindows } from '../windows/WindowManager';

type Node = {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId: string | null; // null for root
  size?: number;
  mime?: string;
  content?: string;
};

const DB_NAME = 'nexus-fs';
const STORE_NAME = 'nodes';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
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

function getAllNodes(db: IDBDatabase): Promise<Node[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as Node[]);
    req.onerror = () => reject(req.error);
  });
}

function putNode(db: IDBDatabase, node: Node): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(node);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function deleteNode(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html':
    case 'htm':
      return 'text/html';
    case 'css':
      return 'text/css';
    case 'js':
    case 'jsx':
    case 'mjs':
      return 'text/javascript';
    case 'ts':
    case 'tsx':
      return 'text/typescript';
    case 'json':
      return 'application/json';
    case 'md':
      return 'text/markdown';
    case 'xml':
      return 'text/xml';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'text/plain';
  }
}

export default function TextEditorApp() {
  const { state: windowState } = useWindows();
  const isActive = windowState.activeId === 'editor';

  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [savedContent, setSavedContent] = useState<string>('');
  const [sidebarFilter, setSidebarFilter] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return false;
  });
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Search state within editor
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [matchIndices, setMatchIndices] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);

  // Status bar cursor position
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Refs for preserving unsaved content across teardown
  const activeFileIdRef = useRef(activeFileId);
  const contentRef = useRef(content);
  const savedContentRef = useRef(savedContent);
  const dbRef = useRef(db);

  useEffect(() => {
    activeFileIdRef.current = activeFileId;
    contentRef.current = content;
    savedContentRef.current = savedContent;
    dbRef.current = db;
  }, [activeFileId, content, savedContent, db]);

  // Load database and nodes on mount
  useEffect(() => {
    let isMounted = true;
    let localDb: IDBDatabase | null = null;

    openDb()
      .then(database => {
        if (!isMounted) return;
        localDb = database;
        setDb(database);
        return getAllNodes(database);
      })
      .then(loaded => {
        if (!isMounted || !loaded) return;
        setNodes(loaded);
      })
      .catch(console.error);

    return () => {
      isMounted = false;
      // Best-effort auto-save dirty content on unmount
      if (
        localDb &&
        activeFileIdRef.current &&
        contentRef.current !== savedContentRef.current
      ) {
        const id = activeFileIdRef.current;
        const text = contentRef.current;
        const size = new Blob([text]).size;
        try {
          const tx = localDb.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(id);
          req.onsuccess = () => {
            if (req.result) {
              const updated = { ...req.result, content: text, size };
              const putTx = localDb?.transaction(STORE_NAME, 'readwrite');
              putTx?.objectStore(STORE_NAME).put(updated);
            }
          };
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  const activeFile = nodes.find(n => n.id === activeFileId && n.type === 'file') || null;
  const isDirty = activeFile !== null && content !== savedContent;
  const files = nodes.filter(n => n.type === 'file');
  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(sidebarFilter.toLowerCase())
  );

  // Save implementation
  const saveFile = useCallback(
    async (fileId: string, textToSave: string) => {
      if (!db) return;
      const target = nodes.find(n => n.id === fileId);
      if (!target) return;

      const size = new Blob([textToSave]).size;
      const updated: Node = {
        ...target,
        content: textToSave,
        size,
      };

      try {
        await putNode(db, updated);
        setNodes(prev => prev.map(n => (n.id === fileId ? updated : n)));
        setSavedContent(textToSave);
        setSaveToast('Saved!');
        setTimeout(() => {
          setSaveToast(null);
        }, 2000);
      } catch (err) {
        console.error('Failed to save file:', err);
      }
    },
    [db, nodes]
  );

  // Debounced auto-save: 5 seconds of inactivity
  useEffect(() => {
    if (!activeFileId || content === savedContent) return;

    const timer = setTimeout(() => {
      saveFile(activeFileId, content);
    }, 5000);

    return () => clearTimeout(timer);
  }, [content, savedContent, activeFileId, saveFile]);

  // Global keyboard shortcuts (Ctrl+S / Cmd+S, Ctrl+F / Cmd+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only process when Editor is the active window
      if (!isActive) return;

      const isMac =
        typeof navigator !== 'undefined' &&
        /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (activeFileId) {
          saveFile(activeFileId, content);
        }
      } else if (modifier && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        if (activeFileId) {
          setSearchOpen(true);
          setTimeout(() => {
            searchInputRef.current?.focus();
            searchInputRef.current?.select();
          }, 30);
        }
      } else if (e.key === 'Escape' && searchOpen) {
        e.preventDefault();
        setSearchOpen(false);
        textareaRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, activeFileId, content, saveFile, searchOpen]);

  // Track cursor position (Line, Column)
  const updateCursorPos = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const pos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, pos);
    const lines = textBefore.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    setCursorPos({ line, col });
  };

  // Switch to another file with preservation of unsaved changes
  const handleSelectFile = async (file: Node) => {
    if (file.id === activeFileId) {
      if (window.innerWidth < 768) setSidebarOpen(false);
      return;
    }

    if (activeFileId && content !== savedContent) {
      await saveFile(activeFileId, content);
    }

    setActiveFileId(file.id);
    const newContent = file.content ?? '';
    setContent(newContent);
    setSavedContent(newContent);
    setSearchOpen(false);
    setSearchQuery('');
    setCursorPos({ line: 1, col: 1 });
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  // Create new file
  const handleNewFile = async () => {
    if (!db) return;
    const input = window.prompt('Enter file name (e.g. notes.txt):');
    if (input === null) return;
    let filename = input.trim();
    if (!filename) {
      filename = 'untitled.txt';
    } else if (!filename.includes('.')) {
      filename = `${filename}.txt`;
    }

    if (activeFileId && content !== savedContent) {
      await saveFile(activeFileId, content);
    }

    const newNode: Node = {
      id: generateId(),
      name: filename,
      type: 'file',
      parentId: null,
      size: 0,
      mime: getMimeType(filename),
      content: '',
    };

    try {
      await putNode(db, newNode);
      setNodes(prev => [...prev, newNode]);
      setActiveFileId(newNode.id);
      setContent('');
      setSavedContent('');
      setSearchOpen(false);
      setSearchQuery('');
      setCursorPos({ line: 1, col: 1 });
      setSaveToast('Created file');
      setTimeout(() => setSaveToast(null), 2000);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    } catch (err) {
      console.error('Failed to create file:', err);
    }
  };

  // Rename file
  const handleRenameFile = async (e: React.MouseEvent, file: Node) => {
    e.stopPropagation();
    if (!db) return;
    const newName = window.prompt('Rename file:', file.name);
    if (!newName || !newName.trim() || newName.trim() === file.name) return;

    const trimmed = newName.trim();
    const updated: Node = {
      ...file,
      name: trimmed,
      mime: getMimeType(trimmed),
    };

    try {
      await putNode(db, updated);
      setNodes(prev => prev.map(n => (n.id === file.id ? updated : n)));
    } catch (err) {
      console.error('Failed to rename file:', err);
    }
  };

  // Delete file with confirmation
  const handleDeleteFile = async (e: React.MouseEvent, file: Node) => {
    e.stopPropagation();
    if (!db) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${file.name}"?`
    );
    if (!confirmed) return;

    try {
      await deleteNode(db, file.id);
      setNodes(prev => prev.filter(n => n.id !== file.id));
      if (activeFileId === file.id) {
        setActiveFileId(null);
        setContent('');
        setSavedContent('');
        setSearchOpen(false);
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  // Search logic within editor
  useEffect(() => {
    if (!searchQuery.trim()) {
      setMatchIndices([]);
      setCurrentMatchIndex(0);
      return;
    }
    const query = searchQuery.toLowerCase();
    const text = content.toLowerCase();
    const indices: number[] = [];
    let index = text.indexOf(query);
    while (index !== -1) {
      indices.push(index);
      index = text.indexOf(query, index + query.length || 1);
    }
    setMatchIndices(indices);
    setCurrentMatchIndex(prev =>
      indices.length > 0 ? Math.min(prev, indices.length - 1) : 0
    );
  }, [searchQuery, content]);

  const highlightMatch = useCallback(
    (indexInMatches: number, matches: number[]) => {
      if (
        matches.length === 0 ||
        indexInMatches < 0 ||
        indexInMatches >= matches.length
      )
        return;
      const startIndex = matches[indexInMatches];
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.focus();
      textarea.setSelectionRange(startIndex, startIndex + searchQuery.length);

      // Scroll textarea to visible selection
      const textBefore = content.substring(0, startIndex);
      const lineNumber = textBefore.split('\n').length;
      const approxLineHeight = 22;
      const targetScrollTop = Math.max(0, (lineNumber - 4) * approxLineHeight);
      textarea.scrollTop = targetScrollTop;
    },
    [content, searchQuery]
  );

  const goToNextMatch = () => {
    if (matchIndices.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matchIndices.length;
    setCurrentMatchIndex(nextIdx);
    highlightMatch(nextIdx, matchIndices);
  };

  const goToPrevMatch = () => {
    if (matchIndices.length === 0) return;
    const prevIdx =
      (currentMatchIndex - 1 + matchIndices.length) % matchIndices.length;
    setCurrentMatchIndex(prevIdx);
    highlightMatch(prevIdx, matchIndices);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchOpen(false);
      textareaRef.current?.focus();
    }
  };

  // Indent with tab key inside textarea
  const handleTextareaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const nextVal = val.substring(0, start) + '  ' + val.substring(end);
      setContent(nextVal);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        updateCursorPos();
      }, 0);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden text-gray-200 relative bg-[#1a1f1c]">
      {/* Mobile backdrop for sidebar drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          absolute inset-y-0 left-0 z-30 w-64 md:static md:translate-x-0
          flex flex-col bg-[#29332d] border-r border-[#3a473f]
          transition-transform duration-200 ease-in-out select-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Sidebar Header */}
        <div className="p-3 border-b border-[#3a473f] flex items-center justify-between min-h-[48px]">
          <div className="flex items-center gap-2">
            <FileCode size={18} className="text-emerald-400" />
            <span className="font-semibold text-sm tracking-wide text-gray-100">
              Files
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewFile}
              className="px-2 py-1.5 hover:bg-[#344037] text-gray-300 hover:text-white rounded transition-colors flex items-center gap-1 text-xs min-h-[36px] touch-manipulation"
              title="New File"
              aria-label="New File"
            >
              <Plus size={16} />
              <span>New</span>
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 md:hidden hover:bg-[#344037] text-gray-300 hover:text-white rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
              aria-label="Close Sidebar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sidebar Search/Filter */}
        <div className="p-2 border-b border-[#3a473f]">
          <div className="relative flex items-center">
            <Search
              size={14}
              className="absolute left-2.5 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Filter files..."
              value={sidebarFilter}
              onChange={e => setSidebarFilter(e.target.value)}
              className="w-full bg-[#1e2521] border border-[#3a473f] rounded px-2 pl-8 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
            {sidebarFilter && (
              <button
                onClick={() => setSidebarFilter('')}
                className="absolute right-2 text-gray-400 hover:text-gray-200 p-1"
                aria-label="Clear filter"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {files.length === 0 ? (
            <div className="text-center py-8 px-3 text-gray-400 text-xs">
              <p>No files yet.</p>
              <button
                onClick={handleNewFile}
                className="mt-3 text-emerald-400 hover:underline flex items-center justify-center gap-1 mx-auto text-xs font-medium py-1 px-2 rounded hover:bg-[#344037]"
              >
                <Plus size={14} /> Create one
              </button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">
              No matching files
            </div>
          ) : (
            filteredFiles.map(file => {
              const isActive = file.id === activeFileId;
              const fileIsDirty = isActive && isDirty;

              return (
                <div
                  key={file.id}
                  onClick={() => handleSelectFile(file)}
                  className={`
                    group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-xs
                    transition-colors min-h-[44px] md:min-h-[36px] touch-manipulation
                    ${
                      isActive
                        ? 'bg-[#37453d] text-white font-medium shadow-sm'
                        : 'text-gray-300 hover:bg-[#303c35] hover:text-white'
                    }
                  `}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                    <FileText
                      size={15}
                      className={
                        isActive
                          ? 'text-emerald-400 shrink-0'
                          : 'text-gray-400 shrink-0'
                      }
                    />
                    <span className="truncate">{file.name}</span>
                    {fileIsDirty && (
                      <span
                        className="w-2 h-2 rounded-full bg-amber-400 shrink-0 inline-block"
                        title="Unsaved changes"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => handleRenameFile(e, file)}
                      className="p-1.5 hover:bg-[#43534a] rounded text-gray-300 hover:text-white min-h-[32px] min-w-[32px] flex items-center justify-center"
                      title="Rename file"
                      aria-label={`Rename ${file.name}`}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={e => handleDeleteFile(e, file)}
                      className="p-1.5 hover:bg-red-950/60 hover:text-red-300 rounded text-gray-400 min-h-[32px] min-w-[32px] flex items-center justify-center"
                      title="Delete file"
                      aria-label={`Delete ${file.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Editor Main Area */}
      <main className="flex-1 flex flex-col h-full bg-[#1a1f1c] min-w-0 overflow-hidden">
        {!activeFile ? (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-400 bg-[#1a1f1c] relative select-none">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden absolute top-3 left-3 p-2 hover:bg-[#344037] text-gray-300 rounded min-h-[44px] min-w-[44px] flex items-center gap-2 text-xs border border-[#3a473f]"
              aria-label="Open Files"
            >
              <Menu size={18} />
              <span>Files</span>
            </button>
            <FileText size={48} className="mb-4 text-gray-500 opacity-40" />
            {files.length === 0 ? (
              <>
                <h2 className="text-lg font-medium text-gray-200 mb-1">
                  No files yet
                </h2>
                <p className="text-sm text-gray-400 max-w-sm mb-6">
                  No files yet. Create one to get started.
                </p>
                <button
                  onClick={handleNewFile}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow transition-colors min-h-[44px] touch-manipulation"
                >
                  <Plus size={16} /> New File
                </button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-medium text-gray-200 mb-1">
                  Select a file or create a new one
                </h2>
                <p className="text-sm text-gray-400 max-w-sm mb-6">
                  Choose a file from the sidebar or create a new file to start
                  editing.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden flex items-center gap-2 px-4 py-2.5 bg-[#2d3831] hover:bg-[#38463e] text-gray-200 rounded-lg text-sm font-medium border border-[#3a473f] transition-colors min-h-[44px] touch-manipulation"
                  >
                    <FileText size={16} /> Browse Files
                  </button>
                  <button
                    onClick={handleNewFile}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow transition-colors min-h-[44px] touch-manipulation"
                  >
                    <Plus size={16} /> New File
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Active File Editor */
          <>
            {/* Toolbar / Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#222a25] border-b border-[#3a473f] text-xs select-none min-h-[48px]">
              {/* Left: Mobile back button, Tab header */}
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 -ml-1 hover:bg-[#344037] text-gray-300 hover:text-white rounded min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
                  aria-label="Back to file list"
                  title="Files"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="flex items-center gap-2 px-3 py-1 bg-[#1a1f1c] rounded-md border border-[#3a473f] max-w-[200px] sm:max-w-xs md:max-w-sm">
                  <FileText size={14} className="text-emerald-400 shrink-0" />
                  <span className="truncate text-gray-200 font-medium">
                    {activeFile.name}
                  </span>
                  {isDirty ? (
                    <span
                      className="flex items-center gap-1 text-[11px] text-amber-400 font-normal shrink-0"
                      title="Unsaved changes"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
                      <span className="hidden sm:inline">Unsaved</span>
                    </span>
                  ) : (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 shrink-0"
                      title="All changes saved"
                    />
                  )}
                </div>
              </div>

              {/* Right: Save Toast, Search Toggle, Save Button */}
              <div className="flex items-center gap-2">
                {saveToast && (
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs px-2.5 py-1 bg-emerald-950/60 border border-emerald-800/40 rounded shadow-sm animate-fade-in">
                    <Check size={12} />
                    <span>{saveToast}</span>
                  </div>
                )}

                <button
                  onClick={() => {
                    setSearchOpen(prev => !prev);
                    if (!searchOpen) {
                      setTimeout(() => {
                        searchInputRef.current?.focus();
                        searchInputRef.current?.select();
                      }, 50);
                    }
                  }}
                  className={`p-2 md:px-2.5 md:py-1 rounded flex items-center gap-1.5 transition-colors min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 justify-center touch-manipulation ${
                    searchOpen
                      ? 'bg-emerald-800/40 text-emerald-300 border border-emerald-700/50'
                      : 'hover:bg-[#344037] text-gray-300 hover:text-white'
                  }`}
                  title="Search in file (Ctrl+F)"
                  aria-label="Find in file"
                >
                  <Search size={15} />
                  <span className="hidden sm:inline">Find</span>
                </button>

                <button
                  onClick={() => saveFile(activeFile.id, content)}
                  disabled={!isDirty}
                  className={`
                    px-3 py-1.5 md:py-1 rounded flex items-center gap-1.5 font-medium transition-colors min-h-[44px] md:min-h-0 touch-manipulation
                    ${
                      isDirty
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                        : 'bg-[#2a352f] text-gray-400 cursor-default opacity-60'
                    }
                  `}
                  title="Save (Ctrl+S)"
                  aria-label="Save file"
                >
                  <Save size={15} />
                  <span>Save</span>
                </button>
              </div>
            </div>

            {/* In-Editor Search Bar */}
            {searchOpen && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#26312a] border-b border-[#3a473f] text-xs">
                <div className="relative flex-1 max-w-sm">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Find in document..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full bg-[#1a1f1c] border border-[#3a473f] rounded px-2.5 py-1 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="text-gray-400 text-xs tabular-nums whitespace-nowrap min-w-[60px]">
                  {searchQuery.trim() ? (
                    matchIndices.length > 0 ? (
                      `${currentMatchIndex + 1} of ${matchIndices.length}`
                    ) : (
                      'No matches'
                    )
                  ) : (
                    ''
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={goToPrevMatch}
                    disabled={matchIndices.length === 0}
                    className="p-1 hover:bg-[#344037] disabled:opacity-30 rounded text-gray-300 hover:text-white min-h-[32px] min-w-[32px] flex items-center justify-center"
                    title="Previous match (Shift+Enter)"
                    aria-label="Previous match"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={goToNextMatch}
                    disabled={matchIndices.length === 0}
                    className="p-1 hover:bg-[#344037] disabled:opacity-30 rounded text-gray-300 hover:text-white min-h-[32px] min-w-[32px] flex items-center justify-center"
                    title="Next match (Enter)"
                    aria-label="Next match"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setSearchOpen(false);
                      textareaRef.current?.focus();
                    }}
                    className="p-1 hover:bg-[#344037] rounded text-gray-400 hover:text-gray-200 ml-1 min-h-[32px] min-w-[32px] flex items-center justify-center"
                    title="Close search (Esc)"
                    aria-label="Close search"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Large Textarea Area */}
            <div className="flex-1 relative overflow-hidden flex flex-col">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e => {
                  setContent(e.target.value);
                  updateCursorPos();
                }}
                onClick={updateCursorPos}
                onKeyUp={updateCursorPos}
                onSelect={updateCursorPos}
                onKeyDown={handleTextareaKeyDown}
                spellCheck={false}
                placeholder="Start typing..."
                className="flex-1 w-full p-4 bg-[#1a1f1c] text-gray-200 font-mono text-sm leading-relaxed resize-none border-none outline-none overflow-y-auto"
                style={{
                  fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace",
                }}
              />
            </div>

            {/* Status Bar / Footer */}
            <footer className="flex items-center justify-between px-3 py-1.5 bg-[#222a25] border-t border-[#3a473f] text-[11px] text-gray-400 select-none min-h-[30px]">
              <div className="flex items-center gap-3">
                <span>
                  Ln {cursorPos.line}, Col {cursorPos.col}
                </span>
                <span>
                  {content ? content.split('\n').length : 1} lines
                </span>
                <span>{content.length} chars</span>
              </div>
              <div className="flex items-center gap-3">
                {isDirty ? (
                  <span className="text-amber-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
                    <span>Unsaved changes</span>
                  </span>
                ) : (
                  <span className="text-emerald-500/80 flex items-center gap-1">
                    <Check size={11} />
                    <span>Saved</span>
                  </span>
                )}
                <span className="hidden sm:inline text-gray-600">|</span>
                <span className="hidden sm:inline">UTF-8</span>
              </div>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
