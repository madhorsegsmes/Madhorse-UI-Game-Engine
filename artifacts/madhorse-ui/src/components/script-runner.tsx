import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { startScriptRuntime, type RuntimeScript } from '@/lib/script-runtime';
import { gameExample, type GamePosition } from '@/lib/game-api';

export type ScriptRunnerHandle = { run: () => void; stop: () => void };
export type ScriptRunnerState = { ready: boolean; running: boolean; status: string; scriptName: string };

export const ScriptRunner = forwardRef<ScriptRunnerHandle, {
  projectId: string; scripts: RuntimeScript[]; position: GamePosition;
  selectedId: string; onSelect: (id: string) => void; onEdit: (id: string, content: string) => void;
  onPosition: (position: GamePosition) => void; onReset: () => void;
  onState?: (state: ScriptRunnerState) => void; onError?: (message: string) => void;
}>(function ScriptRunner({ projectId, scripts, selectedId, onSelect, onEdit, position, onPosition, onReset, onState, onError }, ref) {
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('Choose a script to run.');
  const [running, setRunning] = useState(false);
  const handle = useRef<ReturnType<typeof startScriptRuntime> | null>(null);
  const selected = scripts.find((script) => script.id === selectedId) ?? scripts[0];
  const runnable = selected && !/\.(h|hpp)$/i.test(selected.name);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    handle.current?.stop();
    handle.current = null;
    setRunning(false);
    setOutput('');
    setStatus('Choose a script to run.');
    return () => handle.current?.stop();
  }, [projectId]);

  function run() {
    if (!selected || !runnable || running) return;
    setOutput('');
    onErrorRef.current?.('');
    setRunning(true);
    setStatus(`Starting ${selected.language} sandbox…`);
    handle.current = startScriptRuntime(selected, scripts, (event) => {
      if (event.type === 'game') onPosition(event.position);
      if (event.type === 'output') setOutput((text) => `${text}${event.text}\n`.slice(0, 16000));
      if (event.type === 'phase') setStatus(event.message);
      if (event.type === 'complete') {
        setStatus('Script finished.');
        setRunning(false);
      }
      if (event.type === 'error') {
        setStatus('Script stopped with an error.');
        setOutput((text) => `${text}\n${event.message}`.slice(0, 16000));
        onErrorRef.current?.(event.message);
        setRunning(false);
      }
    }, position);
  }
  function stop() {
    handle.current?.stop();
    handle.current = null;
    setRunning(false);
    setStatus('Script stopped.');
  }
  const runRef = useRef(run);
  runRef.current = run;
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useImperativeHandle(ref, () => ({ run: () => runRef.current(), stop: () => stopRef.current() }), []);
  const shownStatus = !runnable && selected ? 'Header file — choose a .c or .cpp source file to run.' : status;
  useEffect(() => {
    onStateRef.current?.({ ready: Boolean(runnable), running, status: shownStatus, scriptName: selected?.name ?? '' });
  }, [runnable, running, shownStatus, selected?.name]);
  return (
    <div className="script-runtime-note">
      <label className="script-run-label" htmlFor="run-script-selection">Script to run</label>
      <select
        id="run-script-selection"
        className="project-dropdown"
        value={selected?.id ?? ''}
        disabled={running || !scripts.length}
        onChange={(event) => onSelect(event.target.value)}
      >
        {!scripts.length && <option value="">Create or import a script first</option>}
        {scripts.map((script) => <option key={script.id} value={script.id}>{script.name} · {script.language}</option>)}
      </select>
      {selected && (
        <div className="script-source-editor">
          <label className="script-run-label" htmlFor="script-source">Source — {selected.name}</label>
          <textarea
            id="script-source"
            className="script-source"
            aria-describedby="script-source-help"
            value={selected.content}
            onChange={(event) => onEdit(selected.id, event.target.value)}
            disabled={running}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
          />
          <small id="script-source-help">Edits save as project data in this browser. Run executes the saved source in isolation. Stop before editing. Limits: 256 KB per script, 1 MB per project.</small>
        </div>
      )}
      <div className="script-run-actions">
        <button type="button" disabled={!runnable || running} onClick={run}>Run script</button>
        <button type="button" disabled={!running} onClick={stop}>Stop</button>
        <button type="button" disabled={running} onClick={onReset}>Reset scene</button>
      </div>
      <span className="script-run-status" role="status">{shownStatus}</span>
      <pre className="script-console" aria-label="Script output" aria-live="polite">{output || 'Output will appear here.'}</pre>
      <details className="game-api-help">
        <summary>Move the player with a script</summary>
        <span>Print one MADHORSE_GAME JSON command per line. Use exactly version, object, action, x and y as shown. Only object "player" is available. Coordinates run from 0–100: x increases right, y increases down.</span>
        <pre aria-label="Game API example">{gameExample(selected?.language ?? 'JavaScript')}</pre>
        <span>Use "setPosition" for absolute coordinates, or "move" for x/y offsets (negative offsets allowed). Out-of-bounds, unknown or malformed commands stop the run. Maximum 128 commands per run, within the output limit. Commands apply in order; Stop or errors keep the last valid position. C# applies buffered commands when execution returns.</span>
        <span>This is a preview, not saved project data. Reset scene returns to (50, 50). Switching projects or reloading resets it. Scripts do not run automatically.</span>
      </details>
      <span>Runtimes download only when used. C/C++ and C# need larger downloads and more device memory. 5-second run limit; no app, device-file, or network access.</span>
    </div>
  );
});
