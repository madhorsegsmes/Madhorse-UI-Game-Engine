import type { PlayerActionName } from './player-action-model';
export type AudioPlayStyle = 'tone' | 'footstep' | PlayerActionName;

const soundPresets: Record<AudioPlayStyle, { wave: OscillatorType; start: number; end: number; duration: number }> = {
  tone: { wave: 'sine', start: 440, end: 440, duration: 0.24 },
  footstep: { wave: 'triangle', start: 125, end: 55, duration: 0.12 },
  run: { wave: 'triangle', start: 145, end: 55, duration: 0.09 },
  crouch: { wave: 'triangle', start: 80, end: 35, duration: 0.16 },
  fight: { wave: 'sawtooth', start: 380, end: 60, duration: 0.15 },
  'light-attack': { wave: 'sawtooth', start: 520, end: 140, duration: 0.11 },
  'heavy-attack': { wave: 'sawtooth', start: 230, end: 45, duration: 0.2 },
  'special-attack': { wave: 'square', start: 940, end: 110, duration: 0.32 },
  shoot: { wave: 'sawtooth', start: 1100, end: 70, duration: 0.12 },
  race: { wave: 'sawtooth', start: 75, end: 100, duration: 0.24 },
  craft: { wave: 'sine', start: 650, end: 1100, duration: 0.2 },
  build: { wave: 'triangle', start: 230, end: 60, duration: 0.18 },
  block: { wave: 'triangle', start: 220, end: 90, duration: 0.12 },
  heal: { wave: 'sine', start: 500, end: 1000, duration: 0.3 },
  cast: { wave: 'sine', start: 1200, end: 250, duration: 0.25 },
  'draw-card': { wave: 'triangle', start: 450, end: 700, duration: 0.1 },
  'play-card': { wave: 'sine', start: 600, end: 300, duration: 0.18 },
  'end-turn': { wave: 'sine', start: 350, end: 750, duration: 0.24 },
  command: { wave: 'sine', start: 800, end: 1000, duration: 0.12 },
  gather: { wave: 'triangle', start: 300, end: 500, duration: 0.15 },
  follow: { wave: 'sine', start: 450, end: 650, duration: 0.18 },
  reload: { wave: 'triangle', start: 180, end: 400, duration: 0.16 },
};

let sharedContext: AudioContext | null = null;
type AudioScope = 'preview' | 'runtime';
const activeSounds: Record<AudioScope, Set<() => void>> = {
  preview: new Set(),
  runtime: new Set(),
};

export type AudioWorldPosition = { x: number; y: number; z: number };
export type SpatialAudioOptions = {
  source: AudioWorldPosition;
  listener: AudioWorldPosition;
  maxDistance?: number;
};

/** Convert the editor's x/y ground plane and z height into the Three/Web Audio Y-up world. */
export function scenePositionToAudioPosition(position: AudioWorldPosition): AudioWorldPosition {
  return {
    x: (position.x - 50) / 10,
    y: position.z / 10,
    z: (position.y - 50) / 10,
  };
}

function setPositionParam(param: AudioParam, value: number, now: number) {
  param.cancelScheduledValues(now);
  param.setValueAtTime(value, now);
}

function createSpatialPanner(context: AudioContext, spatial: SpatialAudioOptions): PannerNode {
  const panner = context.createPanner();
  const maxDistance = clamp(spatial.maxDistance ?? 50, 5, 200);
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 1;
  panner.maxDistance = maxDistance;
  panner.rolloffFactor = 1;
  const now = context.currentTime;
  setPositionParam(panner.positionX, spatial.source.x, now);
  setPositionParam(panner.positionY, spatial.source.y, now);
  setPositionParam(panner.positionZ, spatial.source.z, now);
  setListenerPosition(context, spatial.listener);
  return panner;
}

function setListenerPosition(context: AudioContext, position: AudioWorldPosition) {
  const now = context.currentTime;
  setPositionParam(context.listener.positionX, position.x, now);
  setPositionParam(context.listener.positionY, position.y, now);
  setPositionParam(context.listener.positionZ, position.z, now);
}

/** Move the shared Web Audio listener during Play/Test without creating audio before user interaction. */
export function updateSpatialAudioListener(position: AudioWorldPosition) {
  if (!sharedContext || sharedContext.state === 'closed') return;
  setListenerPosition(sharedContext, position);
}

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

function playBuiltInSound(
  style: AudioPlayStyle,
  volume: number,
  pitch: number,
  scope: AudioScope,
  spatial?: SpatialAudioOptions,
): boolean {
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
    const panner = spatial ? createSpatialPanner(context, spatial) : null;
    if (panner) {
      gain.connect(panner);
      panner.connect(context.destination);
    } else gain.connect(context.destination);
    const stop = () => {
      try { oscillator.stop(); } catch { /* Already finished. */ }
    };
    activeSounds[scope].add(stop);
    oscillator.onended = () => {
      activeSounds[scope].delete(stop);
      oscillator.disconnect();
      gain.disconnect();
      panner?.disconnect();
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
  spatial?: SpatialAudioOptions,
): Promise<boolean> {
  if (activeSounds[scope].size >= (scope === 'runtime' ? 16 : 4)) return false;
  if (!clipUrl) return playBuiltInSound(style, volume, pitch, scope, spatial);

  let cleanup: (() => void) | undefined;
  try {
    const player = new Audio(clipUrl);
    player.volume = clamp(volume, 0, 1);
    player.playbackRate = clamp(pitch, 0.25, 2);
    const context = spatial ? getAudioContext() : null;
    if (context?.state === 'suspended') void context.resume().catch(() => undefined);
    let panner: PannerNode | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    if (context && spatial) {
      try {
        panner = createSpatialPanner(context, spatial);
        source = context.createMediaElementSource(player);
      } catch {
        panner?.disconnect();
        panner = null;
        source = null;
      }
    }
    if (source && panner && context) {
      source.connect(panner);
      panner.connect(context.destination);
    }
    let stop: () => void = () => {};
    const releaseNodes = () => {
      try { source?.disconnect(); panner?.disconnect(); } catch { /* Nodes may already be disconnected. */ }
      activeSounds[scope].delete(stop);
    };
    stop = () => {
      player.pause();
      player.removeAttribute('src');
      player.load();
      releaseNodes();
    };
    activeSounds[scope].add(stop);
    cleanup = releaseNodes;
    player.onended = cleanup;
    player.onerror = cleanup;
    await player.play();
    return true;
  } catch {
    cleanup?.();
    return false;
  }
}
