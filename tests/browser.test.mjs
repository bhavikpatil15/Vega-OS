import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { apps } from '../src/apps.ts';
import { initialState, windowReducer as reduce } from '../src/windows/model.ts';
import {
  resolveNavigationInput,
  getStoredBookmarks,
  saveBookmark,
  removeBookmark,
  isBookmarked,
  getBookmarkByUrl,
  getStoredBookmarkFolders,
  createBookmarkFolder,
  renameBookmarkFolder,
  deleteBookmarkFolder,
  moveBookmarkToFolder,
  searchBookmarks,
  getStoredHistory,
  addHistoryEntry,
  removeHistoryEntry,
  clearStoredHistory,
  getStoredBrowserSettings,
  saveStoredBrowserSettings,
  createNewTab,
  duplicateTab,
  reorderTabsWithPinned,
  togglePinTab,
  closeTab,
  getFaviconUrl,
  getStoredTabs,
  saveStoredTabs,
  navigateTab,
  canGoBack,
  canGoForward,
  goBack,
  goForward,
  isKnownFrameBlocked,
  SEARCH_ENGINES,
} from '../src/browserUtils.ts';

// Mock localStorage for node test runner
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

test('browser: registered properly in system apps registry', () => {
  const browserApp = apps.find(a => a.id === 'browser');
  assert.ok(browserApp, 'Browser must exist in apps registry');
  assert.equal(browserApp.name, 'Browser');
  assert.ok(browserApp.detail && browserApp.detail.length > 0);
  assert.equal(browserApp.color, 'blue');
  assert.ok(browserApp.icon, 'Browser must have an icon');
});

test('browser: opening and closing in window manager', () => {
  let state = reduce(initialState, { type: 'open', id: 'browser' });
  assert.equal(state.activeId, 'browser');
  assert.equal(state.windows.length, 1);
  assert.equal(state.windows[0].id, 'browser');

  state = reduce(state, { type: 'minimize', id: 'browser' });
  assert.equal(state.windows[0].minimized, true);
  assert.equal(state.activeId, null);

  state = reduce(state, { type: 'open', id: 'browser' });
  assert.equal(state.windows[0].minimized, false);
  assert.equal(state.activeId, 'browser');

  state = reduce(state, { type: 'close', id: 'browser' });
  assert.equal(state.windows.length, 0);
});

test('browser: URL resolution and address bar normalization', () => {
  // 1. Empty input
  const empty = resolveNavigationInput('');
  assert.equal(empty.url, 'vega://newtab');

  // 2. Complete HTTPS URL
  const httpsUrl = resolveNavigationInput('https://developer.mozilla.org/en-US/');
  assert.equal(httpsUrl.url, 'https://developer.mozilla.org/en-US/');
  assert.equal(httpsUrl.isSearch, false);

  // 3. Domain without scheme -> auto prepend https://
  const domain = resolveNavigationInput('wikipedia.org');
  assert.equal(domain.url, 'https://wikipedia.org/');
  assert.equal(domain.isSearch, false);

  const domainWithPath = resolveNavigationInput('github.com/facebook/react');
  assert.equal(domainWithPath.url, 'https://github.com/facebook/react');

  // 4. Localhost address and IP addresses
  const localhost = resolveNavigationInput('localhost:5173');
  assert.equal(localhost.url, 'http://localhost:5173/');

  const localhostWithPath = resolveNavigationInput('localhost:3000/api/v1/health');
  assert.equal(localhostWithPath.url, 'http://localhost:3000/api/v1/health');

  const ipLocal = resolveNavigationInput('127.0.0.1:8080/dashboard');
  assert.equal(ipLocal.url, 'http://127.0.0.1:8080/dashboard');

  const ipPublic = resolveNavigationInput('192.168.1.1');
  assert.equal(ipPublic.url, 'https://192.168.1.1/');

  // 5. URLs with paths, query parameters, and fragments
  const complexUrl = resolveNavigationInput('https://example.com/search?q=test&lang=en#results');
  assert.equal(complexUrl.url, 'https://example.com/search?q=test&lang=en#results');

  const domainWithQuery = resolveNavigationInput('wikipedia.org/wiki/React?action=render#Components');
  assert.equal(domainWithQuery.url, 'https://wikipedia.org/wiki/React?action=render#Components');

  // 6. Internal protocol
  const internal = resolveNavigationInput('vega://bookmarks');
  assert.equal(internal.url, 'vega://bookmarks');
  assert.equal(internal.title, 'Bookmarks');

  // 7. Security blocking: javascript and data schemes
  const jsAttack = resolveNavigationInput('javascript:alert(document.cookie)');
  assert.equal(jsAttack.url, 'vega://error?reason=security-blocked');

  const dataAttack = resolveNavigationInput('data:text/html,<script>evil()</script>');
  assert.equal(dataAttack.url, 'vega://error?reason=security-blocked');

  // 8. Unsupported protocols
  const ftp = resolveNavigationInput('ftp://files.example.com/archive.zip');
  assert.equal(ftp.url, 'vega://error?reason=unsupported-scheme&target=ftp%3A%2F%2Ffiles.example.com%2Farchive.zip');

  const ws = resolveNavigationInput('ws://echo.websocket.org');
  assert.equal(ws.url, 'vega://error?reason=unsupported-scheme&target=ws%3A%2F%2Fecho.websocket.org');

  // 9. Malformed / Invalid URL
  const invalid = resolveNavigationInput('https://');
  assert.ok(invalid.url.startsWith('vega://error?reason=invalid-url'));
});

test('browser: search query resolution with configurable engines', () => {
  // Google (default when no engine argument provided)
  const defaultSearch = resolveNavigationInput('quantum computing algorithms');
  assert.equal(defaultSearch.isSearch, true);
  assert.ok(defaultSearch.url.startsWith('https://www.google.com/search?q=quantum%20computing%20algorithms'));

  // Google (explicit)
  const google = resolveNavigationInput('typescript generics tutorial', 'google');
  assert.equal(google.isSearch, true);
  assert.ok(google.url.startsWith('https://www.google.com/search?q=typescript%20generics%20tutorial'));

  // DuckDuckGo
  const ddg = resolveNavigationInput('quantum computing algorithms', 'duckduckgo');
  assert.equal(ddg.isSearch, true);
  assert.ok(ddg.url.startsWith('https://duckduckgo.com/?q=quantum%20computing%20algorithms'));

  // Bing
  const bing = resolveNavigationInput('react 19 release notes', 'bing');
  assert.equal(bing.isSearch, true);
  assert.ok(bing.url.startsWith('https://www.bing.com/search?q=react%2019%20release%20notes'));

  // Ecosia
  const ecosia = resolveNavigationInput('renewable energy', 'ecosia');
  assert.equal(ecosia.isSearch, true);
  assert.ok(ecosia.url.startsWith('https://www.ecosia.org/search?q=renewable%20energy'));
});

test('browser: bookmark management and deduplication', () => {
  const initial = getStoredBookmarks();
  assert.ok(initial.length > 0, 'Should load default curated bookmarks');

  // Add custom bookmark
  const updated = saveBookmark({ url: 'https://react.dev', title: 'React Documentation' }, initial);
  assert.equal(updated[0].url, 'https://react.dev');
  assert.equal(isBookmarked('https://react.dev', updated), true);

  // Re-adding same URL should deduplicate and update
  const dupUpdated = saveBookmark({ url: 'https://react.dev', title: 'React Official' }, updated);
  const matchCount = dupUpdated.filter(b => b.url === 'https://react.dev');
  assert.equal(matchCount.length, 1, 'Bookmark URL must be unique');
  assert.equal(dupUpdated[0].title, 'React Official');

  // Remove bookmark
  const removed = removeBookmark('https://react.dev', dupUpdated);
  assert.equal(isBookmarked('https://react.dev', removed), false);
});

test('browser: history tracking, filtering and clearing', () => {
  let hist = getStoredHistory();
  assert.equal(hist.length, 0);

  // Add navigation
  hist = addHistoryEntry('https://duckduckgo.com', 'DuckDuckGo', hist);
  assert.equal(hist.length, 1);
  assert.equal(hist[0].url, 'https://duckduckgo.com');

  // Should ignore internal newtab and blank pages
  hist = addHistoryEntry('vega://newtab', 'New Tab', hist);
  assert.equal(hist.length, 1, 'Should not record vega://newtab in history');

  // Consecutive navigation to same URL should not create duplicates
  hist = addHistoryEntry('https://duckduckgo.com', 'DuckDuckGo', hist);
  assert.equal(hist.length, 1);

  // New distinct URL
  hist = addHistoryEntry('https://en.wikipedia.org', 'Wikipedia', hist);
  assert.equal(hist.length, 2);
  assert.equal(hist[0].url, 'https://en.wikipedia.org');

  // Remove individual entry
  const entryId = hist[0].id;
  hist = removeHistoryEntry(entryId, hist);
  assert.equal(hist.length, 1);

  // Clear history
  clearStoredHistory();
  assert.equal(localStorage.getItem('vega-browser-history'), null);
});

test('browser: tab lifecycle and navigation stack (back/forward)', () => {
  let tab = createNewTab('vega://newtab');
  assert.equal(tab.url, 'vega://newtab');
  assert.equal(canGoBack(tab), false);
  assert.equal(canGoForward(tab), false);

  // Navigate to Page 1
  tab = navigateTab(tab, 'https://page1.com', 'Page 1');
  assert.equal(tab.url, 'https://page1.com');
  assert.equal(canGoBack(tab), true);
  assert.equal(canGoForward(tab), false);

  // Navigate to Page 2
  tab = navigateTab(tab, 'https://page2.com', 'Page 2');
  assert.equal(tab.url, 'https://page2.com');
  assert.equal(tab.history.length, 3);

  // Go Back to Page 1
  tab = goBack(tab);
  assert.equal(tab.url, 'https://page1.com');
  assert.equal(canGoBack(tab), true);
  assert.equal(canGoForward(tab), true);

  // Go Forward back to Page 2
  tab = goForward(tab);
  assert.equal(tab.url, 'https://page2.com');
  assert.equal(canGoForward(tab), false);

  // Going back and navigating to a new URL should truncate future history
  tab = goBack(tab); // now at page 1
  tab = navigateTab(tab, 'https://page3.com', 'Page 3');
  assert.equal(tab.url, 'https://page3.com');
  assert.equal(canGoForward(tab), false, 'Forward stack should be truncated');
  assert.ok(!tab.history.includes('https://page2.com'));
});

test('browser: settings persistence', () => {
  const defaults = getStoredBrowserSettings();
  assert.equal(defaults.searchEngine, 'google');
  assert.equal(defaults.homePage, 'vega://newtab');

  const updated = saveStoredBrowserSettings({ searchEngine: 'ecosia', homePage: 'https://ecosia.org' });
  assert.equal(updated.searchEngine, 'ecosia');
  assert.equal(updated.homePage, 'https://ecosia.org');

  const reloaded = getStoredBrowserSettings();
  assert.equal(reloaded.searchEngine, 'ecosia');
  assert.equal(reloaded.homePage, 'https://ecosia.org');
});

test('browser: tab creation and independent URL state isolation', () => {
  const tab1 = createNewTab('https://duckduckgo.com', 'DuckDuckGo');
  const tab2 = createNewTab('https://en.wikipedia.org', 'Wikipedia');

  assert.notEqual(tab1.id, tab2.id, 'Tabs must have unique IDs');
  assert.equal(tab1.url, 'https://duckduckgo.com');
  assert.equal(tab2.url, 'https://en.wikipedia.org');

  // Navigate tab 1; tab 2 must remain completely unaffected
  const navTab1 = navigateTab(tab1, 'https://duckduckgo.com/?q=react', 'Search');
  assert.equal(navTab1.url, 'https://duckduckgo.com/?q=react');
  assert.equal(tab2.url, 'https://en.wikipedia.org', 'Tab 2 state must not be mutated');
  assert.equal(tab2.history.length, 1);
});

test('browser: tab closing behavior (active tab migration and last-tab fallback)', () => {
  const tabA = createNewTab('https://site-a.com', 'Site A');
  const tabB = createNewTab('https://site-b.com', 'Site B');
  const tabC = createNewTab('https://site-c.com', 'Site C');
  let tabs = [tabA, tabB, tabC];

  // 1. Close a non-active tab (close C while A is active)
  let result = closeTab(tabs, tabA.id, tabC.id);
  assert.equal(result.tabs.length, 2);
  assert.equal(result.activeTabId, tabA.id, 'Active tab should remain unchanged');

  // 2. Close active tab (close A while A is active) -> switches to B
  result = closeTab(result.tabs, tabA.id, tabA.id);
  assert.equal(result.tabs.length, 1);
  assert.equal(result.activeTabId, tabB.id, 'Active tab should migrate to adjacent tab');

  // 3. Close the last remaining tab -> resets to newtab, does not empty or crash
  result = closeTab(result.tabs, tabB.id, tabB.id, 'vega://newtab');
  assert.equal(result.tabs.length, 1, 'Closing last tab must maintain exactly 1 tab');
  assert.equal(result.tabs[0].url, 'vega://newtab');
  assert.equal(result.activeTabId, result.tabs[0].id);
});

test('browser: tab duplication creates independent clones', () => {
  const original = createNewTab('https://developer.mozilla.org/en-US/', 'MDN');
  const duplicate = duplicateTab(original);

  assert.notEqual(duplicate.id, original.id, 'Duplicate tab must have a new ID');
  assert.equal(duplicate.url, original.url);
  assert.equal(duplicate.title, original.title);
  assert.equal(duplicate.pinned, false, 'Duplicated tab should start unpinned');

  // Mutating duplicate tab navigation must not alter original
  const navDup = navigateTab(duplicate, 'https://developer.mozilla.org/en-US/docs/Web/JavaScript');
  assert.notEqual(navDup.url, original.url);
  assert.equal(original.history.length, 1);
  assert.equal(navDup.history.length, 2);
});

test('browser: pinned tabs ordering and toggle behavior', () => {
  const tab1 = createNewTab('https://tab1.com', 'Tab 1');
  const tab2 = createNewTab('https://tab2.com', 'Tab 2');
  const tab3 = createNewTab('https://tab3.com', 'Tab 3');

  let tabs = [tab1, tab2, tab3];

  // Pin Tab 3 -> should move to index 0
  const pinnedResult = togglePinTab(tabs, tab3.id);
  assert.equal(pinnedResult.updatedTab.pinned, true);
  assert.equal(pinnedResult.tabs[0].id, tab3.id, 'Pinned tab must be positioned first');
  assert.equal(pinnedResult.tabs[1].id, tab1.id);
  assert.equal(pinnedResult.tabs[2].id, tab2.id);

  // Pin Tab 2 as well -> pinned tabs remain first
  const pinned2Result = togglePinTab(pinnedResult.tabs, tab2.id);
  assert.equal(pinned2Result.tabs[0].id, tab3.id);
  assert.equal(pinned2Result.tabs[1].id, tab2.id);
  assert.equal(pinned2Result.tabs[2].id, tab1.id);

  // Unpin Tab 3 -> moves after pinned tabs
  const unpinnedResult = togglePinTab(pinned2Result.tabs, tab3.id);
  assert.equal(unpinnedResult.tabs[0].id, tab2.id);
  assert.equal(unpinnedResult.tabs[0].pinned, true);
  assert.equal(unpinnedResult.tabs[1].pinned, false);
});

test('browser: tab persistence to and restoration from localStorage', () => {
  const tab1 = createNewTab('https://news.ycombinator.com', 'Hacker News', true);
  const tab2 = createNewTab('https://github.com', 'GitHub', false);
  const tabsToSave = [tab1, tab2];

  saveStoredTabs(tabsToSave, tab2.id);

  const restored = getStoredTabs();
  assert.equal(restored.tabs.length, 2);
  assert.equal(restored.activeTabId, tab2.id);

  // Pinned tab should be first
  assert.equal(restored.tabs[0].id, tab1.id);
  assert.equal(restored.tabs[0].pinned, true);
  assert.equal(restored.tabs[0].url, 'https://news.ycombinator.com');
  assert.equal(restored.tabs[1].pinned, false);
});

test('browser: favicon URL generation and protocol fallbacks', () => {
  const webFavicon = getFaviconUrl('https://en.wikipedia.org/wiki/Main_Page');
  assert.ok(webFavicon && webFavicon.includes('google.com/s2/favicons?domain=en.wikipedia.org'));

  const internalFavicon = getFaviconUrl('vega://newtab');
  assert.equal(internalFavicon, null, 'Internal vega:// pages should return null to use native vector icons');

  const emptyFavicon = getFaviconUrl('');
  assert.equal(emptyFavicon, null);
});

test('browser: bookmark folders creation, renaming, and organization', () => {
  const initialFolders = getStoredBookmarkFolders();
  assert.ok(initialFolders.length >= 2, 'Default folders should be available');

  // Create folder
  const { folders: withNewFolder, newFolder } = createBookmarkFolder('Design Assets', initialFolders);
  assert.equal(newFolder.name, 'Design Assets');
  assert.equal(withNewFolder.some(f => f.id === newFolder.id), true);

  // Rename folder
  const renamed = renameBookmarkFolder(newFolder.id, 'UI/UX Resources', withNewFolder);
  const found = renamed.find(f => f.id === newFolder.id);
  assert.equal(found.name, 'UI/UX Resources');

  // Add bookmark directly into folder
  let bookmarks = getStoredBookmarks();
  bookmarks = saveBookmark(
    { url: 'https://figma.com', title: 'Figma', folderId: newFolder.id },
    bookmarks
  );
  const figmaBm = getBookmarkByUrl('https://figma.com', bookmarks);
  assert.ok(figmaBm, 'Figma bookmark should exist');
  assert.equal(figmaBm.folderId, newFolder.id);

  // Move bookmark back to main collection (root)
  const moved = moveBookmarkToFolder(figmaBm.id, null, bookmarks);
  const movedBm = moved.find(b => b.id === figmaBm.id);
  assert.equal(movedBm.folderId, null);
});

test('browser: safe folder deletion preserves contained bookmarks by moving to root', () => {
  const { folders, newFolder } = createBookmarkFolder('Research', []);
  let bookmarks = [];

  bookmarks = saveBookmark(
    { url: 'https://arxiv.org', title: 'arXiv', folderId: newFolder.id },
    bookmarks
  );
  bookmarks = saveBookmark(
    { url: 'https://nature.com', title: 'Nature', folderId: newFolder.id },
    bookmarks
  );

  assert.equal(bookmarks.length, 2);
  assert.equal(bookmarks.every(b => b.folderId === newFolder.id), true);

  // Safe delete: deleteContainedBookmarks = false
  const safeResult = deleteBookmarkFolder(newFolder.id, folders, bookmarks, false);
  assert.equal(safeResult.folders.length, 0, 'Folder must be removed');
  assert.equal(safeResult.bookmarks.length, 2, 'Bookmarks must not be deleted');
  assert.equal(
    safeResult.bookmarks.every(b => b.folderId === null),
    true,
    'Contained bookmarks must be moved to main collection (root)'
  );
});

test('browser: folder deletion with cascade delete removes folder and contained bookmarks', () => {
  const { folders, newFolder } = createBookmarkFolder('Temporary', []);
  let bookmarks = [];

  bookmarks = saveBookmark(
    { url: 'https://temp.example.com', title: 'Temp Link', folderId: newFolder.id },
    bookmarks
  );
  bookmarks = saveBookmark(
    { url: 'https://keep.example.com', title: 'Keep Link', folderId: null },
    bookmarks
  );

  // Cascade delete: deleteContainedBookmarks = true
  const cascadeResult = deleteBookmarkFolder(newFolder.id, folders, bookmarks, true);
  assert.equal(cascadeResult.folders.length, 0);
  assert.equal(cascadeResult.bookmarks.length, 1);
  assert.equal(cascadeResult.bookmarks[0].url, 'https://keep.example.com');
});

test('browser: search bookmarks by title and URL', () => {
  const list = [
    { id: '1', url: 'https://developer.mozilla.org', title: 'MDN Web Docs', createdAt: 1 },
    { id: '2', url: 'https://github.com/facebook/react', title: 'React GitHub Repo', createdAt: 2 },
    { id: '3', url: 'https://duckduckgo.com', title: 'DuckDuckGo Search', createdAt: 3 },
  ];

  // Search by title substring
  const byTitle = searchBookmarks('docs', list);
  assert.equal(byTitle.length, 1);
  assert.equal(byTitle[0].id, '1');

  // Search by URL substring
  const byUrl = searchBookmarks('facebook/react', list);
  assert.equal(byUrl.length, 1);
  assert.equal(byUrl[0].id, '2');

  // Case-insensitive search
  const caseInsensitive = searchBookmarks('GITHUB', list);
  assert.equal(caseInsensitive.length, 1);
  assert.equal(caseInsensitive[0].id, '2');

  // Empty query returns full list
  const emptyQuery = searchBookmarks('   ', list);
  assert.equal(emptyQuery.length, 3);
});

test('browser: iframe security diagnostics & known frame-blocked origins detection', () => {
  // 1. Allowed embeddable sites
  const wikipedia = isKnownFrameBlocked('https://www.wikipedia.org/');
  assert.equal(wikipedia.isBlocked, false, 'Wikipedia does not block embedding and should load in-frame');

  const example = isKnownFrameBlocked('https://example.com/');
  assert.equal(example.isBlocked, false, 'example.com should load in-frame');

  const youtubeEmbed = isKnownFrameBlocked('https://www.youtube.com/embed/dQw4w9WgXcQ');
  assert.equal(youtubeEmbed.isBlocked, false, 'YouTube embed URLs are allowed');

  // 2. Commercial websites enforcing X-Frame-Options SAMEORIGIN / DENY
  const google = isKnownFrameBlocked('https://www.google.com/');
  assert.equal(google.isBlocked, true);
  assert.equal(google.serviceName, 'Google');
  assert.equal(google.domain, 'www.google.com');

  const youtube = isKnownFrameBlocked('https://www.youtube.com/watch?v=123');
  assert.equal(youtube.isBlocked, true);
  assert.equal(youtube.serviceName, 'YouTube');

  const duckduckgo = isKnownFrameBlocked('https://duckduckgo.com/?q=test');
  assert.equal(duckduckgo.isBlocked, true);
  assert.equal(duckduckgo.serviceName, 'DuckDuckGo');

  const github = isKnownFrameBlocked('https://github.com/facebook/react');
  assert.equal(github.isBlocked, true);
  assert.equal(github.serviceName, 'GitHub');

  const twitter = isKnownFrameBlocked('https://twitter.com/explore');
  assert.equal(twitter.isBlocked, true);
  assert.equal(twitter.serviceName, 'Twitter');

  // 3. Internal scheme is never blocked
  const internal = isKnownFrameBlocked('vega://newtab');
  assert.equal(internal.isBlocked, false);
});

test('browser: navigateTab sets loadError for frame-blocked origins and clears on allowed origins', () => {
  const initial = createNewTab('vega://newtab', 'New Tab');
  assert.equal(initial.loadError, null);

  // Navigating to DuckDuckGo search sets loadError
  const navigatedBlocked = navigateTab(initial, 'https://duckduckgo.com/?q=javascript', 'DuckDuckGo');
  assert.ok(navigatedBlocked.loadError, 'Must populate loadError for DuckDuckGo');
  assert.equal(navigatedBlocked.loadError.reason, 'frame-blocked');
  assert.equal(navigatedBlocked.loadError.failedUrl, 'https://duckduckgo.com/?q=javascript');
  assert.equal(navigatedBlocked.url, 'https://duckduckgo.com/?q=javascript');

  // Navigating subsequently to Wikipedia clears loadError
  const navigatedAllowed = navigateTab(navigatedBlocked, 'https://www.wikipedia.org/', 'Wikipedia');
  assert.equal(navigatedAllowed.loadError, null, 'Must clear loadError for embeddable site');
  assert.equal(navigatedAllowed.url, 'https://www.wikipedia.org/');
});

test('browser: query encoding with spaces, punctuation, symbols, and unicode for Google search', () => {
  // Query with spaces and punctuation
  const queryWithSymbols = resolveNavigationInput('c++ & rust in 2026', 'google');
  assert.equal(queryWithSymbols.isSearch, true);
  assert.equal(queryWithSymbols.url, 'https://www.google.com/search?q=c%2B%2B%20%26%20rust%20in%202026');

  // Query with prices, percentage and question mark
  const queryWithPunctuation = resolveNavigationInput('price: $100 & 50% discount?', 'google');
  assert.equal(queryWithPunctuation.isSearch, true);
  assert.equal(queryWithPunctuation.url, 'https://www.google.com/search?q=price%3A%20%24100%20%26%2050%25%20discount%3F');

  // Query with quotes and hash
  const queryWithQuotes = resolveNavigationInput('"quantum computing" #physics', 'google');
  assert.equal(queryWithQuotes.isSearch, true);
  assert.equal(queryWithQuotes.url, 'https://www.google.com/search?q=%22quantum%20computing%22%20%23physics');

  // Query with unicode characters
  const queryWithUnicode = resolveNavigationInput('café & résumé München', 'google');
  assert.equal(queryWithUnicode.isSearch, true);
  assert.equal(queryWithUnicode.url, 'https://www.google.com/search?q=caf%C3%A9%20%26%20r%C3%A9sum%C3%A9%20M%C3%BCnchen');
});

test('browser: direct URL navigation is preserved and not mistaken for search', () => {
  // 1. Direct HTTPS URL with path and query parameters
  const fullHttps = resolveNavigationInput('https://example.com/docs?lang=en#section-1');
  assert.equal(fullHttps.isSearch, false);
  assert.equal(fullHttps.url, 'https://example.com/docs?lang=en#section-1');

  // 2. Direct HTTP URL
  const fullHttp = resolveNavigationInput('http://example.org/about');
  assert.equal(fullHttp.isSearch, false);
  assert.equal(fullHttp.url, 'http://example.org/about');

  // 3. Bare domain without protocol (auto prepends https://)
  const bareDomain = resolveNavigationInput('wikipedia.org');
  assert.equal(bareDomain.isSearch, false);
  assert.equal(bareDomain.url, 'https://wikipedia.org/');

  // 4. Domain with path
  const domainPath = resolveNavigationInput('github.com/facebook/react');
  assert.equal(domainPath.isSearch, false);
  assert.equal(domainPath.url, 'https://github.com/facebook/react');

  // 5. Local development host
  const localhost = resolveNavigationInput('localhost:3000/api/status');
  assert.equal(localhost.isSearch, false);
  assert.equal(localhost.url, 'http://localhost:3000/api/status');

  // 6. Direct IP address
  const ip = resolveNavigationInput('192.168.1.100:8080/admin');
  assert.equal(ip.isSearch, false);
  assert.equal(ip.url, 'https://192.168.1.100:8080/admin');
});

test('browser: switching search engines between Google, DuckDuckGo, and Bing persists across reloads', () => {
  mockStorage.clear();

  // 1. Default is Google
  const initialSettings = getStoredBrowserSettings();
  assert.equal(initialSettings.searchEngine, 'google');
  const googleSearch = resolveNavigationInput('operating systems', initialSettings.searchEngine);
  assert.ok(googleSearch.url.startsWith('https://www.google.com/search?q=operating%20systems'));

  // 2. Switch to DuckDuckGo and verify persistence
  const ddgSettings = saveStoredBrowserSettings({ searchEngine: 'duckduckgo' });
  assert.equal(ddgSettings.searchEngine, 'duckduckgo');
  const reloadedDdg = getStoredBrowserSettings();
  assert.equal(reloadedDdg.searchEngine, 'duckduckgo');
  const ddgSearch = resolveNavigationInput('operating systems', reloadedDdg.searchEngine);
  assert.ok(ddgSearch.url.startsWith('https://duckduckgo.com/?q=operating%20systems'));

  // 3. Switch to Bing and verify persistence
  const bingSettings = saveStoredBrowserSettings({ searchEngine: 'bing' });
  assert.equal(bingSettings.searchEngine, 'bing');
  const reloadedBing = getStoredBrowserSettings();
  assert.equal(reloadedBing.searchEngine, 'bing');
  const bingSearch = resolveNavigationInput('operating systems', reloadedBing.searchEngine);
  assert.ok(bingSearch.url.startsWith('https://www.bing.com/search?q=operating%20systems'));

  // 4. Switch back to Google and verify persistence
  const googleBackSettings = saveStoredBrowserSettings({ searchEngine: 'google' });
  assert.equal(googleBackSettings.searchEngine, 'google');
  const reloadedGoogle = getStoredBrowserSettings();
  assert.equal(reloadedGoogle.searchEngine, 'google');
  const googleBackSearch = resolveNavigationInput('operating systems', reloadedGoogle.searchEngine);
  assert.ok(googleBackSearch.url.startsWith('https://www.google.com/search?q=operating%20systems'));
});
