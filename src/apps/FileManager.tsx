// src/apps/FileManager.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  Folder,
  File,
  Upload,
  Download,
  Plus,
  Search,
  List,
  Grid,
  ArrowLeft,
  Edit2,
  Trash2,
  ArrowRight,
  FileEdit,
} from 'lucide-react';
import { useWindows } from '../windows/WindowManager';
import { sendOSNotification } from '../notificationSystem';

/**
 * Simple IndexedDB wrapper for storing file system nodes.
 * Each node represents either a folder or a file.
 */
type Node = {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId: string | null; // null for root
  size?: number; // bytes for files
  mime?: string; // mime type for files
  content?: string; // text content for files (optional)
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

/** Utility helpers */
function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * FileManager component – renders a virtual file system inside a window.
 * All data lives in IndexedDB; the UI is fully responsive and works on mobile.
 */
export default function FileManager() {
  const { dispatch } = useWindows();
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null); // null = root
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load DB and root nodes on mount
  useEffect(() => {
    openDb()
      .then(database => {
        setDb(database);
        return getAllNodes(database);
      })
      .then(loaded => {
        if (loaded.length === 0) {
          // initialise a single root folder (implicit)
          setNodes([]);
        } else {
          setNodes(loaded);
        }
      })
      .catch(console.error);
    // cleanup on unmount
    return () => {
      db?.close();
    };
  }, []);

  const saveNode = (node: Node) => {
    if (!db) return;
    putNode(db, node)
      .then(() => setNodes(prev => {
        const without = prev.filter(n => n.id !== node.id);
        return [...without, node];
      }))
      .catch(console.error);
  };

  const removeNode = (id: string) => {
    if (!db) return;
    // Delete recursively for folders
    const toDelete = [id];
    const collectChildren = (parentId: string) => {
      nodes.filter(n => n.parentId === parentId).forEach(child => {
        toDelete.push(child.id);
        if (child.type === 'folder') collectChildren(child.id);
      });
    };
    const target = nodes.find(n => n.id === id);
    if (target?.type === 'folder') collectChildren(id);
    Promise.all(toDelete.map(delId => deleteNode(db, delId)))
      .then(() => setNodes(prev => prev.filter(n => !toDelete.includes(n.id))))
      .catch(console.error);
  };

  const currentChildren = nodes.filter(n => n.parentId === currentFolderId);

  // UI actions
  const createFolder = () => {
    const name = prompt('Folder name');
    if (!name) return;
    const newFolder: Node = { id: generateId(), name, type: 'folder', parentId: currentFolderId };
    saveNode(newFolder);
    sendOSNotification({
      appName: 'Files',
      title: 'Folder Created',
      message: `Created folder "${name}"`,
    });
  };

  const createFile = () => {
    const name = prompt('File name (without extension)');
    if (!name) return;
    const ext = prompt('Extension (e.g., txt)');
    const fullName = ext ? `${name}.${ext}` : name;
    const newFile: Node = { id: generateId(), name: fullName, type: 'file', parentId: currentFolderId, size: 0, mime: 'text/plain', content: '' };
    saveNode(newFile);
  };

  const renameNode = (node: Node) => {
    const newName = prompt('New name', node.name);
    if (!newName) return;
    const updated = { ...node, name: newName };
    saveNode(updated);
  };

  const moveNode = (node: Node) => {
    const targetFolderId = prompt('Enter destination folder id (or leave empty for root)');
    const dest = targetFolderId || null;
    // simple validation – ensure dest exists and is a folder
    if (dest && !nodes.find(n => n.id === dest && n.type === 'folder')) {
      alert('Invalid destination');
      return;
    }
    const updated = { ...node, parentId: dest };
    saveNode(updated);
  };

  const uploadFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = typeof reader.result === 'string' ? reader.result : '';
        const newNode: Node = {
          id: generateId(),
          name: file.name,
          type: 'file',
          parentId: currentFolderId,
          size: file.size,
          mime: file.type,
          content,
        };
        saveNode(newNode);
        sendOSNotification({
          appName: 'Files',
          title: 'File Uploaded',
          message: `Uploaded "${file.name}" to virtual drive`,
        });
      };
      reader.readAsText(file);
    });
    // reset input so same file can be uploaded again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadNode = (node: Node) => {
    if (node.type !== 'file') return;
    const blob = new Blob([node.content ?? ''], { type: node.mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = node.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Breadcrumb generation
  const buildPath = (folderId: string | null): Node[] => {
    const path: Node[] = [];
    let curId = folderId;
    while (curId) {
      const node = nodes.find(n => n.id === curId);
      if (!node) break;
      path.unshift(node);
      curId = node.parentId;
    }
    return path;
  };

  const breadcrumbs = buildPath(currentFolderId);

  // Filtered and sorted children
  const filtered = currentChildren.filter(n => n.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name)); // simple alphabetical sort; can be extended

  // Render helpers for list / grid items
  const renderItem = (node: Node) => (
    <div
      key={node.id}
      className="p-2.5 flex items-center gap-2 cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition min-h-[48px] touch-manipulation border border-transparent hover:border-black/5 dark:hover:border-white/5"
      onClick={() => {
        if (node.type === 'folder') {
          setCurrentFolderId(node.id);
        } else {
          dispatch({ type: 'open', id: 'editor' });
        }
      }}
    >
      {node.type === 'folder' ? (
        <Folder size={20} className="text-[#668b7b] shrink-0" />
      ) : (
        <File size={20} className="text-blue-500 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs truncate font-medium text-gray-800 dark:text-gray-200">
          {node.name}
        </div>
        {node.type === 'file' && node.size !== undefined && (
          <div className="text-[10px] text-gray-400 font-mono">
            {node.size > 1024 ? `${Math.round(node.size / 1024)} KB` : `${node.size} B`}
          </div>
        )}
      </div>

      {/* Action buttons with minimum 36px/44px touch targets */}
      <div className="flex items-center gap-1 shrink-0">
        {node.type === 'file' && (
          <>
            <button
              className="min-h-[36px] min-w-[36px] p-2 text-[#668b7b] hover:bg-[#668b7b]/10 rounded-lg flex items-center justify-center transition touch-manipulation"
              title="Open in Text Editor"
              aria-label={`Open ${node.name} in Editor`}
              onClick={e => {
                e.stopPropagation();
                dispatch({ type: 'open', id: 'editor' });
              }}
            >
              <FileEdit size={15} />
            </button>
            <button
              className="min-h-[36px] min-w-[36px] p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg flex items-center justify-center transition touch-manipulation"
              title="Download file"
              aria-label={`Download ${node.name}`}
              onClick={e => {
                e.stopPropagation();
                downloadNode(node);
              }}
            >
              <Download size={15} />
            </button>
          </>
        )}
        <button
          className="min-h-[36px] min-w-[36px] p-2 hover:bg-black/10 dark:hover:bg-white/15 rounded-lg text-gray-600 dark:text-gray-300 flex items-center justify-center transition touch-manipulation"
          title="Rename"
          aria-label={`Rename ${node.name}`}
          onClick={e => {
            e.stopPropagation();
            renameNode(node);
          }}
        >
          <Edit2 size={14} />
        </button>
        <button
          className="min-h-[36px] min-w-[36px] p-2 hover:bg-black/10 dark:hover:bg-white/15 rounded-lg text-gray-600 dark:text-gray-300 flex items-center justify-center transition touch-manipulation"
          title="Move"
          aria-label={`Move ${node.name}`}
          onClick={e => {
            e.stopPropagation();
            moveNode(node);
          }}
        >
          <ArrowRight size={14} />
        </button>
        <button
          className="min-h-[36px] min-w-[36px] p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded-lg flex items-center justify-center transition touch-manipulation"
          title="Delete"
          aria-label={`Delete ${node.name}`}
          onClick={e => {
            e.stopPropagation();
            if (confirm(`Delete "${node.name}"?`)) removeNode(node.id);
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full p-3 bg-transparent text-gray-800 dark:text-gray-200 overflow-hidden">
      {/* Responsive Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            className="flex items-center px-3 py-1.5 bg-white/80 dark:bg-white/10 rounded-xl shadow-xs hover:bg-white dark:hover:bg-white/20 active:scale-95 transition text-xs font-medium min-h-[38px] border border-black/5 dark:border-white/10 touch-manipulation"
            onClick={createFolder}
          >
            <Folder size={15} className="mr-1.5 text-[#668b7b]" /> Folder
          </button>
          <button
            className="flex items-center px-3 py-1.5 bg-white/80 dark:bg-white/10 rounded-xl shadow-xs hover:bg-white dark:hover:bg-white/20 active:scale-95 transition text-xs font-medium min-h-[38px] border border-black/5 dark:border-white/10 touch-manipulation"
            onClick={createFile}
          >
            <File size={15} className="mr-1.5 text-blue-500" /> File
          </button>
          <button
            className="flex items-center px-3 py-1.5 bg-white/80 dark:bg-white/10 rounded-xl shadow-xs hover:bg-white dark:hover:bg-white/20 active:scale-95 transition text-xs font-medium min-h-[38px] border border-black/5 dark:border-white/10 touch-manipulation"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={15} className="mr-1.5 text-purple-500" /> Upload
          </button>
        </div>

        <input
          type="file"
          multiple
          ref={fileInputRef}
          className="hidden"
          onChange={uploadFiles}
        />

        <div className="flex-1 min-w-[130px] flex items-center relative">
          <Search size={14} className="absolute left-2.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search files…"
            className="w-full pl-8 pr-2.5 py-1.5 bg-white/70 dark:bg-white/10 border border-black/10 dark:border-white/10 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#668b7b] min-h-[38px] touch-manipulation"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('list')}
            className={`min-h-[38px] min-w-[38px] flex items-center justify-center p-2 rounded-xl transition touch-manipulation border border-black/5 dark:border-white/10 ${
              viewMode === 'list'
                ? 'bg-[#668b7b]/25 text-[#668b7b] font-medium'
                : 'bg-white/70 dark:bg-white/10 text-gray-500'
            }`}
            aria-label="List view"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`min-h-[38px] min-w-[38px] flex items-center justify-center p-2 rounded-xl transition touch-manipulation border border-black/5 dark:border-white/10 ${
              viewMode === 'grid'
                ? 'bg-[#668b7b]/25 text-[#668b7b] font-medium'
                : 'bg-white/70 dark:bg-white/10 text-gray-500'
            }`}
            aria-label="Grid view"
          >
            <Grid size={16} />
          </button>
        </div>
      </div>

      {/* Breadcrumbs with safe wrapping */}
      <nav className="flex items-center flex-wrap text-xs mb-2.5 px-1 gap-1 shrink-0 text-gray-500 dark:text-gray-400 font-mono">
        <button
          onClick={() => setCurrentFolderId(null)}
          className="flex items-center hover:text-black dark:hover:text-white transition py-1 min-h-[32px] touch-manipulation"
        >
          <Folder size={13} className="mr-1 text-[#668b7b]" /> root
        </button>
        {breadcrumbs.map(node => (
          <span key={node.id} className="flex items-center gap-1">
            <span>/</span>
            <button
              onClick={() => setCurrentFolderId(node.id)}
              className="hover:text-black dark:hover:text-white transition py-1 min-h-[32px] touch-manipulation underline underline-offset-2"
            >
              {node.name}
            </button>
          </span>
        ))}
      </nav>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-1">
        {sorted.length === 0 ? (
          <div className="text-center py-12 text-xs text-gray-400">
            {searchTerm ? 'No matching files found.' : 'This folder is empty.'}
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-1">{sorted.map(renderItem)}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {sorted.map(node => (
              <div
                key={node.id}
                className="p-3 bg-white/70 dark:bg-white/10 rounded-2xl shadow-xs hover:bg-white dark:hover:bg-white/15 cursor-pointer flex flex-col items-center justify-between text-center transition min-h-[110px] touch-manipulation border border-black/5 dark:border-white/5 group"
                onClick={() => {
                  if (node.type === 'folder') {
                    setCurrentFolderId(node.id);
                  } else {
                    dispatch({ type: 'open', id: 'editor' });
                  }
                }}
              >
                <div className="mt-2">
                  {node.type === 'folder' ? (
                    <Folder size={36} className="text-[#668b7b] mx-auto" />
                  ) : (
                    <File size={36} className="text-blue-500 mx-auto" />
                  )}
                </div>
                <span
                  className="mt-2 text-xs font-medium text-gray-800 dark:text-gray-200 truncate w-full"
                  title={node.name}
                >
                  {node.name}
                </span>

                <div className="flex items-center gap-1 mt-2">
                  {node.type === 'file' && (
                    <>
                      <button
                        className="p-1.5 text-[#668b7b] hover:bg-[#668b7b]/10 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center"
                        onClick={e => {
                          e.stopPropagation();
                          dispatch({ type: 'open', id: 'editor' });
                        }}
                        title="Edit in Editor"
                        aria-label={`Edit ${node.name} in Editor`}
                      >
                        <FileEdit size={14} />
                      </button>
                      <button
                        className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center"
                        onClick={e => {
                          e.stopPropagation();
                          downloadNode(node);
                        }}
                        title="Download"
                        aria-label={`Download ${node.name}`}
                      >
                        <Download size={14} />
                      </button>
                    </>
                  )}
                  <button
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center"
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm(`Delete "${node.name}"?`)) removeNode(node.id);
                    }}
                    title="Delete"
                    aria-label={`Delete ${node.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Note: This component focuses on core CRUD functionality, persistence via IndexedDB,
 * and a responsive UI suitable for both desktop and mobile browsers. Advanced features
 * like drag‑and‑drop move, sorting options, or detailed file type icons can be added later.
 */
