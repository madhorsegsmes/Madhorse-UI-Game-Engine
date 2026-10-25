import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ScenePreview3D } from '../components/scene-preview-3d';
import { PlayerActionHud } from '../components/player-action-hud';
import { isPixelRpgScene } from '../lib/pixel-rpg-runtime';
import {isCardDuelScene} from '../lib/card-duel-runtime';
import { isWebGameData, type WebGameData } from '../lib/web-game-format';
import { normalizeSceneRenderSettings } from '../hooks/use-scene-render-settings';
import { SimulationClock } from '../lib/simulation-clock';
import { playAudioPreview, stopAudioPlayback, unlockSceneAudio } from '../lib/game-audio';
import { getTransform } from '../lib/scene-model';
import type { ActionHud } from '../lib/player-action-runtime';
import { StandaloneSimulation } from './simulation';
import './player.css';

const noop = () => {};
function GameSession({ game, onRestart }: { game: WebGameData; onRestart: () => void }) {
  const [simulation] = useState(() => new StandaloneSimulation(game));
  const [entities, setEntities] = useState(simulation.entities);
  const [camera, setCamera] = useState(simulation.camera);
  const [hud, setHud] = useState<ActionHud | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('Ready. Press Play to begin.');
  const [graphicsFailed, setGraphicsFailed] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const startedAudio = useRef(false);
  const assetUrls = useMemo(() => Object.fromEntries(Object.entries(game.assetFiles).map(([id, path]) =>
    [id, new URL(path, document.baseURI).href])), [game]);
  const renderSettings = useMemo(() => normalizeSceneRenderSettings(game.renderSettings), [game]);
  const perspective = simulation.perspective;
  const showEntities = perspective === 'first-person'
    ? entities.map(entity => entity.id === simulation.state.controlledPlayerId ? { ...entity, active: false } : entity)
    : entities;

  function releaseMouse() { if (document.pointerLockElement === stage.current) document.exitPointerLock(); }
  function captureMouse() {
    if (simulation.perspective !== 'first-person') return;
    try {
      void stage.current?.requestPointerLock()?.catch(() => setStatus('Mouse capture is unavailable. Use arrow keys to look.'));
    } catch { setStatus('Mouse capture is unavailable. Use arrow keys to look.'); }
  }
  function switchView() {
    simulation.togglePerspective();
    if (simulation.perspective === 'first-person') captureMouse(); else releaseMouse();
    setEntities(simulation.entities);
    setCamera(simulation.camera);
  }
  function play() {
    unlockSceneAudio();
    setRunning(true);
    setStatus('Playing. Escape pauses the game.');
    if (!startedAudio.current) {
      startedAudio.current = true;
      for (const entity of simulation.entities) for (const source of entity.components) {
        if (entity.active && source.type === 'gameAudio' && source.enabled && source.playOnStart) {
          void playAudioPreview(source.clipAssetId ? assetUrls[source.clipAssetId] ?? null : null,
            source.volume, source.pitch, 'tone', 'runtime');
        }
      }
    }
  }

  useEffect(() => {
    if (!running) { releaseMouse(); stopAudioPlayback('runtime'); return; }
    const held = new Set<string>();
    const tapped = new Set<string>();
    const clock = new SimulationClock(performance.now());
    const keys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'v', 'escape']);
    for (const entity of game.entities) for (const component of entity.components) {
      if (component.type === 'playerAction' && component.enabled) keys.add(component.key);
      if (component.type === 'gameFeature' && component.enabled && component.kind === 'interact') keys.add(String(component.settings.key));
    }
    let frameId = 0;
    let lastPublish = 0;
    const footsteps = new Map<string, { x: number; y: number; at: number }>();
    const down = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || !keys.has(event.key.toLowerCase())) return;
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable=true]')) return;
      const key = event.key.toLowerCase();
      event.preventDefault();
      if (key === 'escape') { setRunning(false); return; }
      if (key === 'v') { if (!event.repeat) switchView(); return; }
      if (!held.has(key)) tapped.add(key);
      held.add(key);
    };
    const up = (event: KeyboardEvent) => { held.delete(event.key.toLowerCase()); };
    const clear = () => { held.clear(); tapped.clear(); };
    const mouseMove = (event: MouseEvent) => {
      if (simulation.perspective !== 'first-person' || document.pointerLockElement !== stage.current) return;
      simulation.yaw = (simulation.yaw + event.movementX * .14) % 360;
      simulation.pitch = Math.max(-80, Math.min(80, simulation.pitch - event.movementY * .12));
    };
    const mouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || simulation.perspective !== 'first-person' ||
          !(event.target instanceof Element) || !stage.current?.contains(event.target) ||
          event.target.closest('button,summary')) return;
      if (document.pointerLockElement !== stage.current) { captureMouse(); return; }
      if (!held.has(simulation.primaryKey)) tapped.add(simulation.primaryKey);
      held.add(simulation.primaryKey);
    };
    const mouseUp = () => { held.delete(simulation.primaryKey); };
    const hide = () => { clear(); if (document.hidden) setRunning(false); };
    const frame = (now: number) => {
      try {
        const batch = clock.advance(now, document.hidden);
        for (let i = 0; i < batch.steps; i++) {
          const firstPerson = simulation.perspective === 'first-person';
          if (firstPerson) {
            simulation.yaw += (Number(held.has('arrowright')) - Number(held.has('arrowleft'))) * clock.stepSeconds * 90;
            simulation.pitch = Math.max(-80, Math.min(80, simulation.pitch +
              (Number(held.has('arrowup')) - Number(held.has('arrowdown'))) * clock.stepSeconds * 70));
          }
          const result = simulation.step(clock.stepSeconds, {
            moveX: Number(held.has('d') || !firstPerson && held.has('arrowright')) - Number(held.has('a') || !firstPerson && held.has('arrowleft')),
            moveY: Number(held.has('w') || !firstPerson && held.has('arrowup')) - Number(held.has('s') || !firstPerson && held.has('arrowdown')),
            jumpPressed: tapped.has(' '), heldKeys: [...held], pressedKeys: [...tapped],
          });
          tapped.clear();
          for (const event of result.audioEvents) {
            void playAudioPreview(event.clipAssetId ? assetUrls[event.clipAssetId] ?? null : null,
              event.volume, event.pitch, event.action, 'runtime');
          }
          for (const event of result.events) setStatus(event.message);
          for (const entity of simulation.entities) {
            const sound = entity.components.find(component => component.type === 'playerWalkAudio' && component.enabled);
            if (!entity.active || sound?.type !== 'playerWalkAudio') continue;
            const p = getTransform(entity).position;
            const last = footsteps.get(entity.id);
            if (last && Math.hypot(p.x - last.x, p.y - last.y) > .02 && now - last.at >= sound.stepInterval * 1000) {
              void playAudioPreview(sound.clipAssetId ? assetUrls[sound.clipAssetId] ?? null : null,
                sound.volume, sound.pitch, 'footstep', 'runtime');
              footsteps.set(entity.id, { x: p.x, y: p.y, at: now });
            } else footsteps.set(entity.id, { x: p.x, y: p.y, at: last?.at ?? now });
          }
          if (i === batch.steps - 1 && now - lastPublish >= 33) {
            setEntities(simulation.entities); setCamera(simulation.camera); setHud(result.hud); lastPublish = now;
          }
        }
        frameId = requestAnimationFrame(frame);
      } catch (error) {
        setStatus(`Game stopped: ${error instanceof Error ? error.message : 'runtime error'}`);
        setRunning(false);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', hide);
    document.addEventListener('mousemove', mouseMove);
    document.addEventListener('mousedown', mouseDown);
    document.addEventListener('mouseup', mouseUp);
    frameId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(frameId); clear(); releaseMouse(); stopAudioPlayback('runtime');
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', hide);
      document.removeEventListener('mousemove', mouseMove); document.removeEventListener('mousedown', mouseDown);
      document.removeEventListener('mouseup', mouseUp);
    };
  }, [running, simulation, game, assetUrls]);

  return <div className="web-game">
    <header className="web-game-toolbar">
      <strong>{game.name}</strong>
      <span>Standalone · Offline</span>
      <button onClick={() => running ? setRunning(false) : play()} disabled={graphicsFailed}>{running ? 'Pause' : 'Play'}</button>
      <button onClick={onRestart}>Restart</button>
      {(perspective === 'first-person' || perspective === 'third-person') &&
        <button onClick={switchView} disabled={!running}>View: {perspective} · V</button>}
    </header>
    <div className="web-game-stage" ref={stage} data-testid="standalone-game">
      <ScenePreview3D projectName={game.name} entities={showEntities} assets={game.assets} assetUrls={assetUrls} gameRunning={running}
        primaryCamera={camera} gameCamera={camera} gameView readOnly selectedEntityId={null}
        renderSettingsOverride={renderSettings} playerPreviewPosition={{ x: 0, y: 0 }} transformMode="translate"
        onSelectEntity={noop} onTransformCommit={noop} onTransformModeChange={noop}
        onGraphicsUnavailable={failure => { setGraphicsFailed(true); setRunning(false); setStatus(failure.message); }}
        onGraphicsReady={() => { setGraphicsFailed(false); setStatus('Ready. Press Play to begin.'); }} />
      {game.uiControls.map(control => <div key={control.id} className={`web-game-ui is-${control.type}`}
        style={{ left: `${control.x}%`, top: `${control.y}%`, width: control.width, height: control.height,
          background: control.type === 'text' ? 'transparent' : control.color, color: control.type === 'text' ? control.color : '#fff' }}>
        {control.type === 'health-bar' && <progress max={hud?.maxHealth ?? 100} value={hud?.health ?? 100} />}
        {control.type === 'button' ? <button disabled title="This UI button has no gameplay binding">{control.label}</button> : <span>{control.label}</span>}
      </div>)}
      {hud && !isPixelRpgScene(entities) && !isCardDuelScene(entities) && <PlayerActionHud hud={hud} />}
      {running && perspective === 'first-person' && <span className="web-game-crosshair" aria-label="Crosshair">+</span>}
      {!running && !graphicsFailed && <div className="web-game-paused"><div>
        <h1>{game.name}</h1><p>{graphicsFailed ? 'A WebGL-capable browser is needed to play.' : 'Keyboard controls appear in the game HUD. Click the scene for mouse look in first-person mode.'}</p>
        <button onClick={play} disabled={graphicsFailed}>Play</button>
        <details><summary>Build information</summary><ul>{game.limitations.map(item => <li key={item}>{item}</li>)}</ul></details>
      </div></div>}
    </div>
    <footer className="web-game-status" role="status">{status}</footer>
  </div>;
}

function GamePlayer({ game }: { game: WebGameData }) {
  const [session, setSession] = useState(0);
  return <GameSession key={session} game={game} onRestart={() => setSession(value => value + 1)} />;
}

async function boot() {
  const root = createRoot(document.getElementById('root')!);
  try {
    if (location.protocol === 'file:') throw new Error('Serve the extracted folder over HTTP. See README.txt for instructions.');
    const response = await fetch(new URL('game.json', document.baseURI), { cache: 'no-store' });
    if (!response.ok) throw new Error('game.json is missing. Keep the complete extracted game folder together.');
    const text = await response.text();
    if (text.length > 20 * 1024 * 1024) throw new Error('The game scene is too large.');
    const game: unknown = JSON.parse(text);
    if (!isWebGameData(game)) throw new Error('This game file is invalid or uses an unsupported export version.');
    document.title = game.name;
    root.render(<GamePlayer game={game} />);
  } catch (error) {
    root.render(<main className="web-game-error" role="alert"><h1>Unable to load game</h1>
      <p>{error instanceof Error ? error.message : 'Unknown loading error'}</p>
      <p>Extract every file, then serve the folder with a static HTTP server. No Studio account is required.</p></main>);
  }
}
void boot();
