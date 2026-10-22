import { useEffect, useRef, useState } from 'react';
import { startScriptRuntime, type RuntimeScript } from '@/lib/script-runtime';

export function ScriptRunner({ projectId, scripts }: { projectId: string; scripts: RuntimeScript[] }) {
  const [selectedId, setSelectedId] = useState('');
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('Choose a script to run.');
  const [running, setRunning] = useState(false);
  const handle = useRef<ReturnType<typeof startScriptRuntime> | null>(null);
  const selected = scripts.find((script) => script.id === selectedId) ?? scripts[0];
  const runnable = selected && !/\.(h|hpp)$/i.test(selected.name);
  useEffect(() => {
    handle.current?.stop();
    handle.current = null;
    setRunning(false);
    setOutput('');
    setStatus('Choose a script to run.');
    setSelectedId('');
    return () => handle.current?.stop();
  }, [projectId]);

  function run() {
    if (!selected || running) return;
    setOutput('');
    setRunning(true);
    setStatus(`Starting ${selected.language} sandbox…`);
    handle.current = startScriptRuntime(selected, scripts, (event) => {
      if (event.type === 'output') setOutput((text) => `${text}${event.text}\n`.slice(0, 16000));
      if (event.type === 'phase') setStatus(event.message);
      if (event.type === 'complete') {
        setStatus('Script finished.');
        setRunning(false);
      }
      if (event.type === 'error') {
        setStatus('Script stopped with an error.');
        setOutput((text) => `${text}\n${event.message}`.slice(0, 16000));
        setRunning(false);
      }
    });
  }
  function stop() {
    handle.current?.stop();
    handle.current = null;
    setRunning(false);
    setStatus('Script stopped.');
  }
  return (
    <div className="script-runtime-note">
      <label className="script-run-label" htmlFor="run-script-selection">Script to run</label>
      <select
        id="run-script-selection"
        className="project-dropdown"
        value={selected?.id ?? ''}
        disabled={running || !scripts.length}
        onChange={(event) => setSelectedId(event.target.value)}
      >
        {!scripts.length && <option value="">Import a script first</option>}
        {scripts.map((script) => <option key={script.id} value={script.id}>{script.name} · {script.language}</option>)}
      </select>
      <div className="script-run-actions">
        <button type="button" disabled={!runnable || running} onClick={run}>Run script</button>
        <button type="button" disabled={!running} onClick={stop}>Stop</button>
      </div>
      <span className="script-run-status" role="status">{!runnable && selected ? 'Header file — choose a .c or .cpp source file to run.' : status}</span>
      <pre className="script-console" aria-label="Script output" aria-live="polite">{output || 'Output will appear here.'}</pre>
      <span>Runtimes download only when used. C/C++ and C# need larger downloads and more device memory. Console-only execution, 5-second run limit, no app, device-file, or network access. Game-scene APIs are not connected yet.</span>
    </div>
  );
}
