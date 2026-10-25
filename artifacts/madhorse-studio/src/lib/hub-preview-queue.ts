/** Hub-only budget. Finished images do not retain scenes, textures or GPU contexts. */
export class HubPreviewQueue {
  private pending = new Set<string>();
  private images = new Map<string, string>();
  private listeners = new Set<() => void>();
  private active: string | null = null;
  private cooling = false;
  private persist?: (images: [string, string][]) => void;
  constructor(initialImages: Iterable<[string, string]> = [], persist?: (images: [string, string][]) => void) {
    this.images = new Map(initialImages);
    this.persist = persist;
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  snapshot = (key: string) => this.images.get(key) ?? (this.active === key ? 'render' : 'waiting');
  private emit() { this.listeners.forEach(listener => listener()); }
  private pump() {
    if (this.active || this.cooling) return;
    this.active = this.pending.values().next().value ?? null;
    this.emit();
  }
  private release() {
    this.active = null;
    this.cooling = true;
    this.emit();
    // R3F releases its old WebGL context asynchronously after unmount.
    setTimeout(() => { this.cooling = false; this.pump(); }, 750);
  }
  register(key: string) {
    if (!this.images.has(key)) { this.pending.add(key); this.pump(); }
    return () => {
      this.pending.delete(key);
      if (this.active === key) this.release();
    };
  }
  finish(key: string, image: string) {
    if (this.active !== key) return;
    this.images.set(key, image);
    this.persist?.([...this.images]);
    this.pending.delete(key);
    this.release();
  }
}
