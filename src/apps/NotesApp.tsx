import { useState, useEffect } from 'react';
import { Plus, Trash2, Search, FileText, ArrowLeft } from 'lucide-react';
import { sendOSNotification } from '../notificationSystem';

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

const DB_NAME = 'nexus-notes-db';
const STORE_NAME = 'notes';
const DB_VERSION = 1;

function openNotesDb(): Promise<IDBDatabase> {
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

function getAllNotes(db: IDBDatabase): Promise<Note[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as Note[]);
    req.onerror = () => reject(req.error);
  });
}

function saveNoteToDb(db: IDBDatabase, note: Note): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(note);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function deleteNoteFromDb(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export default function NotesApp() {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<string>('Saved');
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  // Load notes on mount
  useEffect(() => {
    openNotesDb()
      .then(database => {
        setDb(database);
        return getAllNotes(database);
      })
      .then(loaded => {
        if (loaded && loaded.length > 0) {
          const sorted = loaded.sort((a, b) => b.updatedAt - a.updatedAt);
          setNotes(sorted);
          setActiveNoteId(sorted[0].id);
          setTitle(sorted[0].title);
          setContent(sorted[0].content);
        } else {
          // Default initial note
          const defaultNote: Note = {
            id: 'note-welcome',
            title: 'Welcome Note',
            content: 'Welcome to Notes in VEGA OS!\n\n- Create, rename, edit, and delete notes\n- Everything autosaves\n- Stored locally via IndexedDB',
            updatedAt: Date.now(),
          };
          setNotes([defaultNote]);
          setActiveNoteId(defaultNote.id);
          setTitle(defaultNote.title);
          setContent(defaultNote.content);
        }
      })
      .catch(console.error);
  }, []);

  // Update editor when active note switches
  const selectNote = (note: Note) => {
    setActiveNoteId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setMobileView('editor');
  };

  // Autosave when title or content changes
  useEffect(() => {
    if (!activeNoteId || !db) return;

    setSaveStatus('Saving...');
    const timer = setTimeout(() => {
      const updatedNote: Note = {
        id: activeNoteId,
        title: title.trim() || 'Untitled Note',
        content,
        updatedAt: Date.now(),
      };

      saveNoteToDb(db, updatedNote)
        .then(() => {
          setNotes(prev => {
            const index = prev.findIndex(n => n.id === activeNoteId);
            if (index >= 0) {
              const next = [...prev];
              next[index] = updatedNote;
              return next.sort((a, b) => b.updatedAt - a.updatedAt);
            }
            return [updatedNote, ...prev];
          });
          setSaveStatus('Saved');
        })
        .catch(() => setSaveStatus('Error'));
    }, 400);

    return () => clearTimeout(timer);
  }, [title, content, activeNoteId, db]);

  const createNote = () => {
    if (!db) return;
    const newNote: Note = {
      id: 'note-' + Date.now(),
      title: 'New Note',
      content: '',
      updatedAt: Date.now(),
    };
    saveNoteToDb(db, newNote).then(() => {
      setNotes(prev => [newNote, ...prev]);
      setActiveNoteId(newNote.id);
      setTitle(newNote.title);
      setContent('');
      setMobileView('editor');
      sendOSNotification({
        appName: 'Notes',
        title: 'Note Created',
        message: 'New note created in workspace',
      });
    });
  };

  const deleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!db) return;
    const target = notes.find(n => n.id === id);
    deleteNoteFromDb(db, id).then(() => {
      const remaining = notes.filter(n => n.id !== id);
      setNotes(remaining);
      if (activeNoteId === id) {
        if (remaining.length > 0) {
          selectNote(remaining[0]);
        } else {
          setActiveNoteId(null);
          setTitle('');
          setContent('');
        }
      }
      sendOSNotification({
        appName: 'Notes',
        title: 'Note Deleted',
        message: target ? `Deleted "${target.title}"` : 'Note removed from workspace',
      });
    });
  };

  const filtered = notes.filter(
    n => n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col md:flex-row bg-transparent overflow-hidden">
      {/* Sidebar / Note list */}
      <div
        className={`${
          mobileView === 'editor' ? 'hidden md:flex' : 'flex'
        } w-full md:w-64 border-b md:border-b-0 md:border-r border-black/10 dark:border-white/10 flex-col bg-black/[0.02] dark:bg-white/[0.02] h-full overflow-hidden`}
      >
        <div className="p-3 border-b border-black/10 dark:border-white/10 flex gap-2 shrink-0">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-2.5 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-2 py-2 text-xs bg-white/70 dark:bg-white/10 rounded-lg border border-black/10 dark:border-white/10 outline-none min-h-[38px] touch-manipulation"
            />
          </div>
          <button
            onClick={createNote}
            className="p-2 bg-[#8e7bb0] hover:bg-[#7e69a2] active:scale-95 text-white rounded-lg flex items-center justify-center transition shadow-sm min-h-[38px] min-w-[38px] touch-manipulation"
            title="Create note"
            aria-label="Create note"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400">No notes found</div>
          ) : (
            filtered.map(note => (
              <div
                key={note.id}
                onClick={() => selectNote(note)}
                className={`p-3 rounded-xl cursor-pointer flex items-center justify-between gap-2 transition min-h-[48px] touch-manipulation ${
                  activeNoteId === note.id
                    ? 'bg-[#8e7bb0]/20 text-[#694e96] dark:text-[#c4b5e2] font-medium'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <FileText size={16} className="mt-0.5 shrink-0 opacity-70" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs truncate font-medium">{note.title || 'Untitled'}</div>
                    <div className="text-[10px] text-gray-400 truncate opacity-80 mt-0.5">
                      {note.content.slice(0, 35) || 'No text'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={e => deleteNote(note.id, e)}
                  className="opacity-40 hover:opacity-100 hover:text-red-500 p-2 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center touch-manipulation"
                  title="Delete note"
                  aria-label={`Delete ${note.title}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div
        className={`${
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        } flex-1 flex-col p-4 h-full overflow-hidden`}
      >
        {activeNoteId ? (
          <>
            <div className="flex items-center justify-between mb-3 border-b border-black/5 dark:border-white/5 pb-2 shrink-0 gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  onClick={() => setMobileView('list')}
                  className="md:hidden flex items-center gap-1 text-xs text-[#8e7bb0] dark:text-[#c4b5e2] font-medium px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 min-h-[36px] touch-manipulation shrink-0"
                  aria-label="Back to notes list"
                >
                  <ArrowLeft size={16} />
                  <span>Notes</span>
                </button>
                <input
                  type="text"
                  placeholder="Note title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="text-base font-semibold bg-transparent border-0 outline-none w-full text-gray-800 dark:text-gray-200 min-h-[36px]"
                />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 shrink-0 ml-2 font-mono">
                {saveStatus}
              </span>
            </div>
            <textarea
              placeholder="Start typing your note here..."
              value={content}
              onChange={e => setContent(e.target.value)}
              className="flex-1 bg-transparent border-0 outline-none resize-none text-xs leading-relaxed text-gray-700 dark:text-gray-300 font-sans"
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs">
            <FileText size={32} className="mb-2 opacity-30" />
            Select a note or create a new one.
          </div>
        )}
      </div>
    </div>
  );
}
