import { useEffect, useRef, useState } from 'react';
import { Play, Film, RefreshCw, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import './template-tutorial-library.css';

type Tutorial = {
  id: string; title: string; description: string; durationSeconds: number;
  chapters: { title: string; seconds: number }[];
  hasWebM?: boolean;
};
// The shared API artifact is registered at /api, independently of the Studio base.
const api = '/api/template-tutorials';
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;

export function TemplateTutorialLibrary() {
  const [open, setOpen] = useState(false);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mediaError, setMediaError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [mediaRetry, setMediaRetry] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef<number | null>(null);
  const selected = tutorials.find(item => item.id === selectedId) ?? tutorials[0];
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    void fetch(api, { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Tutorial videos could not be loaded. Please retry.');
      const data = await response.json() as { tutorials: Tutorial[] };
      if (!Array.isArray(data.tutorials) || data.tutorials.length !== 10) throw new Error('The tutorial library is incomplete.');
      if (!controller.signal.aborted) setTutorials(data.tutorials);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load the tutorials.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, retry]);
  useEffect(() => { setMediaError(false); pendingSeek.current = null; }, [selectedId]);
  const seek = (seconds: number) => {
    const player = video.current;
    if (!player) return;
    if (player.readyState >= 1) { player.currentTime = seconds; void player.play().catch(() => {}); }
    else { pendingSeek.current = seconds; player.load(); }
  };
  return <>
    <button className="hub-text-action template-tutorial-trigger" onClick={() => setOpen(true)} data-testid="open-template-tutorials">
      <Film size={15} /> Tutorial videos <span>10 silent guides</span>
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="template-tutorial-dialog" style={{ maxWidth: 1120, width: 'calc(100vw - 64px)' }}>
        <header className="template-tutorial-heading">
          <DialogTitle>Learn your template</DialogTitle>
          <DialogDescription>Silent animated guides · Captions and diagrams · No audio or recorded gameplay</DialogDescription>
        </header>
        {loading ? <p role="status">Loading tutorial videos…</p> : error ?
          <div role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}><RefreshCw size={14} /> Retry</button></div> :
          <div className="template-tutorial-layout">
            <nav className="template-tutorial-list" aria-label="Template tutorials">
              {tutorials.map((item, index) => <button key={item.id} aria-pressed={selected?.id === item.id}
                data-testid={`tutorial-${item.id}`} onClick={() => setSelectedId(item.id)}>
                <span className="template-tutorial-number">{String(index + 1).padStart(2, '0')}</span>
                <span><strong>{item.title}</strong><small>{time(item.durationSeconds)} · Silent guide</small></span>
                <Play size={14} />
              </button>)}
            </nav>
            {selected && <section className="template-tutorial-view" aria-label={selected.title}>
              <h3>{selected.title}</h3>
              <video key={`${selected.id}-${mediaRetry}`} ref={video} controls muted playsInline preload="metadata"
                poster={`${api}/${selected.id}/poster`}
                aria-label={`${selected.title} silent tutorial`} onError={event => { if(event.currentTarget.error)setMediaError(true); }}
                onLoadedMetadata={() => {
                  if (video.current && pendingSeek.current !== null) {
                    video.current.currentTime = pendingSeek.current; pendingSeek.current = null;
                    void video.current.play().catch(() => {});
                  }
                }}>
                {selected.hasWebM && <source src={`${api}/${selected.id}/webm`} type="video/webm" />}
                <source src={`${api}/${selected.id}/video`} type='video/mp4; codecs="avc1.640028"' />
              </video>
              {mediaError && <div role="alert" className="template-tutorial-media-error">
                Video unavailable. <button onClick={() => { setMediaError(false); setMediaRetry(value => value + 1); }}>Retry video</button>
              </div>}
              <p>{selected.description}</p>
              <div className="template-tutorial-chapters" aria-label="Tutorial chapters">
                {selected.chapters.map(chapter => <button key={`${chapter.seconds}-${chapter.title}`} onClick={() => seek(chapter.seconds)}>
                  <span>{time(chapter.seconds)}</span>{chapter.title}
                </button>)}
              </div>
              <a className="template-tutorial-download" href={`${api}/${selected.id}/video`} download={`madhorse-${selected.id}-tutorial.mp4`}>
                <Download size={14} /> Download silent MP4
              </a>
            </section>}
          </div>}
      </DialogContent>
    </Dialog>
  </>;
}
