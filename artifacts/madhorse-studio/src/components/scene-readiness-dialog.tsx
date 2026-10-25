import { useEffect, useRef, useState } from 'react';
import type { SceneEditState } from '@/lib/scene-edit-history';
import { inspectLocalAssetFile } from '@/lib/asset-vault';
import { withSystemActivity } from '@/lib/system-activity';
import { analyzeScene, checkSceneFiles, type SceneCheckReport } from '@/lib/scene-readiness';
import './scene-readiness-dialog.css';

export function SceneReadinessDialog({ source, projectId, projectName, onClose, onInspect }: {
  source: SceneEditState;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onInspect: (entityId: string) => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const request = useRef<AbortController | null>(null);
  const captured = useRef({ source, projectId, projectName });
  const [report, setReport] = useState<SceneCheckReport | null>(null);
  const [busy, setBusy] = useState(true);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const stale = captured.current.source !== source || captured.current.projectId !== projectId || captured.current.projectName !== projectName;

  async function run() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    captured.current = { source, projectId, projectName };
    setBusy(true); setReport(null); setError(''); setProgress('Checking scene and browser asset files…');
    try {
      const next = await withSystemActivity('Checking scene files', () => checkSceneFiles(
        analyzeScene(source, projectName), source.assets, id => inspectLocalAssetFile(projectId, id),
        controller.signal, (done, total) => {
          if (!controller.signal.aborted) setProgress(`Checking local files: ${done} / ${total}`);
        },
      ));
      if (!controller.signal.aborted) { setReport(next); setProgress(''); }
    } catch {
      if (!controller.signal.aborted) setError('The checks could not finish. Try again. No scene data or asset files were changed.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    void run();
    return () => {
      request.current?.abort();
      if (previous?.isConnected) {
        const target = previous instanceof HTMLButtonElement && previous.disabled
          ? previous.closest('details')?.querySelector('summary') ?? previous : previous;
        target.focus();
      }
    };
    // A changed project is marked stale, not silently rescanned while the user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function download() {
    if (!report || stale || busy) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.replace(/[^a-z0-9_-]/gi, '-').slice(0, 60) || 'project'}-scene-checks.json`;
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="mh-scene-checks-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="mh-scene-checks-heading"
      aria-describedby="mh-scene-checks-description" aria-busy={busy} className="mh-scene-checks"
      data-testid="scene-checks-dialog"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab') return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const first = controls[0], last = controls.at(-1);
        if (!first) { event.preventDefault(); return; }
        const target = document.activeElement;
        if (event.shiftKey && (target === first || target === dialog.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (target === last || target === dialog.current)) { event.preventDefault(); first.focus(); }
      }}>
      <header><h2 id="mh-scene-checks-heading">Scene checks</h2><button type="button" onClick={onClose} aria-label="Close scene checks">×</button></header>
      <p id="mh-scene-checks-description">Read-only checks for <strong>{projectName}</strong>. Problems include a suggested fix.
        This does not measure GPU speed or certify visual quality.</p>
      {stale && <p role="alert" className="mh-scene-checks__warning">The scene changed. Check again before using or downloading this report.</p>}
      {busy && <p role="status">{progress}</p>}
      {error && <p role="alert" className="mh-scene-checks__error">{error}</p>}
      {report && <>
        <small>Checked {new Date(report.checkedAt).toLocaleString()}. File presence can change; check again before export.</small>
        <p role="status" data-testid="scene-checks-summary">
          <strong>{report.summary.errors} errors · {report.summary.warnings} warnings</strong> · {report.summary.objects} objects · {report.summary.assets} assets
        </p>
        <p>{report.files.checked} / {report.files.total} imported files checked in this browser
          {' · '}{(report.files.bytes / 1048576).toFixed(1)} MiB found
          {!report.files.complete && <strong className="mh-scene-checks__warning"> · File check incomplete</strong>}
        </p>
        {!report.summary.errors && report.files.complete && !stale && <p>No blocking issues found within these checks. Test gameplay and graphics separately.</p>}
        <ol className="mh-scene-checks__findings">
          {report.findings.map((finding, index) => <li key={`${finding.code}-${index}`} data-severity={finding.severity}>
            <span className="mh-scene-checks__badge">{finding.severity}</span>
            <strong>{finding.message}</strong>
            <p>{finding.fix}</p>
            {finding.entityId && <button type="button" disabled={stale}
              onClick={() => { onClose(); onInspect(finding.entityId!); }}>Inspect object</button>}
          </li>)}
        </ol>
        {report.omittedFindings > 0 && <p>{report.omittedFindings} additional findings are included in the totals but omitted from this bounded report. Fix these first and check again.</p>}
        <small>{report.coverage} Reports stay in this dialog unless you download one; no file bytes or script source are included.</small>
      </>}
      <footer>
        <button type="button" onClick={onClose}>Close</button>
        <button type="button" disabled={busy} onClick={() => void run()}>Check again</button>
        <button type="button" disabled={busy || stale || !report} onClick={download} data-testid="download-scene-checks">Download report</button>
      </footer>
    </section>
  </div>;
}
