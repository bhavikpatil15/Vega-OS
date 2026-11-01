import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal } from 'lucide-react';
import { sendOSNotification } from '../notificationSystem';

/**
 * Virtual File System node shape (shared with FileManager).
 */
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

/**
 * IndexedDB helper functions.
 */
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

/**
 * Build the directory path string by traversing parent nodes.
 */
function getPathString(folderId: string | null, nodes: Node[]): string {
  if (!folderId) return '/';
  const segments: string[] = [];
  let curr: string | null = folderId;
  const visited = new Set<string>();

  while (curr && !visited.has(curr)) {
    visited.add(curr);
    const node = nodes.find(n => n.id === curr);
    if (!node) break;
    segments.unshift(node.name);
    curr = node.parentId;
  }

  return '/' + segments.join('/');
}

/**
 * Resolve relative or absolute path in the virtual file system.
 */
function resolvePath(
  pathInput: string,
  currentFolderId: string | null,
  nodes: Node[]
): { node: Node | null; isRoot: boolean; error?: string } {
  const trimmed = pathInput.trim();
  if (!trimmed || trimmed === '/' || trimmed === '~') {
    return { node: null, isRoot: true };
  }

  let currId: string | null = trimmed.startsWith('/') ? null : currentFolderId;
  let normalized = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  if (normalized.startsWith('~/')) normalized = normalized.slice(2);

  const rawParts = normalized.split('/').filter(p => p.length > 0 && p !== '.');

  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i];
    if (part === '..') {
      if (currId !== null) {
        const currNode = nodes.find(n => n.id === currId);
        currId = currNode ? currNode.parentId : null;
      }
    } else {
      const match = nodes.find(n => n.parentId === currId && n.name === part);
      if (!match) {
        return { node: null, isRoot: false, error: `No such file or directory: ${trimmed}` };
      }
      const isLast = i === rawParts.length - 1;
      if (!isLast && match.type !== 'folder') {
        return { node: null, isRoot: false, error: `Not a directory: ${part}` };
      }
      if (isLast) {
        return { node: match, isRoot: false };
      }
      currId = match.id;
    }
  }

  if (currId === null) {
    return { node: null, isRoot: true };
  }
  const finalNode = nodes.find(n => n.id === currId) || null;
  return { node: finalNode, isRoot: false };
}

/**
 * Terminal line record.
 */
interface TerminalLine {
  id: string;
  type: 'banner' | 'command' | 'output' | 'error';
  prompt?: string;
  command?: string;
  output?: string;
  node?: React.ReactNode;
}

export default function TerminalApp() {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const tempInputRef = useRef<string>('');

  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'welcome-line',
      type: 'banner',
      output: [
        'VEGA OS [Version 2.0.0]',
        '(c) 2026 VEGA Systems. All rights reserved.',
        '',
        "Type 'help' for available commands.",
      ].join('\n'),
    },
  ]);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Initialize IndexedDB
  useEffect(() => {
    let active = true;
    openDb()
      .then(database => {
        if (!active) return;
        setDb(database);
        return getAllNodes(database);
      })
      .then(loaded => {
        if (!active || !loaded) return;
        setNodes(loaded);
      })
      .catch(err => {
        console.error('Failed to initialize database in TerminalApp:', err);
      });

    return () => {
      active = false;
    };
  }, []);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-scroll input into view
  const scrollToInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  useEffect(() => {
    scrollToInput();
  }, [lines, scrollToInput]);

  // Keep input visible on mobile virtual keyboard resize
  useEffect(() => {
    const vp = window.visualViewport;
    if (!vp) return;
    const handleViewportResize = () => {
      scrollToInput();
    };
    vp.addEventListener('resize', handleViewportResize);
    return () => {
      vp.removeEventListener('resize', handleViewportResize);
    };
  }, [scrollToInput]);

  // Focus input when user clicks anywhere in terminal unless selecting text
  const handleTerminalClick = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) return;
    inputRef.current?.focus();
  };

  // Helper to get latest nodes from DB
  const getFreshNodes = async (): Promise<{ activeDb: IDBDatabase; currentNodes: Node[] }> => {
    const activeDb = db || (await openDb());
    if (!db) setDb(activeDb);
    const currentNodes = await getAllNodes(activeDb);
    setNodes(currentNodes);
    return { activeDb, currentNodes };
  };

  // Command History Navigation: ArrowUp / ArrowDown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;

      if (historyIndex === -1) {
        tempInputRef.current = input;
        const nextIdx = history.length - 1;
        setHistoryIndex(nextIdx);
        setInput(history[nextIdx]);
      } else if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInput(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;

      if (historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInput(history[nextIdx]);
      } else {
        setHistoryIndex(-1);
        setInput(tempInputRef.current);
      }
    }
  };

  // Command Execution Handler
  const handleCommand = async (rawInput: string) => {
    const trimmed = rawInput.trim();
    const currentPath = getPathString(currentFolderId, nodes);
    const promptString = `vega@os:${currentPath}$`;

    // Empty submission
    if (!trimmed) {
      setLines(prev => [
        ...prev,
        {
          id: generateId(),
          type: 'command',
          prompt: promptString,
          command: '',
        },
      ]);
      return;
    }

    // Split command and arguments
    const firstSpace = trimmed.search(/\s/);
    const cmd = (firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)).toLowerCase();
    const rawArgs = firstSpace === -1 ? '' : trimmed.slice(firstSpace).trim();

    // Parse arguments respecting single/double quotes
    const args: string[] = [];
    let currentArg = '';
    let inQuote: '' | "'" | '"' = '';
    for (let i = 0; i < rawArgs.length; i++) {
      const char = rawArgs[i];
      if (inQuote) {
        if (char === inQuote) {
          inQuote = '';
        } else {
          currentArg += char;
        }
      } else {
        if (char === "'" || char === '"') {
          inQuote = char;
        } else if (/\s/.test(char)) {
          if (currentArg.length > 0) {
            args.push(currentArg);
            currentArg = '';
          }
        } else {
          currentArg += char;
        }
      }
    }
    if (currentArg.length > 0) {
      args.push(currentArg);
    }

    let outputText = '';
    let outputNode: React.ReactNode | null = null;
    let isError = false;

    switch (cmd) {
      case 'help': {
        outputText = [
          'Available commands:',
          '  help        - list all available commands with short descriptions',
          '  clear       - clear the terminal output',
          '  date        - show current date',
          '  time        - show current time',
          '  about       - show info about VEGA OS',
          '  ls [path]   - list files/folders in current or specified directory',
          '  pwd         - print current working directory path',
          '  cd <path>   - change directory (cd .., cd /, cd foldername)',
          '  mkdir <name>- create a folder in current directory',
          '  touch <name>- create an empty file in current directory',
          '  cat <file>  - display file contents',
          '  rm <name>   - delete a file or folder (with recursive deletion)',
          '  echo <text> - print text to terminal (supports > and >> redirection)',
          '  whoami      - display current user',
          '  hostname    - display system hostname',
          '  neofetch    - display stylized system info and ASCII art',
          '  notify <title> [msg] - trigger a simulated desktop notification',
        ].join('\n');
        break;
      }

      case 'notify': {
        if (!args.length) {
          isError = true;
          outputText = 'Usage: notify <title> [message]';
        } else {
          const title = args[0];
          const message = args.slice(1).join(' ') || 'Notification from simulated terminal.';
          sendOSNotification({
            appName: 'Terminal',
            title,
            message,
          });
          outputText = `Notification dispatched: "${title}"`;
        }
        break;
      }

      case 'clear': {
        setLines([]);
        return;
      }

      case 'date': {
        outputText = new Date().toDateString();
        break;
      }

      case 'time': {
        outputText = new Date().toLocaleTimeString();
        break;
      }

      case 'about': {
        outputText = [
          'VEGA OS — Web Desktop Operating System',
          'Version 2.0.0 (Phase 2)',
          'An elegant browser-based desktop simulation environment.',
          'Built with React 19, TypeScript, Tailwind CSS, and IndexedDB VFS.',
        ].join('\n');
        break;
      }

      case 'whoami': {
        outputText = 'vega-user';
        break;
      }

      case 'hostname': {
        outputText = 'vega-os';
        break;
      }

      case 'pwd': {
        const { currentNodes } = await getFreshNodes();
        outputText = getPathString(currentFolderId, currentNodes);
        break;
      }

      case 'cd': {
        const { currentNodes } = await getFreshNodes();
        const targetPath = args[0] || '';

        if (!targetPath || targetPath === '/' || targetPath === '~') {
          setCurrentFolderId(null);
        } else if (targetPath === '..') {
          if (currentFolderId !== null) {
            const currNode = currentNodes.find(n => n.id === currentFolderId);
            setCurrentFolderId(currNode ? currNode.parentId : null);
          }
        } else {
          const res = resolvePath(targetPath, currentFolderId, currentNodes);
          if (res.error) {
            isError = true;
            outputText = `cd: ${res.error}`;
          } else if (res.isRoot) {
            setCurrentFolderId(null);
          } else if (res.node && res.node.type === 'file') {
            isError = true;
            outputText = `cd: not a directory: ${targetPath}`;
          } else if (res.node) {
            setCurrentFolderId(res.node.id);
          } else {
            isError = true;
            outputText = `cd: no such file or directory: ${targetPath}`;
          }
        }
        break;
      }

      case 'ls': {
        const { currentNodes } = await getFreshNodes();
        const targetPath = args[0];
        let targetFolderId: string | null = currentFolderId;

        if (targetPath) {
          const res = resolvePath(targetPath, currentFolderId, currentNodes);
          if (res.error) {
            isError = true;
            outputText = `ls: cannot access '${targetPath}': No such file or directory`;
            break;
          }
          if (res.node && res.node.type === 'file') {
            outputText = `📄 ${res.node.name}`;
            break;
          }
          targetFolderId = res.isRoot ? null : res.node?.id ?? null;
        }

        const children = currentNodes.filter(n => n.parentId === targetFolderId);
        if (children.length === 0) {
          outputText = '';
        } else {
          const sorted = [...children].sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
          outputText = sorted
            .map(c => `${c.type === 'folder' ? '📁' : '📄'} ${c.name}`)
            .join('\n');
        }
        break;
      }

      case 'mkdir': {
        const name = args[0];
        if (!name) {
          isError = true;
          outputText = 'mkdir: missing operand';
          break;
        }

        const { activeDb, currentNodes } = await getFreshNodes();
        const exists = currentNodes.some(
          n => n.parentId === currentFolderId && n.name === name
        );

        if (exists) {
          isError = true;
          outputText = `mkdir: cannot create directory '${name}': File exists`;
        } else {
          const newFolder: Node = {
            id: generateId(),
            name,
            type: 'folder',
            parentId: currentFolderId,
          };
          await putNode(activeDb, newFolder);
          setNodes(prev => [...prev, newFolder]);
        }
        break;
      }

      case 'touch': {
        const name = args[0];
        if (!name) {
          isError = true;
          outputText = 'touch: missing operand';
          break;
        }

        const { activeDb, currentNodes } = await getFreshNodes();
        const exists = currentNodes.find(
          n => n.parentId === currentFolderId && n.name === name
        );

        if (!exists) {
          const newFile: Node = {
            id: generateId(),
            name,
            type: 'file',
            parentId: currentFolderId,
            size: 0,
            mime: 'text/plain',
            content: '',
          };
          await putNode(activeDb, newFile);
          setNodes(prev => [...prev, newFile]);
        }
        break;
      }

      case 'cat': {
        const filename = args[0];
        if (!filename) {
          isError = true;
          outputText = 'cat: missing operand';
          break;
        }

        const { currentNodes } = await getFreshNodes();
        const res = resolvePath(filename, currentFolderId, currentNodes);

        if (res.error || !res.node) {
          isError = true;
          outputText = `cat: ${filename}: No such file or directory`;
        } else if (res.node.type === 'folder') {
          isError = true;
          outputText = `cat: ${filename}: Is a directory`;
        } else {
          outputText = res.node.content ?? '';
        }
        break;
      }

      case 'rm': {
        // Filter out flags like -r or -rf if passed
        const targetName = args.filter(a => !a.startsWith('-'))[0];
        if (!targetName) {
          isError = true;
          outputText = 'rm: missing operand';
          break;
        }

        const { activeDb, currentNodes } = await getFreshNodes();
        const res = resolvePath(targetName, currentFolderId, currentNodes);

        if (res.error || !res.node) {
          isError = true;
          outputText = `rm: cannot remove '${targetName}': No such file or directory`;
        } else if (res.isRoot) {
          isError = true;
          outputText = `rm: cannot remove '/': Is root directory`;
        } else {
          const target = res.node;
          const toDelete: string[] = [target.id];

          if (target.type === 'folder') {
            const collectChildren = (parentId: string) => {
              currentNodes
                .filter(n => n.parentId === parentId)
                .forEach(child => {
                  toDelete.push(child.id);
                  if (child.type === 'folder') collectChildren(child.id);
                });
            };
            collectChildren(target.id);
          }

          await Promise.all(toDelete.map(id => deleteNode(activeDb, id)));
          setNodes(prev => prev.filter(n => !toDelete.includes(n.id)));
        }
        break;
      }

      case 'echo': {
        const { activeDb, currentNodes } = await getFreshNodes();

        // Check for file redirection (> or >>)
        const appendIdx = rawArgs.indexOf('>>');
        const overwriteIdx = rawArgs.indexOf('>');
        let isAppend = false;
        let splitIdx = -1;

        if (appendIdx !== -1) {
          isAppend = true;
          splitIdx = appendIdx;
        } else if (overwriteIdx !== -1) {
          isAppend = false;
          splitIdx = overwriteIdx;
        }

        if (splitIdx !== -1) {
          let content = rawArgs.slice(0, splitIdx).trim();
          const targetFilename = rawArgs.slice(splitIdx + (isAppend ? 2 : 1)).trim();

          if (!targetFilename) {
            isError = true;
            outputText = 'echo: syntax error near unexpected token `newline`';
            break;
          }

          if (
            (content.startsWith('"') && content.endsWith('"')) ||
            (content.startsWith("'") && content.endsWith("'"))
          ) {
            content = content.slice(1, -1);
          }

          const existing = currentNodes.find(
            n => n.parentId === currentFolderId && n.name === targetFilename
          );

          if (existing) {
            if (existing.type === 'folder') {
              isError = true;
              outputText = `echo: ${targetFilename}: Is a directory`;
            } else {
              const newContent = isAppend
                ? `${existing.content || ''}${existing.content ? '\n' : ''}${content}`
                : content;
              const updated: Node = {
                ...existing,
                content: newContent,
                size: new Blob([newContent]).size,
              };
              await putNode(activeDb, updated);
              setNodes(prev => prev.map(n => (n.id === updated.id ? updated : n)));
            }
          } else {
            const newFile: Node = {
              id: generateId(),
              name: targetFilename,
              type: 'file',
              parentId: currentFolderId,
              content,
              size: new Blob([content]).size,
              mime: 'text/plain',
            };
            await putNode(activeDb, newFile);
            setNodes(prev => [...prev, newFile]);
          }
          break;
        }

        // Direct echo output
        let content = rawArgs;
        if (
          (content.startsWith('"') && content.endsWith('"')) ||
          (content.startsWith("'") && content.endsWith("'"))
        ) {
          content = content.slice(1, -1);
        }
        outputText = content;
        break;
      }

      case 'neofetch': {
        outputNode = (
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 my-2 font-mono text-xs sm:text-sm">
            <pre className="text-[#7ec699] font-bold leading-tight select-none">
{` __     _______ ____    _        ___  ____  
 \\ \\   / / ____/ ___|  / \\      / _ \\/ ___| 
  \\ \\ / /|  _|| |  _  / _ \\    | | | \\___ \\ 
   \\ V / | |__| |_| |/ ___ \\   | |_| |___) |
    \\_/  |_____\\____/_/   \\_\\___\\___/|____/ `}
            </pre>
            <div className="flex flex-col gap-0.5 leading-snug">
              <div>
                <span className="font-bold text-[#7ec699]">vega-user</span>
                <span className="text-[#c8d6c8]">@</span>
                <span className="font-bold text-[#7ec699]">vega-os</span>
              </div>
              <div className="text-[#4e5850]">-----------------------------</div>
              <div>
                <span className="text-[#7ec699] font-medium">OS:</span> VEGA OS Phase 2 (x86_64)
              </div>
              <div>
                <span className="text-[#7ec699] font-medium">Host:</span> Web Desktop Simulation
              </div>
              <div>
                <span className="text-[#7ec699] font-medium">Kernel:</span> 2.0.0-vega-web
              </div>
              <div>
                <span className="text-[#7ec699] font-medium">Uptime:</span> 1 hour, 15 mins
              </div>
              <div>
                <span className="text-[#7ec699] font-medium">Shell:</span> vega-sh 1.0.0
              </div>
              <div>
                <span className="text-[#7ec699] font-medium">Terminal:</span> vega-term
              </div>
              <div>
                <span className="text-[#7ec699] font-medium">Storage:</span> IndexedDB (nexus-fs)
              </div>
              <div>
                <span className="text-[#7ec699] font-medium">Memory:</span> 384 MB / 4096 MB
              </div>
              <div className="flex gap-2 pt-2 text-sm select-none">
                <span className="text-red-400">●</span>
                <span className="text-green-400">●</span>
                <span className="text-yellow-400">●</span>
                <span className="text-blue-400">●</span>
                <span className="text-purple-400">●</span>
                <span className="text-cyan-400">●</span>
                <span className="text-neutral-300">●</span>
              </div>
            </div>
          </div>
        );
        break;
      }

      default: {
        isError = true;
        outputText = `nexus: command not found: ${cmd}. Type 'help' for available commands.`;
        break;
      }
    }

    // Append to lines
    setLines(prev => [
      ...prev,
      {
        id: generateId(),
        type: 'command',
        prompt: promptString,
        command: rawInput,
      },
      ...(outputNode
        ? [{ id: generateId(), type: 'output' as const, node: outputNode }]
        : outputText !== ''
        ? [{
            id: generateId(),
            type: isError ? ('error' as const) : ('output' as const),
            output: outputText,
          }]
        : []),
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = input;
    const trimmed = raw.trim();

    if (trimmed) {
      setHistory(prev => [...prev, trimmed]);
    }
    setHistoryIndex(-1);
    tempInputRef.current = '';
    setInput('');

    await handleCommand(raw);

    setTimeout(() => {
      scrollToInput();
      inputRef.current?.focus();
    }, 20);
  };

  const currentPathDisplay = getPathString(currentFolderId, nodes);

  return (
    <div
      className="h-full w-full flex flex-col overflow-hidden select-text"
      style={{
        backgroundColor: '#1a1f1c',
        color: '#c8d6c8',
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      }}
      onClick={handleTerminalClick}
    >
      {/* Scrollable Output Area */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4 text-xs sm:text-sm leading-relaxed"
      >
        {lines.map(line => {
          if (line.type === 'command') {
            return (
              <div key={line.id} className="flex items-baseline gap-2 flex-wrap mt-2">
                <span
                  className="font-semibold select-none flex-shrink-0"
                  style={{ color: '#7ec699' }}
                >
                  {line.prompt}
                </span>
                <span className="font-mono text-[#c8d6c8]">{line.command}</span>
              </div>
            );
          }

          if (line.node) {
            return <div key={line.id}>{line.node}</div>;
          }

          return (
            <div
              key={line.id}
              className={`whitespace-pre-wrap font-mono ${
                line.type === 'error' ? 'text-red-400' : 'text-[#c8d6c8]'
              } ${line.type === 'banner' ? 'text-[#a4b5a4]' : ''}`}
            >
              {line.output}
            </div>
          );
        })}

        {/* Active Input Line */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center min-h-[44px] gap-2 pt-1 pb-1"
        >
          <span
            className="font-semibold select-none flex-shrink-0 text-xs sm:text-sm"
            style={{ color: '#7ec699' }}
          >
            vega@os:{currentPathDisplay}$
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 bg-transparent border-none outline-none p-0 text-xs sm:text-sm font-mono min-w-0"
            style={{
              color: '#c8d6c8',
              caretColor: '#7ec699',
            }}
          />
        </form>

        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
}
