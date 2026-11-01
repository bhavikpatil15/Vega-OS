import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apps } from '../src/apps.ts';
import { initialState, windowReducer as reduce } from '../src/windows/model.ts';

test('apps list includes settings and all core applications', () => {
  const ids = apps.map(a => a.id);
  assert.ok(ids.includes('settings'), 'Settings app must be registered');
  assert.ok(ids.includes('calculator'), 'Calculator app must be registered');
  assert.ok(ids.includes('notes'), 'Notes app must be registered');
  assert.ok(ids.includes('files'), 'Files app must be registered');
  assert.ok(ids.includes('terminal'), 'Terminal app must be registered');
  assert.ok(ids.includes('editor'), 'Editor app must be registered');

  const settingsApp = apps.find(a => a.id === 'settings');
  assert.equal(settingsApp.name, 'Settings');
  assert.ok(settingsApp.detail.length > 0);
});

test('opening and managing settings window works with window reducer', () => {
  let state = reduce(initialState, { type: 'open', id: 'settings' });
  assert.equal(state.activeId, 'settings');
  assert.equal(state.windows.length, 1);
  assert.equal(state.windows[0].id, 'settings');

  // Minimize and restore settings
  state = reduce(state, { type: 'minimize', id: 'settings' });
  assert.equal(state.windows[0].minimized, true);
  assert.equal(state.activeId, null);

  state = reduce(state, { type: 'open', id: 'settings' });
  assert.equal(state.windows[0].minimized, false);
  assert.equal(state.activeId, 'settings');

  // Close settings
  state = reduce(state, { type: 'close', id: 'settings' });
  assert.equal(state.windows.length, 0);
  assert.equal(state.activeId, null);
});

test('multiple apps can coexist across virtual workspaces', () => {
  let state = initialState;
  // Open terminal, editor, settings
  state = reduce(state, { type: 'open', id: 'terminal' });
  state = reduce(state, { type: 'open', id: 'editor' });
  state = reduce(state, { type: 'open', id: 'settings' });

  assert.equal(state.windows.length, 3);
  assert.equal(state.activeId, 'settings');

  // Focus terminal
  state = reduce(state, { type: 'focus', id: 'terminal' });
  assert.equal(state.activeId, 'terminal');
});
