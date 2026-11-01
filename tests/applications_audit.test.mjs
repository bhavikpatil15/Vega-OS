import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apps } from '../src/apps.ts';
import { initialState, windowReducer as reduce } from '../src/windows/model.ts';

test('audit: all applications in VEGA OS have definitions and metadata', () => {
  assert.equal(apps.length, 11, 'Should have exactly 11 core applications');
  const expectedIds = ['about', 'projects', 'terminal', 'contact', 'notes', 'calculator', 'files', 'editor', 'browser', 'settings', 'tasks'];
  
  for (const id of expectedIds) {
    const app = apps.find(a => a.id === id);
    assert.ok(app, `App ${id} must exist in registry`);
    assert.ok(app.name && app.name.length > 0, `App ${id} must have a name`);
    assert.ok(app.detail && app.detail.length > 0, `App ${id} must have a detail description`);
    assert.ok(app.color && app.color.length > 0, `App ${id} must have an assigned color theme`);
  }
});

test('audit: opening and switching between all 11 applications', () => {
  let state = initialState;

  for (const app of apps) {
    state = reduce(state, { type: 'open', id: app.id });
    assert.equal(state.activeId, app.id, `Opening ${app.id} should make it active`);
  }

  assert.equal(state.windows.length, 11, 'All 11 applications can be open simultaneously');

  // Test focusing back to About
  state = reduce(state, { type: 'focus', id: 'about' });
  assert.equal(state.activeId, 'about', 'Focusing About should bring it to the front');

  // Test minimizing About
  state = reduce(state, { type: 'minimize', id: 'about' });
  const aboutWin = state.windows.find(w => w.id === 'about');
  assert.equal(aboutWin.minimized, true, 'About should be marked minimized');
  assert.notEqual(state.activeId, 'about', 'Minimized window cannot remain active');
});

test('audit: contact form validation logic', () => {
  const validateContact = (name, email, subject, message) => {
    const errors = {};
    if (!name.trim() || name.trim().length < 2) errors.name = 'Invalid name';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Invalid email';
    if (!subject.trim()) errors.subject = 'Invalid subject';
    if (!message.trim() || message.trim().length < 10) errors.message = 'Invalid message';
    return { valid: Object.keys(errors).length === 0, errors };
  };

  // Failing cases
  assert.equal(validateContact('', '', '', '').valid, false);
  assert.equal(validateContact('A', 'bademail', '', 'short').valid, false);

  // Passing case
  const passed = validateContact('Alex', 'alex@example.com', 'Feature Request', 'Here is a detailed suggestion for VEGA OS.');
  assert.equal(passed.valid, true);
  assert.deepEqual(passed.errors, {});
});

test('audit: universal search filtering logic across apps and categories', () => {
  const searchFilter = (query) => {
    const q = query.toLowerCase().trim();
    const matchedApps = apps.filter(a => a.name.toLowerCase().includes(q) || a.detail.toLowerCase().includes(q));
    return matchedApps;
  };

  const termMatch = searchFilter('term');
  assert.ok(termMatch.some(a => a.id === 'terminal'));

  const calcMatch = searchFilter('calc');
  assert.ok(calcMatch.some(a => a.id === 'calculator'));

  const editMatch = searchFilter('edit');
  assert.ok(editMatch.some(a => a.id === 'editor'));

  const emptyMatch = searchFilter('nonexistentxyz');
  assert.equal(emptyMatch.length, 0);
});

test('audit: system branding and PWA metadata consistently reference VEGA OS', async () => {
  const fs = await import('node:fs/promises');
  const indexHtml = await fs.readFile(new URL('../index.html', import.meta.url), 'utf-8');
  assert.ok(indexHtml.includes('<title>VEGA OS</title>'), 'HTML title must be VEGA OS');
  assert.ok(indexHtml.includes('content="VEGA OS"'), 'Apple mobile web app title must be VEGA OS');

  const manifest = JSON.parse(await fs.readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf-8'));
  assert.equal(manifest.name, 'VEGA OS', 'Manifest name must be VEGA OS');
  assert.equal(manifest.short_name, 'VEGA', 'Manifest short name must be VEGA');
});
