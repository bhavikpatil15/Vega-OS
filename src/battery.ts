// src/battery.ts
import { useState, useEffect } from 'react';

export interface BatteryStatus {
  level: number; // 0 to 100
  charging: boolean;
  supported: boolean;
}

interface WebBatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

/**
 * Hook to retrieve real device battery level and charging state
 * using the Web Battery Status API with graceful fallbacks.
 */
export function useBattery(): BatteryStatus {
  const [battery, setBattery] = useState<BatteryStatus>(() => {
    return {
      level: 100,
      charging: true,
      supported: false,
    };
  });

  useEffect(() => {
    let batteryManager: WebBatteryManager | null = null;
    let isMounted = true;

    const handleLevelChange = () => {
      if (!isMounted || !batteryManager) return;
      setBattery(prev => ({
        ...prev,
        level: Math.round((batteryManager!.level ?? 1) * 100),
        supported: true,
      }));
    };

    const handleChargingChange = () => {
      if (!isMounted || !batteryManager) return;
      setBattery(prev => ({
        ...prev,
        charging: Boolean(batteryManager!.charging),
        supported: true,
      }));
    };

    const nav = typeof navigator !== 'undefined'
      ? (navigator as unknown as { getBattery?: () => Promise<WebBatteryManager> })
      : null;

    if (nav && typeof nav.getBattery === 'function') {
      nav.getBattery()
        .then(bm => {
          if (!isMounted) return;
          batteryManager = bm;
          const level = Math.round((bm.level ?? 1) * 100);
          const charging = Boolean(bm.charging);

          setBattery({
            level: Math.max(0, Math.min(100, level)),
            charging,
            supported: true,
          });

          bm.addEventListener('levelchange', handleLevelChange);
          bm.addEventListener('chargingchange', handleChargingChange);
        })
        .catch(() => {
          if (isMounted) {
            setBattery({ level: 100, charging: true, supported: false });
          }
        });
    }

    return () => {
      isMounted = false;
      if (batteryManager) {
        try {
          batteryManager.removeEventListener('levelchange', handleLevelChange);
          batteryManager.removeEventListener('chargingchange', handleChargingChange);
        } catch {}
      }
    };
  }, []);

  return battery;
}
