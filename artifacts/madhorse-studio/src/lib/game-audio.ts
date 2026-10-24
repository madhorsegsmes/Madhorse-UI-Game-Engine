import type { PlayerActionName } from './player-action-model';
export type AudioPlayStyle = 'tone' | 'footstep' | PlayerActionName;

const soundPresets: Record<AudioPlayStyle, { wave: OscillatorType; start: number; end: number; duration: number }> = {
  tone: { wave: 'sine', start: 440, end: 440, duration: 0.24 },
  footstep: { wave: 'triangle', start: 125, end: 55, duration: 0.12 },
  run: { wave: 'triangle', start: 145, end: 55, duration: 0.09 },
  crouch: { wave: 'triangle', start: 80, end: 35, duration: 0.16 },
  fight: { wave: 'sawtooth', start: 380, end: 60, duration: 0.15 },
  shoot: { wave: 'sawtooth', start: 1100, end: 70, duration: 0.12 },
  race: { wave: 'sawtooth', start: 75, end: 100, duration: 0.24 },
  craft: { wave: 'sine', start: 650, end: 1100, duration: 0.2 },
  build: { wave: 'triangle', start: 230, end: 60, duration: 0.18 },
};

let sharedContext: AudioContext | null = null;
type AudioScope = 'preview' | 'runtime';
const activeSounds: Record<AudioScope, Set<() => void>> = {
  preview: new Set(),
  runtime: new Set(),
};

export function stopAudioPlayback(scope: AudioScope = 'preview') {
  for (const stop of activeSounds[scope]) stop();
  activeSounds[scope].clear();
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) return null;
    sharedContext ??= new AudioContextConstructor();
    return sharedContext;
  } catch {
    return null;
  }
}

export function unlockSceneAudio(): boolean {
  const context = getAudioContext();
  if (!context) return false;
  if (context.state === 'suspended') void context.resume().catch(() => undefined);
  return true;
}

function playBuiltInSound(style: AudioPlayStyle, volume: number, pitch: number, scope: AudioScope): boolean {
  const context = getAudioContext();
  if (!context) return false;
  if (context.state === 'suspended') void context.resume().catch(() => undefined);

  try {
    const now = context.currentTime;
    const preset = soundPresets[style];
    const duration = preset.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const normalizedVolume = clamp(volume, 0, 1);
    const normalizedPitch = clamp(pitch, 0.25, 2);
    oscillator.type = preset.wave;
    oscillator.frequency.setValueAtTime(preset.start * normalizedPitch, now);
    oscillator.frequency.exponentialRampToValueAtTime(preset.end * normalizedPitch, now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, normalizedVolume), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    const stop = () => {
      try { oscillator.stop(); } catch { /* Already finished. */ }
    };
    activeSounds[scope].add(stop);
    oscillator.onended = () => {
      activeSounds[scope].delete(stop);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
    return true;
  } catch {
    return false;
  }
}

export async function playAudioPreview(
  clipUrl: string | null,
  volume: number,
  pitch: number,
  style: AudioPlayStyle,
  scope: AudioScope = 'preview',
): Promise<boolean> {
  if (activeSounds[scope].size >= (scope === 'runtime' ? 16 : 4)) return false;
  if (!clipUrl) return playBuiltInSound(style, volume, pitch, scope);

  let cleanup: (() => void) | undefined;
  try {
    const player = new Audio(clipUrl);
    player.volume = clamp(volume, 0, 1);
    player.playbackRate = clamp(pitch, 0.25, 2);
    const stop = () => {
      player.pause();
      player.removeAttribute('src');
      player.load();
    };
    activeSounds[scope].add(stop);
    cleanup = () => activeSounds[scope].delete(stop);
    player.onended = cleanup;
    player.onerror = cleanup;
    await player.play();
    return true;
  } catch {
    cleanup?.();
    return false;
  }
}
