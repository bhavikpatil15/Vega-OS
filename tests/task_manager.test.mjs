import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apps } from '../src/apps.ts';
import { initialState, windowReducer as reduce } from '../src/windows/model.ts';

test('task manager: registered properly in system apps registry', () => {
  const taskApp = apps.find(a => a.id === 'tasks');
  assert.ok(taskApp, 'Task Manager app must be registered');
  assert.equal(taskApp.name, 'Task Manager');
  assert.ok(taskApp.detail && taskApp.detail.length > 0);
  assert.equal(taskApp.color, 'green');
  assert.ok(taskApp.icon, 'Task Manager must have an icon');
});

test('task manager: tracks open windows and assigns openedAt timestamps', () => {
  let state = initialState;
  const beforeTime = Date.now();

  state = reduce(state, { type: 'open', id: 'notes' });
  state = reduce(state, { type: 'open', id: 'terminal' });
  state = reduce(state, { type: 'open', id: 'tasks' });

  assert.equal(state.windows.length, 3);
  assert.equal(state.activeId, 'tasks');

  const notesWin = state.windows.find(w => w.id === 'notes');
  assert.ok(notesWin.openedAt, 'Window must record openedAt timestamp');
  assert.ok(notesWin.openedAt >= beforeTime);
  assert.ok(notesWin.openedAt <= Date.now());
});

test('task manager: application controls (switch, minimize, restore, maximize, close)', () => {
  let state = initialState;
  state = reduce(state, { type: 'open', id: 'notes' });
  state = reduce(state, { type: 'open', id: 'tasks' });

  // 1. Switch to Notes (bring to foreground)
  state = reduce(state, { type: 'focus', id: 'notes' });
  assert.equal(state.activeId, 'notes');

  // 2. Minimize Notes
  state = reduce(state, { type: 'minimize', id: 'notes' });
  const notesWin = state.windows.find(w => w.id === 'notes');
  assert.equal(notesWin.minimized, true);
  assert.equal(state.activeId, 'tasks', 'Focus returns to top visible window');

  // 3. Restore Notes
  state = reduce(state, { type: 'open', id: 'notes' });
  const restoredNotes = state.windows.find(w => w.id === 'notes');
  assert.equal(restoredNotes.minimized, false);
  assert.equal(state.activeId, 'notes');

  // 4. Maximize Notes
  state = reduce(state, { type: 'maximize', id: 'notes' });
  const maxNotes = state.windows.find(w => w.id === 'notes');
  assert.equal(maxNotes.maximized, true);

  // 5. Close Notes (End Task)
  state = reduce(state, { type: 'close', id: 'notes' });
  assert.equal(state.windows.some(w => w.id === 'notes'), false);
  assert.equal(state.activeId, 'tasks');
});

test('task manager: filtering logic (all, active, minimized)', () => {
  let state = initialState;
  state = reduce(state, { type: 'open', id: 'notes' });
  state = reduce(state, { type: 'open', id: 'terminal' });
  state = reduce(state, { type: 'open', id: 'calculator' });
  state = reduce(state, { type: 'minimize', id: 'terminal' });

  const filterWindows = (windows, filterType) => {
    if (filterType === 'active') return windows.filter(w => !w.minimized);
    if (filterType === 'minimized') return windows.filter(w => w.minimized);
    return windows;
  };

  const all = filterWindows(state.windows, 'all');
  assert.equal(all.length, 3);

  const active = filterWindows(state.windows, 'active');
  assert.equal(active.length, 2);
  assert.ok(active.some(w => w.id === 'notes'));
  assert.ok(active.some(w => w.id === 'calculator'));
  assert.ok(!active.some(w => w.id === 'terminal'));

  const minimized = filterWindows(state.windows, 'minimized');
  assert.equal(minimized.length, 1);
  assert.equal(minimized[0].id, 'terminal');
});

test('task manager: search filtering and sorting logic', () => {
  const mockAppList = [
    { id: 'notes', name: 'Notes', detail: 'Quickly jot down ideas', minimized: false, isFocused: false, openedAt: 100 },
    { id: 'terminal', name: 'Terminal', detail: 'A different way to explore', minimized: true, isFocused: false, openedAt: 200 },
    { id: 'tasks', name: 'Task Manager', detail: 'Monitor applications, windows & performance', minimized: false, isFocused: true, openedAt: 300 },
  ];

  // 1. Search filter
  const searchFilter = (list, query) => {
    if (!query.trim()) return list;
    const q = query.toLowerCase().trim();
    return list.filter(w => w.name.toLowerCase().includes(q) || w.detail.toLowerCase().includes(q));
  };

  assert.equal(searchFilter(mockAppList, 'note').length, 1);
  assert.equal(searchFilter(mockAppList, 'manager').length, 1);
  assert.equal(searchFilter(mockAppList, 'xyz').length, 0);

  // 2. Sort by name
  const sortByNameAsc = [...mockAppList].sort((a, b) => a.name.localeCompare(b.name));
  assert.equal(sortByNameAsc[0].id, 'notes');
  assert.equal(sortByNameAsc[1].id, 'tasks');
  assert.equal(sortByNameAsc[2].id, 'terminal');

  // 3. Sort by state (Focused -> Running -> Minimized)
  const sortByState = [...mockAppList].sort((a, b) => {
    const score = (w) => (w.isFocused ? 0 : !w.minimized ? 1 : 2);
    return score(a) - score(b);
  });
  assert.equal(sortByState[0].id, 'tasks', 'Focused app should come first');
  assert.equal(sortByState[1].id, 'notes', 'Running app should come second');
  assert.equal(sortByState[2].id, 'terminal', 'Minimized app should come third');
});

test('task manager: self-management and closing self', () => {
  let state = initialState;
  state = reduce(state, { type: 'open', id: 'notes' });
  state = reduce(state, { type: 'open', id: 'tasks' });

  assert.equal(state.windows.length, 2);
  assert.equal(state.activeId, 'tasks');

  // Task manager closing itself
  state = reduce(state, { type: 'close', id: 'tasks' });
  assert.equal(state.windows.length, 1);
  assert.equal(state.windows[0].id, 'notes');
  assert.equal(state.activeId, 'notes');
});

test('task manager: switching to minimized app restores and focuses it', () => {
  let state = initialState;
  state = reduce(state, { type: 'open', id: 'calculator' });
  state = reduce(state, { type: 'open', id: 'tasks' });
  state = reduce(state, { type: 'minimize', id: 'calculator' });

  assert.equal(state.windows.find(w => w.id === 'calculator').minimized, true);
  assert.equal(state.activeId, 'tasks');

  // Trigger restore via open action
  state = reduce(state, { type: 'open', id: 'calculator' });
  assert.equal(state.windows.find(w => w.id === 'calculator').minimized, false);
  assert.equal(state.activeId, 'calculator');
});
