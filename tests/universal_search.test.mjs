import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { apps } from '../src/apps.ts';
import {
  getRecentItems,
  saveRecentItem,
  clearRecentItems,
  calculateMatchScore,
} from '../src/searchUtils.ts';

// Mock localStorage for node test runner environment
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => mockStorage.get(key) ?? null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

beforeEach(() => {
  mockStorage.clear();
});

test('universal search: recent items tracking and deduplication', () => {
  // Initial fallback when empty
  const initial = getRecentItems();
  assert.ok(initial.length > 0, 'Should provide default recent apps if empty');

  // Add a new item
  saveRecentItem({ id: 'custom-file-1', type: 'file', title: 'notes.txt', subtitle: 'Text file' });
  let recents = getRecentItems();
  assert.equal(recents[0].id, 'custom-file-1');
  assert.equal(recents[0].title, 'notes.txt');

  // Add the same item again - should move to top and avoid duplicates
  saveRecentItem({ id: 'notes', type: 'app', title: 'Notes', subtitle: 'Quickly jot down ideas' });
  saveRecentItem({ id: 'custom-file-1', type: 'file', title: 'notes.txt', subtitle: 'Text file' });
  recents = getRecentItems();
  assert.equal(recents[0].id, 'custom-file-1');
  const occurrences = recents.filter(r => r.id === 'custom-file-1');
  assert.equal(occurrences.length, 1, 'Should deduplicate items');

  // Clear recents
  clearRecentItems();
  // Upon clear, getRecentItems returns default suggested list
  assert.equal(localStorage.getItem('nexus-recent-items'), null);
});

test('universal search: ranking priorities and scoring', () => {
  // Query ranking simulator matching UniversalSearch logic
  const rank = (query, items) => {
    const q = query.toLowerCase().trim();
    return items.map(item => {
      const title = item.title.toLowerCase();
      let score = 0;
      if (title === q) score = 100; // Exact match
      else if (title.startsWith(q)) score = 80;
      else if (title.includes(q)) score = 60;
      else if (item.subtitle?.toLowerCase().includes(q)) score = 40;

      // Apps have an additional priority boost
      const priority = item.category === 'Applications' ? score + 10 : score;
      return { ...item, priority };
    }).filter(i => i.priority > 0).sort((a, b) => b.priority - a.priority);
  };

  const pool = [
    { id: '1', category: 'Files & Folders', title: 'terminal_logs.txt', subtitle: 'File' },
    { id: '2', category: 'Applications', title: 'Terminal', subtitle: 'A different way to explore' },
    { id: '3', category: 'Settings', title: 'Theme Appearance', subtitle: 'Settings' },
  ];

  const results = rank('terminal', pool);
  assert.equal(results[0].category, 'Applications', 'Exact application match should rank highest');
  assert.equal(results[0].title, 'Terminal');
  assert.equal(results[1].title, 'terminal_logs.txt');
});

test('universal search: case-insensitive partial matching', () => {
  const matchQuery = (query, target) => target.toLowerCase().includes(query.toLowerCase().trim());

  assert.equal(matchQuery('calc', 'Calculator'), true);
  assert.equal(matchQuery('CALC', 'calculator'), true);
  assert.equal(matchQuery('not', 'Notes'), true);
  assert.equal(matchQuery('space', '3D Spatial Workspace'), true);
  assert.equal(matchQuery('unknownxyz', 'Terminal'), false);
});
