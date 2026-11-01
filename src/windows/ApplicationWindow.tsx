import { useRef, useState, useEffect, type PointerEvent } from 'react';
import { ArrowLeft, Maximize2, Minimize2, Minus, X } from 'lucide-react';
import type { AppDefinition } from '../apps';
import { windowDimensions, type WindowState } from './model';
import { useWindows } from './WindowManager';
import FileManager from '../apps/FileManager';
import CalculatorApp from '../apps/CalculatorApp';
import NotesApp from '../apps/NotesApp';
import TerminalApp from '../apps/TerminalApp';
import TextEditorApp from '../apps/TextEditorApp';
import SettingsApp from '../apps/SettingsApp';
import AboutApp from '../apps/AboutApp';
import ProjectsApp from '../apps/ProjectsApp';
import ContactApp from '../apps/ContactApp';
import TaskManagerApp from '../apps/TaskManagerApp';
import BrowserApp from '../apps/BrowserApp';

export function ApplicationWindow({ window: win, app, order }: { window: WindowState; app: AppDefinition; order: number }) {
  const { state, dispatch, mobile } = useWindows();
  const active = state.activeId === win.id;
  const hidden = win.minimized || (mobile && !active);
  const frame = useRef<HTMLElement>(null);
  const drag = useRef<{ pointer: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => { if (active && !hidden && !frame.current?.contains(document.activeElement)) frame.current?.focus({ preventScroll: true }); }, [active, hidden]);
  useEffect(() => { drag.current = null; setDragging(false); }, [mobile, win.maximized, hidden]);
  function startDrag(event: PointerEvent<HTMLElement>) {
    if (mobile || win.maximized || event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, x: win.x, y: win.y, startX: event.clientX, startY: event.clientY };
    setDragging(true);
  }
  function move(event: PointerEvent<HTMLElement>) {
    if (!drag.current || drag.current.pointer !== event.pointerId) return;
    dispatch({ type: 'move', id: win.id, x: drag.current.x + event.clientX - drag.current.startX, y: drag.current.y + event.clientY - drag.current.startY });
  }
  function endDrag() { drag.current = null; setDragging(false); }
  function leave(close: boolean) {
    dispatch(close ? { type: 'close', id: win.id } : mobile ? { type: 'desktop' } : { type: 'minimize', id: win.id });
    document.querySelector<HTMLButtonElement>(`[data-dock-app="${win.id}"]`)?.focus();
  }
  const dimensions = windowDimensions(win.maximized, state.bounds);
  return <section ref={frame} tabIndex={-1} role="dialog" aria-label={`${app.name} window`} hidden={hidden}
    className={`application-window ${active ? 'is-active' : ''} ${win.maximized ? 'is-maximized' : ''} ${dragging ? 'is-dragging' : ''}`}
    style={{
      zIndex: order + 1,
      left: win.maximized ? 0 : win.x,
      top: win.maximized ? 0 : win.y,
      width: win.maximized ? (state.bounds.width ? `${state.bounds.width}px` : '100%') : `${dimensions.width}px`,
      height: win.maximized ? (state.bounds.height ? `${state.bounds.height}px` : '100%') : `${dimensions.height}px`,
    }}
    onPointerDownCapture={() => { if (!active) dispatch({ type: 'focus', id: win.id }); }}
    onFocusCapture={() => { if (!active) dispatch({ type: 'focus', id: win.id }); }}>
    <header className="window-titlebar" onPointerDown={startDrag} onPointerMove={move} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
      onDoubleClick={e => { if (!mobile && !(e.target as HTMLElement).closest('button')) dispatch({ type: 'maximize', id: win.id }); }}>
      {mobile && <button className="window-back" aria-label={`Back to desktop from ${app.name}`} onClick={() => leave(false)}><ArrowLeft size={18}/><span>Desktop</span></button>}
      <div className="window-title"><app.icon size={16}/><span>{app.name}</span></div>
      <div className="window-controls">
        {!mobile && <><button aria-label={`Minimize ${app.name}`} onClick={() => leave(false)}><Minus size={16}/></button><button aria-label={`${win.maximized ? 'Restore' : 'Maximize'} ${app.name}`} onClick={() => dispatch({ type: 'maximize', id: win.id })}>{win.maximized ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}</button></>}
        <button className="window-close" aria-label={`Close ${app.name}`} onClick={() => leave(true)}><X size={18}/></button>
      </div>
    </header>
<div className="window-content">
  {app.id === 'files' ? (
    <FileManager />
  ) : app.id === 'calculator' ? (
    <CalculatorApp />
  ) : app.id === 'notes' ? (
    <NotesApp />
  ) : app.id === 'terminal' ? (
    <TerminalApp />
  ) : app.id === 'editor' ? (
    <TextEditorApp />
  ) : app.id === 'settings' ? (
    <SettingsApp />
  ) : app.id === 'about' ? (
    <AboutApp />
  ) : app.id === 'projects' ? (
    <ProjectsApp />
  ) : app.id === 'contact' ? (
    <ContactApp />
  ) : app.id === 'tasks' ? (
    <TaskManagerApp />
  ) : app.id === 'browser' ? (
    <BrowserApp />
  ) : (
    <div className="window-placeholder">
      <span className={`app-icon ${(app as AppDefinition).color}`}>
        {/* @ts-ignore */}
        <app.icon size={29} />
      </span>
      <span className="eyebrow">A SPACE IN THE MAKING</span>
      <h1>{(app as AppDefinition).name}</h1>
      <p>{(app as AppDefinition).detail}.</p>
      <div className="placeholder-note">
        This application is coming in a later phase.
      </div>
    </div>
  )}
</div>
    <footer className="window-footer"><span className="status-dot"/> VEGA OS <span className="window-footer-right">{mobile ? 'Your space, wherever you are.' : 'A space of your own.'}</span></footer>
  </section>;
}
