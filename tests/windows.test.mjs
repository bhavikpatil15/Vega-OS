import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialState, windowReducer as reduce, clampPosition } from '../src/windows/model.ts';

// Mock localStorage for node test runner
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => mockStorage.get(key) ?? null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

const open = (state, id) => reduce(state, { type: 'open', id });
test('multiple windows, focus and repeated opening maintain one window per app', () => {
 let state = open(open(initialState, 'about'), 'projects');
 assert.equal(state.windows.length, 2); assert.equal(state.activeId, 'projects');
 state = open(state, 'about');
 assert.equal(state.windows.length, 2); assert.equal(state.windows.at(-1).id, 'about');
});
test('minimize preserves geometry, restore reuses window, close picks visible successor', () => {
 let state = open(open(initialState, 'about'), 'projects');
 state = reduce(state, { type: 'move', id:'projects', x:200, y:100 });
 state = reduce(state, { type:'minimize', id:'projects' });
 assert.equal(state.activeId,'about'); assert.equal(state.windows.find(w=>w.id==='projects').minimized,true);
 state = open(state,'projects'); assert.equal(state.windows.at(-1).x,200);
 state = reduce(state,{type:'close',id:'projects'}); assert.equal(state.activeId,'about'); assert.equal(state.windows.length,1);
 state = reduce(state,{type:'close',id:'about'}); assert.equal(state.activeId,null);
});
test('maximize and restore retain original position and reject dragging when maximized', () => {
 let state=open(initialState,'about'); const before=state.windows[0];
 state=reduce(state,{type:'maximize',id:'about'});
 assert.equal(state.windows[0].maximized, true);
 assert.equal(state.windows[0].x, 0, 'Maximized window must anchor at x: 0');
 assert.equal(state.windows[0].y, 0, 'Maximized window must anchor at y: 0');
 assert.equal(state.windows[0].width, 1000, 'Maximized window width must fill workspace bounds');
 assert.equal(state.windows[0].height, 600, 'Maximized window height must fill workspace bounds');

 // Dragging while maximized is rejected, position remains anchored at (0, 0)
 state=reduce(state,{type:'move',id:'about',x:999,y:999});
 assert.equal(state.windows[0].x, 0);
 assert.equal(state.windows[0].y, 0);

 // Restore brings window back to floating coordinates and normal size
 state=reduce(state,{type:'maximize',id:'about'});
 assert.equal(state.windows[0].maximized, false);
 assert.equal(state.windows[0].x, before.x);
 assert.equal(state.windows[0].y, before.y);
 assert.equal(state.windows[0].width, 640);
 assert.equal(state.windows[0].height, 410);
});
test('edge dragging and viewport shrink keep the full window inside bounds', () => {
 assert.deepEqual(clampPosition(-1000,-1000,{width:1000,height:600}),{x:0,y:0});
 assert.deepEqual(clampPosition(10000,10000,{width:1000,height:600}),{x:360,y:190});
 let state=open(initialState,'about');state=reduce(state,{type:'resize',bounds:{width:280,height:190}});
 assert.equal(state.windows[0].x,0);assert.equal(state.windows[0].y,0);
});
test('mobile desktop action preserves every open window and its state', () => {
 let state=open(open(initialState,'about'),'projects');const windows=state.windows;
 state=reduce(state,{type:'desktop'});assert.equal(state.activeId,null);assert.equal(state.windows,windows);
 state=open(state,'about');assert.equal(state.windows.length,2);assert.equal(state.activeId,'about');
});

test('window manager: remembers maximized state across close and reopen', () => {
  let state = open(initialState, 'browser');
  assert.equal(state.windows[0].maximized, false);

  // Maximize browser
  state = reduce(state, { type: 'maximize', id: 'browser' });
  assert.equal(state.windows[0].maximized, true);
  assert.equal(state.windows[0].x, 0);
  assert.equal(state.windows[0].y, 0);
  assert.equal(state.windows[0].width, 1000);
  assert.equal(state.windows[0].height, 600);

  // Close browser
  state = reduce(state, { type: 'close', id: 'browser' });
  assert.equal(state.windows.length, 0);

  // Reopen browser -> must remember maximized: true, anchored at 0, 0, filling bounds
  state = open(state, 'browser');
  assert.equal(state.windows.length, 1);
  assert.equal(state.windows[0].id, 'browser');
  assert.equal(state.windows[0].maximized, true, 'Reopened browser must remember maximized state');
  assert.equal(state.windows[0].x, 0, 'Reopened maximized window must anchor at x: 0');
  assert.equal(state.windows[0].y, 0, 'Reopened maximized window must anchor at y: 0');
  assert.equal(state.windows[0].width, 1000, 'Reopened maximized window must fill bounds width');
  assert.equal(state.windows[0].height, 600, 'Reopened maximized window must fill bounds height');
});

test('window manager: recalculates maximized window dimensions on workspace resize', () => {
  mockStorage.clear();
  let state = open(initialState, 'browser');
  state = reduce(state, { type: 'maximize', id: 'browser' });
  assert.equal(state.windows[0].x, 0);
  assert.equal(state.windows[0].y, 0);
  assert.equal(state.windows[0].width, 1000);
  assert.equal(state.windows[0].height, 600);

  // Resize workspace bounds (e.g. desktop viewport changes)
  state = reduce(state, { type: 'resize', bounds: { width: 1440, height: 900 } });
  assert.equal(state.windows[0].maximized, true);
  assert.equal(state.windows[0].x, 0);
  assert.equal(state.windows[0].y, 0);
  assert.equal(state.windows[0].width, 1440, 'Maximized window width must update to new workspace bounds');
  assert.equal(state.windows[0].height, 900, 'Maximized window height must update to new workspace bounds');

  // Unmaximize after resize restores to clamped normal coordinates
  state = reduce(state, { type: 'maximize', id: 'browser' });
  assert.equal(state.windows[0].maximized, false);
  assert.equal(state.windows[0].width, 640);
  assert.equal(state.windows[0].height, 410);
});

test('window manager: retains maximized state across minimize and restore', () => {
  let state = open(initialState, 'notes');
  state = reduce(state, { type: 'maximize', id: 'notes' });
  assert.equal(state.windows[0].maximized, true);

  // Minimize while maximized
  state = reduce(state, { type: 'minimize', id: 'notes' });
  assert.equal(state.windows[0].minimized, true);
  assert.equal(state.windows[0].maximized, true, 'Minimized window should retain maximized attribute');

  // Restore
  state = open(state, 'notes');
  assert.equal(state.windows[0].minimized, false);
  assert.equal(state.windows[0].maximized, true, 'Restored window should still be maximized');
});

test('window manager: remembers custom normal position across close and reopen', () => {
  let state = open(initialState, 'editor');
  state = reduce(state, { type: 'move', id: 'editor', x: 150, y: 80 });
  assert.equal(state.windows[0].x, 150);
  assert.equal(state.windows[0].y, 80);

  // Close window
  state = reduce(state, { type: 'close', id: 'editor' });

  // Reopen window -> restores custom normal position
  state = open(state, 'editor');
  assert.equal(state.windows[0].x, 150);
  assert.equal(state.windows[0].y, 80);
});
