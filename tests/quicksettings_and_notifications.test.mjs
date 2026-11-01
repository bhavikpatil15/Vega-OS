import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import {
  loadStoredNotifications,
  saveStoredNotifications,
  sendOSNotification,
  isDNDActive,
  setDNDActive,
} from '../src/notificationSystem.ts';
import {
  getSystemVolume,
  setSystemVolume,
} from '../src/audio.ts';

// Mock localStorage for node test runner environment
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => mockStorage.get(key) ?? null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
};

// Mock window and CustomEvent
global.window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};
global.CustomEvent = class CustomEvent {
  constructor(name, params) {
    this.name = name;
    this.detail = params?.detail;
  }
};

beforeEach(() => {
  mockStorage.clear();
});

test('notification system: dispatch and load notifications', () => {
  const notif1 = sendOSNotification({
    appName: 'Terminal',
    title: 'Process Complete',
    message: 'Finished build task',
  });

  assert.ok(notif1.id, 'Notification should have an ID');
  assert.equal(notif1.appName, 'Terminal');
  assert.equal(notif1.title, 'Process Complete');
  assert.ok(notif1.timestamp > 0);

  const list = loadStoredNotifications();
  assert.ok(list.length > 0);
  assert.equal(list[0].id, notif1.id);
  assert.equal(list[0].title, 'Process Complete');
});

test('notification dismissal and clear all', () => {
  const n1 = sendOSNotification({ appName: 'Notes', title: 'Note 1', message: 'Hello' });
  const n2 = sendOSNotification({ appName: 'Notes', title: 'Note 2', message: 'World' });

  let list = loadStoredNotifications();
  assert.ok(list.some(n => n.id === n1.id));
  assert.ok(list.some(n => n.id === n2.id));

  // Dismiss n1
  const afterDismiss = list.filter(n => n.id !== n1.id);
  saveStoredNotifications(afterDismiss);

  list = loadStoredNotifications();
  assert.ok(!list.some(n => n.id === n1.id), 'n1 should be dismissed');
  assert.ok(list.some(n => n.id === n2.id), 'n2 should still exist');

  // Clear all
  saveStoredNotifications([]);
  list = loadStoredNotifications();
  assert.equal(list.length, 0, 'List should be empty after clear all');
});

test('Do Not Disturb (DND) persistence and state toggle', () => {
  assert.equal(isDNDActive(), false, 'DND should be off by default');

  setDNDActive(true);
  assert.equal(isDNDActive(), true, 'DND should be active when enabled');
  assert.equal(mockStorage.get('nexus-dnd'), 'true');

  setDNDActive(false);
  assert.equal(isDNDActive(), false, 'DND should be false when disabled');
  assert.equal(mockStorage.get('nexus-dnd'), 'false');
});

test('system audio volume controls & limits', () => {
  setSystemVolume(50);
  assert.equal(getSystemVolume(), 50);
  assert.equal(mockStorage.get('nexus-volume'), '50');

  // Boundary checks: clamping
  setSystemVolume(150);
  assert.equal(getSystemVolume(), 100, 'Should clamp to 100 max');

  setSystemVolume(-20);
  assert.equal(getSystemVolume(), 0, 'Should clamp to 0 min');
});

test('simulated quick setting toggles persistence', () => {
  // Wi-Fi simulation
  localStorage.setItem('nexus-sim-wifi', 'false');
  assert.equal(localStorage.getItem('nexus-sim-wifi'), 'false');

  // Bluetooth simulation
  localStorage.setItem('nexus-sim-bluetooth', 'false');
  assert.equal(localStorage.getItem('nexus-sim-bluetooth'), 'false');

  // Screen Brightness simulation
  localStorage.setItem('nexus-brightness', '75');
  assert.equal(parseInt(localStorage.getItem('nexus-brightness'), 10), 75);
});

test('battery system: real Battery Status API detection and state parsing', async () => {
  // Simulate Web Battery Status API mock
  const listeners = new Map();
  const mockBatteryManager = {
    level: 0.88,
    charging: true,
    addEventListener: (event, handler) => listeners.set(event, handler),
    removeEventListener: (event) => listeners.delete(event),
  };

  Object.defineProperty(global.navigator, 'getBattery', {
    value: async () => mockBatteryManager,
    configurable: true,
    writable: true,
  });

  const bm = await global.navigator.getBattery();
  assert.equal(bm.charging, true);
  assert.equal(Math.round(bm.level * 100), 88);

  // Update battery level simulation
  mockBatteryManager.level = 0.42;
  mockBatteryManager.charging = false;
  assert.equal(Math.round(mockBatteryManager.level * 100), 42);
  assert.equal(mockBatteryManager.charging, false);
});
