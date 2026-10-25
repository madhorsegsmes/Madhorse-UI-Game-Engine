import { useEffect, useMemo, useRef, useState } from 'react';
import { useSceneRenderSettings } from '@/hooks/use-scene-render-settings';
import type { FreshWorkspaceSnapshot } from '@/lib/fresh-workspace-storage';
import { createWebGameData, webGameWarnings } from '@/lib/web-game-format';
import { exportWebGame } from '@/lib/web-game-export';

export function WebGameExportDialog({ projectId, name, snapshot, onClose }: {
  projectId: string;
  name: string;
  snapshot: FreshWorkspaceSnapshot;
  onClose: () => void;
}) {
  const [settings] = useSceneRenderSettings();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => { if (busy) dialog.current?.focus(); }, [busy]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const preflightError = useMemo(() => {
    try { createWebGameData(name, snapshot, settings); return ''; }
    catch (cause) { return cause instanceof Error ? cause.message : 'The scene is not ready to export.'; }
  }, [name, snapshot, settings]);

  async function download() {
    if (inFlight.current || preflightError) return;
    inFlight.current = true; setBusy(true); setError(''); setMessage('Preparing your standalone game…');
    try {
      const archive = await exportWebGame(projectId, name, snapshot, settings, setMessage);
      const url = URL.createObjectURL(archive.blob);
      const link = document.createElement('a');
      link.href = url; link.download = archive.fileName;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage(`Downloaded ${archive.fileName}. Extract it and follow README.txt to serve it over HTTP.`);
    } catch (cause) {
      setMessage(''); setError(cause instanceof Error ? cause.message : 'The web game could not be exported. No incomplete download was created.');
    } finally { inFlight.current = false; setBusy(false); }
  }

  return <div className="studio-project-backdrop">
    <section ref={dialog} tabIndex={-1} className="studio-project-dialog web-export-dialog" role="dialog" aria-modal="true"
      aria-labelledby="web-export-heading" aria-describedby="web-export-description" aria-busy={busy}
      onKeyDown={event => {
        if (event.key === 'Escape' && !busy) { event.preventDefault(); event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab') return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        if (!buttons.length) { event.preventDefault(); return; }
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
      <h2 id="web-export-heading">Export web game</h2>
      <p id="web-export-description">Package <strong>{name}</strong> as a standalone web game. The ZIP includes the player,
        this scene, built-in gameplay, animation controllers, audio, custom UI layout, and project assets. It does not include the editor.</p>
      <p><strong>{snapshot.entities.length} objects · {snapshot.assets.length} assets</strong><br />
        Render quality: {settings.quality}. Your saved project is not changed.</p>
      <h3>Before downloading</h3>
      <ul>{webGameWarnings(snapshot).map(warning => <li key={warning}>{warning}</li>)}</ul>
      <p>Extract the complete ZIP and serve the folder with a static web host or HTTP server.
        Don’t open index.html directly. Instructions are included in README.txt.
        Embedded GLB models are recommended for portable textures.</p>
      {(error || preflightError) && <p role="alert" className="web-export-error">{error || preflightError}</p>}
      {message && <p role="status" data-testid="web-export-status">{message}</p>}
      <footer>
        <button type="button" disabled={busy} onClick={onClose}>Close</button>
        <button type="button" autoFocus disabled={busy || !!preflightError} onClick={() => void download()}
          data-testid="button-download-web-game">{busy ? 'Exporting…' : 'Download web game ZIP'}</button>
      </footer>
    </section>
  </div>;
}
