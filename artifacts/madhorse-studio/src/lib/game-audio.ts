export type AudioPlayStyle = 'tone' | 'footstep';

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
    const duration = style === 'footstep' ? 0.12 : 0.24;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const normalizedVolume = clamp(volume, 0, 1);
    const normalizedPitch = clamp(pitch, 0.25, 2);
    oscillator.type = style === 'footstep' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(style === 'footstep' ? 125 * normalizedPitch : 440 * normalizedPitch, now);
    if (style === 'footstep') oscillator.frequency.exponentialRampToValueAtTime(55 * normalizedPitch, now + duration);

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
