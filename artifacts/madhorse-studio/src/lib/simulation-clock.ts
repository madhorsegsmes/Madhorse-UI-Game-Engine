/** Bounded fixed-step clock shared by gameplay and physics preview. */
export class SimulationClock {
  readonly stepSeconds = 1 / 60;
  readonly maxSteps = 5;
  private previous: number;
  private accumulator = 0;

  constructor(now: number) { this.previous = now; }

  advance(now: number, paused = false) {
    if (!Number.isFinite(now)) return { steps: 0, alpha: 0 };
    const elapsed = Math.max(0, Math.min(.1, (now - this.previous) / 1000));
    this.previous = now;
    if (paused) {
      this.accumulator = 0;
      return { steps: 0, alpha: 0 };
    }
    this.accumulator += elapsed;
    const steps = Math.min(this.maxSteps, Math.floor((this.accumulator + 1e-9) / this.stepSeconds));
    this.accumulator = Math.max(0, this.accumulator - steps * this.stepSeconds);
    // Never build a catch-up backlog after a stalled/background browser frame.
    if (this.accumulator + 1e-9 >= this.stepSeconds) {
      this.accumulator = Math.max(0, this.accumulator -
        Math.floor((this.accumulator + 1e-9) / this.stepSeconds) * this.stepSeconds);
    }
    return { steps, alpha: this.accumulator / this.stepSeconds };
  }
}
