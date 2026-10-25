// Silent template tutorials. One shared renderer (public/tutorial-engine.js) draws every
// guide; ?template=<slug> picks the film. The same renderer feeds the FFmpeg exporter.
import { useEffect, useMemo, useRef, useState } from 'react';
import { VideoCanvas, type VideoAspectRatio, useVideoPlayer } from '@/lib/video';

type Chapter = { id: string; start: number; end: number; dur: number };
type Engine = {
  slugs: string[];
  chapters: (slug: string) => Chapter[];
  draw: (ctx: CanvasRenderingContext2D, slug: string, t: number) => void;
};
declare global { interface Window { TutorialEngine?: Engine } }

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';

function selectedSlug(engine: Engine) {
  const q = new URLSearchParams(window.location.search).get('template') ?? '';
  return engine.slugs.includes(q) ? q : engine.slugs[0];
}

function loadEngine(): Promise<Engine> {
  if (window.TutorialEngine) return Promise.resolve(window.TutorialEngine);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${import.meta.env.BASE_URL}tutorial-engine.js`;
    script.onload = () => (window.TutorialEngine ? resolve(window.TutorialEngine) : reject(new Error('engine missing')));
    script.onerror = () => reject(new Error('engine failed to load'));
    document.head.appendChild(script);
  });
}

export default function VideoTemplate() {
  const [engine, setEngine] = useState<Engine | null>(window.TutorialEngine ?? null);
  useEffect(() => { if (!engine) loadEngine().then(setEngine).catch(console.error); }, [engine]);
  if (!engine) return <VideoCanvas aspectRatio={VIDEO_ASPECT_RATIO} style={{ backgroundColor: '#0e0f11' }} />;
  return <TutorialFilm engine={engine} />;
}

function TutorialFilm({ engine }: { engine: Engine }) {
  const slug = useMemo(() => selectedSlug(engine), [engine]);
  const durations = useMemo(
    () => Object.fromEntries(engine.chapters(slug).map(c => [c.id, Math.round(c.dur * 1000)])),
    [engine, slug],
  );
  const { currentScene } = useVideoPlayer({ durations });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clock = useRef({ base: performance.now(), scene: 0 });

  useEffect(() => {
    // Re-anchor the canvas clock on each scene change so the drawing tracks the player.
    const chapters = engine.chapters(slug);
    clock.current = { base: performance.now() - (chapters[currentScene]?.start ?? 0) * 1000, scene: currentScene };
  }, [currentScene, engine, slug]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const tick = () => {
      engine.draw(ctx, slug, (performance.now() - clock.current.base) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, slug]);

  return (
    <VideoCanvas aspectRatio={VIDEO_ASPECT_RATIO} style={{ backgroundColor: '#0e0f11' }}>
      <canvas ref={canvasRef} width={1920} height={1080} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </VideoCanvas>
  );
}
