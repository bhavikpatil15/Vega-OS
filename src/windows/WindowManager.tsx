import { createContext, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { apps } from '../apps';
import { initialState, windowReducer, type Action, type DesktopState } from './model';
import { ApplicationWindow } from './ApplicationWindow';
const WindowContext = createContext<{ state: DesktopState; dispatch: Dispatch<Action>; mobile: boolean } | null>(null);
export function WindowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(windowReducer, initialState);
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 700px)').matches);
  useEffect(() => {
    const media = matchMedia('(max-width: 700px)');
    const change = () => setMobile(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  return <WindowContext.Provider value={{ state, dispatch, mobile }}>{children}</WindowContext.Provider>;
}
export function useWindows() {
  const context = useContext(WindowContext);
  if (!context) throw new Error('useWindows must be used inside WindowProvider');
  return context;
}
export function WindowLayer({ blocked }: { blocked: boolean }) {
  const { state, dispatch, mobile } = useWindows();
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!layer.current || mobile) return;
    const observer = new ResizeObserver(([entry]) => dispatch({ type: 'resize', bounds: { width: entry.contentRect.width, height: entry.contentRect.height } }));
    observer.observe(layer.current);
    return () => observer.disconnect();
  }, [dispatch, mobile]);
  return <div className="window-layer" ref={layer} inert={blocked}>
    {apps.map(app => {
      const order = state.windows.findIndex(w => w.id === app.id);
      const window = state.windows[order];
      return window ? <ApplicationWindow key={app.id} window={window} app={app} order={order} /> : null;
    })}
  </div>;
}
