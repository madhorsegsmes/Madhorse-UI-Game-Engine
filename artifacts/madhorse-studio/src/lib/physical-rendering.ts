export function reflectionStrength(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(2, value)) : 0.65;
}

/** Own only the generated environment. Never replace or dispose a user-supplied environment. */
export function installReflectionEnvironment<T>(
  scene: { environment: T | null; environmentIntensity: number },
  build: () => { texture: T; dispose: () => void },
  intensity: number,
) {
  if (scene.environment !== null) return null;
  const previousIntensity = scene.environmentIntensity;
  const target = build();
  scene.environment = target.texture;
  scene.environmentIntensity = reflectionStrength(intensity);
  let disposed = false;
  return {
    setIntensity(value: number) {
      if (!disposed && scene.environment === target.texture) scene.environmentIntensity = reflectionStrength(value);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (scene.environment === target.texture) {
        scene.environment = null;
        scene.environmentIntensity = previousIntensity;
      }
      target.dispose();
    },
  };
}

/** Bounded real frame intervals, not GPU timings or a synthetic benchmark. */
export class FrameIntervalWindow {
  private intervals: number[] = [];
  readonly capacity: number;
  constructor(capacity = 180) {
    this.capacity = Number.isFinite(capacity) ? Math.min(600, Math.max(2, Math.floor(capacity))) : 180;
  }
  reset() { this.intervals = []; }
  push(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.intervals.push(seconds * 1000);
    if (this.intervals.length > this.capacity) this.intervals.shift();
  }
  get summary() {
    if (!this.intervals.length) return null;
    const sorted = [...this.intervals].sort((a, b) => a - b);
    const meanMs = this.intervals.reduce((total, ms) => total + ms, 0) / this.intervals.length;
    const p95Ms = sorted[Math.ceil(sorted.length * 0.95) - 1];
    return {
      frames: this.intervals.length, fps: 1000 / meanMs, meanMs, p95Ms,
      worstMs: sorted[sorted.length - 1],
      // Ten percent scheduling tolerance avoids flagging ordinary 60 Hz jitter.
      overBudget: p95Ms > (1000 / 60) * 1.1,
    };
  }
}
