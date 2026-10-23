import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  clearDiagnostics, diagnosticLimit, diagnosticSources, getDiagnostics, subscribeDiagnostics,
  type DiagnosticLevel, type DiagnosticSource,
} from '@/lib/system-diagnostics';
import './system-debugger.css';

export function SystemDebugger({ runtimeError }: { runtimeError: string }) {
  const { entries, discarded } = useSyncExternalStore(subscribeDiagnostics, getDiagnostics);
  const [level, setLevel] = useState<DiagnosticLevel | 'all'>('all');
  const [source, setSource] = useState<DiagnosticSource | 'all'>('all');
  const [search, setSearch] = useState('');
  const visible = useMemo(() => entries.filter((entry) =>
    (level === 'all' || entry.level === level) &&
    (source === 'all' || entry.source === source) &&
    `${entry.message} ${entry.detail} ${entry.source}`.toLowerCase().includes(search.toLowerCase())
  ).slice().reverse(), [entries, level, source, search]);

  function downloadReport() {
    const blob = new Blob([JSON.stringify({
      application: 'Madhorse Engine', capturedAt: new Date().toISOString(),
      scope: 'Browser editor session. Server internals and source breakpoints are not included.',
      discarded, entries,
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'madhorse-debug-report.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="system-debugger" data-testid="system-debugger">
      <div className="system-debugger__counts" aria-live="polite">
        {(['error', 'warning', 'info'] as const).map((value) => (
          <span key={value} className={`system-debugger__count is-${value}`}>
            {entries.filter((entry) => entry.level === value).reduce((sum, entry) => sum + entry.occurrences, 0)} {value === 'info' ? 'info' : `${value}s`}
          </span>
        ))}
      </div>
      <div className="system-debugger__filters">
        <select aria-label="Debugger severity" value={level} onChange={(event) => setLevel(event.target.value as typeof level)}>
          <option value="all">All levels</option>
          <option value="error">Errors</option><option value="warning">Warnings</option><option value="info">Info</option>
        </select>
        <select aria-label="Debugger subsystem" value={source} onChange={(event) => setSource(event.target.value as typeof source)}>
          <option value="all">All systems</option>
          {diagnosticSources.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <input aria-label="Search debugger" placeholder="Search diagnostics" maxLength={120} value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="system-debugger__actions">
        <span>{visible.length} / {entries.length} entries</span>
        <button type="button" onClick={downloadReport} disabled={!entries.length}>Export report</button>
        <button type="button" onClick={clearDiagnostics} disabled={!entries.length}>Clear log</button>
      </div>
      <div className="system-debugger__entries" aria-label="System diagnostics" data-testid="debugger-entries">
        {visible.length ? visible.map((entry) => (
          <details key={entry.id} className={`system-debugger__entry is-${entry.level}`}>
            <summary>
              <span className="system-debugger__entry-meta">
                <time dateTime={new Date(entry.time).toISOString()}>{new Date(entry.time).toLocaleTimeString()}</time>
                <b>{entry.level}</b><span>{entry.source}</span>
                {entry.occurrences > 1 && <span>×{entry.occurrences}</span>}
              </span>
              <span className="system-debugger__message">{entry.message}</span>
            </summary>
            <pre>{entry.detail || entry.message}</pre>
          </details>
        )) : <p className="system-debugger__empty">{entries.length ? 'No diagnostics match these filters.' : 'Listening for system diagnostics.'}</p>}
      </div>
      <span className={`system-debugger__runtime${runtimeError ? ' is-error' : ''}`} data-testid="text-runtime-error">
        {runtimeError || 'Script runtime: no active error.'}
      </span>
      <p className="system-debugger__note">Live browser session · latest {diagnosticLimit} entries{discarded ? ` · ${discarded} older entries discarded` : ''}. Server internals and breakpoints are not included. Review reports before sharing.</p>
    </div>
  );
}
