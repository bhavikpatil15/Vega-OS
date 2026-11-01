// src/audio.ts
/**
 * Browser Audio Manager for VEGA OS.
 * Manages in-browser volume, master audio gain, and audio chimes.
 */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

// Default initial volume from localStorage or fallback to 80
let currentVolume = (() => {
  try {
    const saved = localStorage.getItem('nexus-volume');
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed;
    }
  } catch {}
  return 80;
})();

function getAudioContext(): { ctx: AudioContext; gain: GainNode } | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    try {
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(currentVolume / 100, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    } catch {
      return null;
    }
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx && masterGain ? { ctx: audioCtx, gain: masterGain } : null;
}

/**
 * Set the browser-wide audio volume (0 - 100).
 */
export function setSystemVolume(vol: number) {
  const clamped = Math.max(0, Math.min(100, Math.round(vol)));
  currentVolume = clamped;
  try {
    localStorage.setItem('nexus-volume', String(clamped));
  } catch {}

  const setup = getAudioContext();
  if (setup && setup.ctx && setup.gain) {
    setup.gain.gain.setValueAtTime(clamped / 100, setup.ctx.currentTime);
  }

  // Dispatch custom event so any active media in the OS can adjust their volume
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nexus-volume-change', { detail: { volume: clamped } }));
  }
}

/**
 * Get the current system volume (0 - 100).
 */
export function getSystemVolume(): number {
  return currentVolume;
}

/**
 * Play a subtle, clean synthetic tone using Web Audio API.
 */
export function playSystemSound(type: 'notification' | 'toggle' | 'slider' = 'notification') {
  if (currentVolume <= 0) return; // Muted

  const setup = getAudioContext();
  if (!setup) return;
  const { ctx, gain } = setup;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();

    osc.connect(noteGain);
    noteGain.connect(gain);

    if (type === 'notification') {
      // Gentle two-tone harmonic chime (880Hz -> 1320Hz)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

      noteGain.gain.setValueAtTime(0.001, now);
      noteGain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === 'toggle') {
      // Soft micro-click / pop
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.04);

      noteGain.gain.setValueAtTime(0.12, now);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === 'slider') {
      // Soft tactile feedback
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440 + (currentVolume * 4), now);

      noteGain.gain.setValueAtTime(0.08, now);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.start(now);
      osc.stop(now + 0.06);
    }
  } catch {}
}
