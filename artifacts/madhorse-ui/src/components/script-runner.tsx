import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { startScriptRuntime, type RuntimeScript } from '@/lib/script-runtime';
import { gameExample, type GamePosition } from '@/lib/game-api';
import { beginSystemActivity } from '@/lib/system-activity';
import { getScriptComponent, getWorldTransform, type SceneEntity } from '@/lib/scene-model';
import { publishDiagnostic } from '@/lib/system-diagnostics';

export type ScriptRunnerHandle = { run: () => void; stop: () => void };
export type ScriptRunnerState = { ready: boolean; running: boolean; status: string; scriptName: string };

export const ScriptRunner = forwardRef<ScriptRunnerHandle, {
  projectId: string; scripts: RuntimeScript[]; entities: SceneEntity[]; position: GamePosition;
  selectedId: string; onSelect: (id: string) => void; onEdit: (id: string, content: string) => void;
  onEntityPosition: (entityId: string, position: GamePosition) => void; onReset: () => void;
  onState?: (state: ScriptRunnerState) => void; onError?: (message: string) => void;
}>(function ScriptRunner({ projectId, scripts, entities, selectedId, onSelect, onEdit, position, onEntityPosition, onReset, onState, onError }, ref) {
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('Choose a script to run.');
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running || !/starting|loading|compiling|preparing|initializ/i.test(status)) return;
    return beginSystemActivity('Loading script runtime');
  }, [running, status]);
  const handle = useRef<ReturnType<typeof startScriptRuntime> | null>(null);
  const queue = useRef<{
    script: RuntimeScript;
    entityId: string;
    entityName: string;
    position: GamePosition;
    assigned: boolean;
  }[]>([]);
  const selected = scripts.find((script) => script.id === selectedId) ?? scripts[0];
  const assigned = entities.flatMap((entity) => {
    const assignment = getScriptComponent(entity);
    return entity.active && assignment?.enabled ? [{ entity, assignment }] : [];
  });
  const assignedTargets = assigned.map(({ entity, assignment }) => ({
    entity,
    script: scripts.find((script) => script.id === assignment.scriptId),
  }));
  const hasAssignments = assignedTargets.length > 0;
  const assignedScriptsReady = hasAssignments && assignedTargets.every(({ script }) =>
    script && !/\.(h|hpp)$/i.test(script.name));
  const selectedRunnable = selected && !/\.(h|hpp)$/i.test(selected.name);
  const runnable = hasAssignments ? assignedScriptsReady : selectedRunnable;
  const assignmentIssue = hasAssignments && !assignedScriptsReady
    ? 'An assigned script is missing or is a header file. Choose a runnable script for each active object.'
    : '';
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    handle.current?.stop();
    handle.current = null;
    queue.current = [];
    setRunning(false);
    setOutput('');
    setStatus('Choose a script to run.');
    return () => handle.current?.stop();
  }, [projectId]);

  function startNext(targetCount: number) {
    const target = queue.current.shift();
    if (!target) {
      setStatus(targetCount > 1 ? 'Assigned scripts finished.' : 'Script finished.');
      setRunning(false);
      handle.current = null;
      return;
    }
    setStatus(`Starting ${target.script.language} sandbox${target.assigned ? ` for ${target.entityName}` : ''}…`);
    handle.current = startScriptRuntime(target.script, scripts, (event) => {
      if (event.type === 'game' && event.entityId === target.entityId) {
        onEntityPosition(target.entityId, event.position);
      }
      if (event.type === 'output') {
        setOutput((text) => `${text}${event.text}\n`.slice(0, 16000));
        publishDiagnostic('script', 'info', event.text, `${target.script.name} · ${target.entityName}`);
      }
      if (event.type === 'phase') setStatus(target.assigned ? `${target.entityName}: ${event.message}` : event.message);
      if (event.type === 'complete') {
        publishDiagnostic('script', 'info', `Finished ${target.script.name}`, target.entityName);
        handle.current = null;
        startNext(targetCount);
      }
      if (event.type === 'error') {
        const message = target.assigned
          ? `${target.entityName} (${target.script.name}): ${event.message}`
          : event.message;
        queue.current = [];
        handle.current = null;
        setStatus('Script stopped with an error.');
        setOutput((text) => `${text}\n${message}`.slice(0, 16000));
        onErrorRef.current?.(message);
        publishDiagnostic('script', 'error', message, `${target.script.name} · ${target.entityName}\n${event.message}`);
        setRunning(false);
      }
    }, target.position, target.entityId);
  }
  function run() {
    if (!runnable || running) return;
    queue.current = hasAssignments
      ? assignedTargets.map(({ entity, script }) => {
          const world = getWorldTransform(entities, entity.id);
          return {
            script: script!,
            entityId: entity.id,
            entityName: entity.name,
            position: world ? { x: world.position.x, y: world.position.y } : { ...position },
            assigned: true,
          };
        })
      : selected
        ? [{ script: selected, entityId: 'player', entityName: 'Player', position: { ...position }, assigned: false }]
        : [];
    if (!queue.current.length) return;
    setOutput('');
    onErrorRef.current?.('');
    setRunning(true);
    publishDiagnostic('script', 'info', 'Starting isolated script execution.');
    startNext(queue.current.length);
  }
  function stop() {
    queue.current = [];
    handle.current?.stop();
    handle.current = null;
    setRunning(false);
    setStatus('Script stopped.');
    publishDiagnostic('script', 'info', 'Script execution stopped.');
  }
  const runRef = useRef(run);
  runRef.current = run;
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useImperativeHandle(ref, () => ({ run: () => runRef.current(), stop: () => stopRef.current() }), []);
  const shownStatus = assignmentIssue || (!runnable && selected && !hasAssignments
    ? 'Header file — choose a .c or .cpp source file to run.'
    : status);
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
        <button type="button" disabled={!runnable || running} onClick={run}>
          {hasAssignments ? 'Run assigned scripts' : 'Run script'}
        </button>
        <button type="button" disabled={!running} onClick={stop}>Stop</button>
        <button type="button" disabled={running} onClick={onReset}>Reset scene</button>
      </div>
      <span className="script-run-status" role="status">{shownStatus}</span>
      <pre className="script-console" aria-label="Script output" aria-live="polite">{output || 'Output will appear here.'}</pre>
      <details className="game-api-help">
        <summary>Move an object with a script</summary>
        <span>Print one MADHORSE_GAME JSON command per line. Use exactly version, object, action, x and y as shown. The object "self" is limited to the script's assigned object. Coordinates run from 0–100: x increases right, y increases down.</span>
        <pre aria-label="Game API example">{gameExample(selected?.language ?? 'JavaScript')}</pre>
        <span>Use "setPosition" for absolute coordinates, or "move" for x/y offsets (negative offsets allowed). Out-of-bounds, unknown or malformed commands stop the run. Maximum 128 commands per script, within the output limit. Commands apply in order; Stop or errors keep the last valid position. C# applies buffered commands when execution returns.</span>
        <span>Run executes every active object's assigned script in isolation, one at a time. If no active object has a script assigned, Run executes the selected script on Player. This is a preview, not saved project data; Reset scene or reloading restores saved transforms. Scripts do not run automatically.</span>
      </details>
      <span>Runtimes download only when used. C/C++ and C# need larger downloads and more device memory. 5-second run limit; no app, device-file, or network access.</span>
    </div>
  );
});
