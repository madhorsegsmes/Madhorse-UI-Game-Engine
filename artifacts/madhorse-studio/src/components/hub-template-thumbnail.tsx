import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { HubPreviewQueue } from '@/lib/hub-preview-queue';

const cacheKey = 'madhorse:hub-template-thumbnails:2';
function readCached(): [string, string][] {
  try {
    const stored = JSON.parse(sessionStorage.getItem(cacheKey) ?? 'null');
    if (!stored || Date.now() - stored.savedAt > 30 * 60 * 1000 || !Array.isArray(stored.images)) return [];
    return stored.images.filter((entry: unknown): entry is [string, string] =>
      Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' &&
      typeof entry[1] === 'string' && entry[1].startsWith('data:image/webp') &&
      entry[1].length < 1024 * 1024).slice(0, 10);
  } catch { return []; }
}
const queue = new HubPreviewQueue(readCached(), images => {
  try { sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), images })); }
  catch { /* Storage limits must never interrupt browsing or project editing. */ }
});

export function HubTemplateThumbnail({ kind, header, lightweight = false, children }: {
  kind: string;
  header: ReactNode;
  lightweight?: boolean;
  children: (onCapture: (image: string) => void) => ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(() => !document.hidden);
  const snapshot = useSyncExternalStore(queue.subscribe, () => queue.snapshot(kind));
  const active = visible && foreground && (lightweight || snapshot === 'render');
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(node);
    const change = () => setForeground(!document.hidden);
    document.addEventListener('visibilitychange', change);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', change); };
  }, []);
  useEffect(() => {
    if (visible && foreground && !lightweight) return queue.register(kind);
    return undefined;
  }, [kind, visible, foreground, lightweight]);

  useEffect(() => {
    if (!active || lightweight) return;
    let cancelled = false;
    let copying = false;
    // A software-rendered scene is also rasterized once, rather than keeping
    // thousands of SVG polygons alive across all ten cards.
    const captureSoftware = async () => {
      const svg = host.current?.querySelector('.mh-scene3d__software-canvas svg');
      if (!svg || !svg.childElementCount || copying) return;
      copying = true;
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        if (cancelled) return;
        const canvas = document.createElement('canvas');
        const bounds = svg.getBoundingClientRect();
        canvas.width = 640;
        canvas.height = Math.max(1, Math.round(640 * bounds.height / Math.max(1, bounds.width)));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Thumbnail canvas unavailable');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        queue.finish(kind, canvas.toDataURL('image/webp', .88));
      } catch {
        if (!cancelled) copying = false;
      } finally { URL.revokeObjectURL(url); }
    };
    const observer = new MutationObserver(() => { void captureSoftware(); });
    if (host.current) observer.observe(host.current, { subtree: true, childList: true });
    void captureSoftware();
    return () => { cancelled = true; observer.disconnect(); };
  }, [active, kind, lightweight]);

  const image = snapshot !== 'render' && snapshot !== 'waiting' ? snapshot : null;
  return <div ref={host} className="hub-fight-screen" data-testid={`hub-${kind}-thumbnail`}
    data-preview-state={image ? 'cached' : active ? lightweight ? 'lightweight' : 'rendering' : 'waiting'}>
    {image && header}
    {image ? <img src={image} alt={`${kind} template scene`} style={{ position: 'absolute', inset: '22px 0 0', width: '100%', height: 'calc(100% - 22px)', objectFit: 'cover' }} />
      : active ? children(image => queue.finish(kind, image))
      : <div className="hub-preview-waiting">Template scene · Preparing preview…</div>}
  </div>;
}
