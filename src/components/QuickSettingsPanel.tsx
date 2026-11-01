// src/components/QuickSettingsPanel.tsx
import React from 'react';
import {
  Wifi,
  WifiOff,
  Bluetooth,
  BluetoothOff,
  Sun,
  Moon,
  Bell,
  BellOff,
  Volume2,
  Volume1,
  VolumeX,
  Battery,
  BatteryCharging,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  BatteryWarning,
  Settings,
  X,
  Clock,
  Sparkles,
} from 'lucide-react';
import { playSystemSound, setSystemVolume } from '../audio';
import type { BatteryStatus } from '../battery';

interface QuickSettingsPanelProps {
  onClose: () => void;
  onOpenSettings: () => void;
  theme: string;
  setTheme: (theme: string) => void;
  dnd: boolean;
  setDnd: (dnd: boolean) => void;
  simWifi: boolean;
  setSimWifi: (wifi: boolean) => void;
  simBluetooth: boolean;
  setSimBluetooth: (bt: boolean) => void;
  volume: number;
  setVolume: (vol: number) => void;
  brightness: number;
  setBrightness: (br: number) => void;
  now: Date;
  battery?: BatteryStatus;
}

export const QuickSettingsPanel: React.FC<QuickSettingsPanelProps> = ({
  onClose,
  onOpenSettings,
  theme,
  setTheme,
  dnd,
  setDnd,
  simWifi,
  setSimWifi,
  simBluetooth,
  setSimBluetooth,
  volume,
  setVolume,
  brightness,
  setBrightness,
  now,
  battery,
}) => {
  const isDark = theme === 'dark';

  const handleToggleTheme = () => {
    playSystemSound('toggle');
    setTheme(isDark ? 'light' : 'dark');
  };

  const handleToggleDnd = () => {
    playSystemSound('toggle');
    setDnd(!dnd);
  };

  const handleToggleWifi = () => {
    playSystemSound('toggle');
    setSimWifi(!simWifi);
  };

  const handleToggleBluetooth = () => {
    playSystemSound('toggle');
    setSimBluetooth(!simBluetooth);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseInt(e.target.value, 10);
    setVolume(next);
    setSystemVolume(next);
    playSystemSound('slider');
  };

  const handleBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseInt(e.target.value, 10);
    setBrightness(next);
  };

  const toggleMute = () => {
    playSystemSound('toggle');
    if (volume > 0) {
      setVolume(0);
      setSystemVolume(0);
    } else {
      setVolume(80);
      setSystemVolume(80);
    }
  };

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateString = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="quick-settings-content">
      {/* Top Header */}
      <div className="quick-settings-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-muted" />
          <span className="font-semibold text-xs tracking-wide">
            {timeString} <span className="text-muted font-normal">• {dateString}</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="icon-button"
            onClick={onOpenSettings}
            title="Open Settings App"
            aria-label="Open Settings"
          >
            <Settings size={17} />
          </button>
          <button
            className="icon-button"
            onClick={onClose}
            title="Close Quick Settings"
            aria-label="Close Quick Settings"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* 2x2 Feature Toggles Grid */}
      <div className="quick-toggles-grid">
        {/* Wi-Fi Toggle */}
        <button
          className={`quick-toggle-card ${simWifi ? 'is-active' : ''}`}
          onClick={handleToggleWifi}
          aria-pressed={simWifi}
          aria-label={`Wi-Fi simulation: ${simWifi ? 'Connected' : 'Disconnected'}`}
        >
          <span className="quick-toggle-icon">
            {simWifi ? <Wifi size={18} /> : <WifiOff size={18} />}
          </span>
          <div className="quick-toggle-info">
            <strong>Wi-Fi</strong>
            <small>{simWifi ? 'VEGA-5G (Sim)' : 'Off (Sim)'}</small>
          </div>
        </button>

        {/* Bluetooth Toggle */}
        <button
          className={`quick-toggle-card ${simBluetooth ? 'is-active' : ''}`}
          onClick={handleToggleBluetooth}
          aria-pressed={simBluetooth}
          aria-label={`Bluetooth simulation: ${simBluetooth ? 'On' : 'Off'}`}
        >
          <span className="quick-toggle-icon">
            {simBluetooth ? <Bluetooth size={18} /> : <BluetoothOff size={18} />}
          </span>
          <div className="quick-toggle-info">
            <strong>Bluetooth</strong>
            <small>{simBluetooth ? 'Active (Sim)' : 'Off (Sim)'}</small>
          </div>
        </button>

        {/* Theme Toggle */}
        <button
          className={`quick-toggle-card ${isDark ? 'is-active' : ''}`}
          onClick={handleToggleTheme}
          aria-pressed={isDark}
          aria-label={`Toggle theme: currently ${isDark ? 'Dark' : 'Light'}`}
        >
          <span className="quick-toggle-icon">
            {isDark ? <Moon size={18} /> : <Sun size={18} />}
          </span>
          <div className="quick-toggle-info">
            <strong>Appearance</strong>
            <small>{isDark ? 'Dark Mode' : 'Light Mode'}</small>
          </div>
        </button>

        {/* Do Not Disturb Toggle */}
        <button
          className={`quick-toggle-card ${dnd ? 'is-active' : ''}`}
          onClick={handleToggleDnd}
          aria-pressed={dnd}
          aria-label={`Do Not Disturb: ${dnd ? 'Enabled' : 'Disabled'}`}
        >
          <span className="quick-toggle-icon">
            {dnd ? <BellOff size={18} /> : <Bell size={18} />}
          </span>
          <div className="quick-toggle-info">
            <strong>Do Not Disturb</strong>
            <small>{dnd ? 'Alerts Muted' : 'Normal'}</small>
          </div>
        </button>
      </div>

      {/* Sliders Section */}
      <div className="quick-sliders-section">
        {/* Screen Brightness Slider */}
        <div className="quick-slider-group">
          <div className="quick-slider-label">
            <span className="flex items-center gap-1.5">
              <Sun size={14} className="text-muted" />
              <span>Display Brightness (Simulated)</span>
            </span>
            <span className="font-mono text-[11px] font-semibold">{brightness}%</span>
          </div>
          <div className="quick-slider-track">
            <input
              type="range"
              min="30"
              max="100"
              value={brightness}
              onChange={handleBrightnessChange}
              aria-label="Screen brightness visual simulation slider"
              className="quick-range-input"
            />
          </div>
        </div>

        {/* Browser Volume Slider */}
        <div className="quick-slider-group">
          <div className="quick-slider-label">
            <button
              className="flex items-center gap-1.5 text-left bg-transparent border-0 p-0 cursor-pointer"
              onClick={toggleMute}
              title={volume === 0 ? 'Unmute' : 'Mute'}
              aria-label={volume === 0 ? 'Unmute volume' : 'Mute volume'}
            >
              {volume === 0 ? (
                <VolumeX size={14} className="text-red-400" />
              ) : volume < 50 ? (
                <Volume1 size={14} className="text-muted" />
              ) : (
                <Volume2 size={14} className="text-muted" />
              )}
              <span>Browser Audio Volume</span>
            </button>
            <span className="font-mono text-[11px] font-semibold">{volume}%</span>
          </div>
          <div className="quick-slider-track">
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
              aria-label="Browser volume slider"
              className="quick-range-input"
            />
          </div>
        </div>
      </div>

      {/* Battery & System Info */}
      <div className="quick-status-row flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="quick-battery-icon">
            {battery?.charging ? (
              <BatteryCharging size={16} className="text-[#668b7b]" />
            ) : (battery?.level ?? 100) > 75 ? (
              <BatteryFull size={16} />
            ) : (battery?.level ?? 100) > 25 ? (
              <BatteryMedium size={16} />
            ) : (
              <BatteryLow size={16} className="text-amber-500" />
            )}
          </span>
          <div className="text-[11px]">
            <span className="font-medium">Battery {battery ? `${battery.level}%` : '100%'}</span>
            <span className="text-muted block text-[10px]">
              {battery?.supported
                ? (battery.charging ? 'Power Adapter Connected • Charging' : 'On Battery Power')
                : (battery?.charging ? 'Power Adapter Connected' : 'System Battery Power')}
            </span>
          </div>
        </div>
        <button
          className="quick-settings-link-btn"
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
        >
          <Settings size={13} />
          <span>All Settings</span>
        </button>
      </div>

      <div className="quick-disclosure-note">
        <Sparkles size={11} className="shrink-0 text-muted" />
        <span>Wi-Fi, Bluetooth, battery and brightness are simulated browser controls.</span>
      </div>
    </div>
  );
};
