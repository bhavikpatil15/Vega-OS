// src/windows/model.ts
import type { AppId } from '../apps';

export interface Bounds {
  width: number;
  height: number;
}

export interface WindowState {
  id: AppId;
  x: number;
  y: number;
  width?: number;
  height?: number;
  normalX?: number;
  normalY?: number;
  minimized: boolean;
  maximized: boolean;
  openedAt?: number;
}

export interface DesktopState {
  windows: WindowState[];
  activeId: AppId | null;
  bounds: Bounds;
}

export interface WindowPrefs {
  maximized: boolean;
  x?: number;
  y?: number;
}

export type Action =
  | { type: 'open' | 'focus' | 'minimize' | 'maximize' | 'close'; id: AppId }
  | { type: 'move'; id: AppId; x: number; y: number }
  | { type: 'resize'; bounds: Bounds }
  | { type: 'desktop' };

export const PREFS_STORAGE_KEY = 'vega-window-prefs-v1';

/**
 * Retrieve saved window geometry and maximize state for an application.
 */
export function getSavedWindowPrefs(id: AppId): WindowPrefs | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    return all && typeof all === 'object' && all[id] ? all[id] : null;
  } catch {
    return null;
  }
}

/**
 * Persist window preferences per application (maximized state, normal x/y).
 */
export function saveWindowPrefs(id: AppId, prefs: Partial<WindowPrefs>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[id] = { ...(all[id] || {}), ...prefs };
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

/**
 * Clear window preferences.
 */
export function clearAllWindowPrefs(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(PREFS_STORAGE_KEY);
  } catch {}
}

export const initialState: DesktopState = {
  windows: [],
  activeId: null,
  bounds: { width: 1000, height: 600 },
};

export function size(bounds: Bounds) {
  return {
    width: Math.min(640, bounds.width),
    height: Math.min(410, bounds.height),
  };
}

export function windowDimensions(maximized: boolean, bounds: Bounds): Bounds {
  if (maximized) {
    return {
      width: Math.max(0, bounds.width),
      height: Math.max(0, bounds.height),
    };
  }
  return size(bounds);
}

export function clampPosition(x: number, y: number, bounds: Bounds) {
  const dimensions = size(bounds);
  return {
    x: Math.max(0, Math.min(x, bounds.width - dimensions.width)),
    y: Math.max(0, Math.min(y, bounds.height - dimensions.height)),
  };
}

const topId = (windows: WindowState[]) =>
  windows.filter(w => !w.minimized).at(-1)?.id ?? null;

export function windowReducer(state: DesktopState, action: Action): DesktopState {
  if (action.type === 'desktop') {
    return { ...state, activeId: null };
  }

  if (action.type === 'resize') {
    return {
      ...state,
      bounds: action.bounds,
      windows: state.windows.map(w => {
        const clampedNormal = clampPosition(w.normalX ?? w.x, w.normalY ?? w.y, action.bounds);
        const dims = windowDimensions(w.maximized, action.bounds);
        const clampedCurrent = w.maximized
          ? { x: 0, y: 0 }
          : clampPosition(w.x, w.y, action.bounds);
        return {
          ...w,
          x: clampedCurrent.x,
          y: clampedCurrent.y,
          width: dims.width,
          height: dims.height,
          normalX: clampedNormal.x,
          normalY: clampedNormal.y,
        };
      }),
    };
  }

  const existing = state.windows.find(w => w.id === action.id);

  if (action.type === 'open' || action.type === 'focus') {
    if (!existing && action.type === 'focus') return state;

    if (existing) {
      // Re-focus or un-minimize existing window while preserving maximized state
      const dims = windowDimensions(existing.maximized, state.bounds);
      const window: WindowState = {
        ...existing,
        x: existing.maximized ? 0 : existing.x,
        y: existing.maximized ? 0 : existing.y,
        width: dims.width,
        height: dims.height,
        minimized: false,
        openedAt: existing.openedAt ?? Date.now(),
      };
      return {
        ...state,
        windows: [...state.windows.filter(w => w.id !== action.id), window],
        activeId: action.id,
      };
    }

    // Creating window for a closed or newly launched application
    const saved = getSavedWindowPrefs(action.id);
    const initialPos = clampPosition(
      saved?.x ?? (44 + state.windows.length * 36),
      saved?.y ?? (28 + state.windows.length * 32),
      state.bounds
    );
    const isMaximized = saved ? Boolean(saved.maximized) : false;
    const dims = windowDimensions(isMaximized, state.bounds);

    const window: WindowState = {
      id: action.id,
      x: isMaximized ? 0 : initialPos.x,
      y: isMaximized ? 0 : initialPos.y,
      width: dims.width,
      height: dims.height,
      normalX: initialPos.x,
      normalY: initialPos.y,
      minimized: false,
      maximized: isMaximized,
      openedAt: Date.now(),
    };

    return {
      ...state,
      windows: [...state.windows.filter(w => w.id !== action.id), window],
      activeId: action.id,
    };
  }

  if (!existing) return state;

  if (action.type === 'move') {
    if (existing.maximized) return state;
    const clamped = clampPosition(action.x, action.y, state.bounds);
    saveWindowPrefs(action.id, {
      x: clamped.x,
      y: clamped.y,
    });
    return {
      ...state,
      windows: state.windows.map(w =>
        w.id === action.id
          ? { ...w, x: clamped.x, y: clamped.y, normalX: clamped.x, normalY: clamped.y }
          : w
      ),
    };
  }

  if (action.type === 'maximize') {
    const isNowMaximized = !existing.maximized;
    let nextX = existing.x;
    let nextY = existing.y;
    let normalX = existing.normalX ?? existing.x;
    let normalY = existing.normalY ?? existing.y;

    if (isNowMaximized) {
      // Normal -> Maximized: preserve current normal coordinates and anchor at 0, 0
      normalX = existing.x;
      normalY = existing.y;
      nextX = 0;
      nextY = 0;
    } else {
      // Maximized -> Normal: restore previous normal coordinates
      const restored = clampPosition(normalX, normalY, state.bounds);
      nextX = restored.x;
      nextY = restored.y;
    }

    saveWindowPrefs(action.id, {
      maximized: isNowMaximized,
      x: normalX,
      y: normalY,
    });

    const dims = windowDimensions(isNowMaximized, state.bounds);

    const window: WindowState = {
      ...existing,
      x: nextX,
      y: nextY,
      width: dims.width,
      height: dims.height,
      normalX,
      normalY,
      maximized: isNowMaximized,
      minimized: false,
    };

    return {
      ...state,
      windows: [...state.windows.filter(w => w.id !== action.id), window],
      activeId: action.id,
    };
  }

  if (action.type === 'minimize') {
    // Retain existing.maximized so restore returns to maximized state
    const windows = state.windows.map(w =>
      w.id === action.id ? { ...w, minimized: true } : w
    );
    return {
      ...state,
      windows,
      activeId: state.activeId === action.id ? topId(windows) : state.activeId,
    };
  }

  if (action.type === 'close') {
    // Save state before removing from active desktop
    saveWindowPrefs(action.id, {
      maximized: existing.maximized,
      x: existing.normalX ?? (existing.maximized ? 44 : existing.x),
      y: existing.normalY ?? (existing.maximized ? 28 : existing.y),
    });
    const windows = state.windows.filter(w => w.id !== action.id);
    return {
      ...state,
      windows,
      activeId: state.activeId === action.id ? topId(windows) : state.activeId,
    };
  }

  return state;
}
