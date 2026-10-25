import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import type { ScenePreview3DProps } from './scene-preview-3d';
import { buildBasketballWorld, createBasketballSession, stepBasketball, poseBasketballEntities, basketballCamera } from '@/lib/basketball-runtime';
import './basketball-viewport.css';

type World = ReturnType<typeof buildBasketballWorld>;
type State = ReturnType<typeof createBasketballSession>;
type Input = Parameters<typeof stepBasketball>[2];
type BaseCamera = Parameters<typeof basketballCamera>[0];

const STEP = 1 / 60;
const MAX_STEPS = 8;
const HANDLED = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyQ', 'KeyF', 'ShiftLeft', 'ShiftRight']);

const clock = (s: number) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export function BasketballViewport(props: ScenePreview3DProps & { playing: boolean; renderScene: (props: ScenePreview3DProps) => ReactNode }) {
  const { playing, renderScene, ...sceneProps } = props;
  const configKey = useMemo(() => JSON.stringify(sceneProps.entities.map(e => [e.id, e.name,e.active,e.parentId,e.components])), [sceneProps.entities]);
  const entitiesRef = useRef(sceneProps.entities);
  entitiesRef.current = sceneProps.entities;
  const world = useMemo<World>(() => buildBasketballWorld(entitiesRef.current), [configKey]);
  const stateRef = useRef<State | null>(null);
  const [, setTick] = useState(0);
  const held = useRef(new Set<string>());
  const pulses = useRef({ shootReleased: false, pass: false, steal: false, switchPlayer: false });

  const restart = useCallback(() => {
    stateRef.current = createBasketballSession(world);
    pulses.current = { shootReleased: false, pass: false, steal: false, switchPlayer: false };
    setTick(t => t + 1);
  }, [world]);

  // Reset only on play toggle or semantic (non-pose) scene change.
  useEffect(() => {
    stateRef.current = playing ? createBasketballSession(world) : null;
    held.current.clear();
    setTick(t => t + 1);
  }, [playing, world]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (now: number) => {
      acc += Math.min(.25, (now - last) / 1000);
      last = now;
      let steps = 0;
      while (acc >= STEP && steps < MAX_STEPS && stateRef.current) {
        const k = held.current, p = pulses.current;
        const input: Input = {
          x: (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0),
          z: (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0),
          sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
          shootHeld: k.has('Space'),
          shootReleased: p.shootReleased, pass: p.pass, steal: p.steal, switchPlayer: p.switchPlayer,
        };
        pulses.current = { shootReleased: false, pass: false, steal: false, switchPlayer: false };
        stateRef.current = stepBasketball(world, stateRef.current, input, STEP);
        acc -= STEP;
        steps++;
      }
      if (steps >= MAX_STEPS) acc = 0;
      setTick(t => (t + 1) % 1e9);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const clear = () => held.current.clear();
    const vis = () => { if (document.hidden) clear(); };
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', vis);
      clear();
    };
  }, [playing, world]);

  const isEditable = (t: EventTarget | null) => t instanceof HTMLElement && (t.closest('input,textarea,select,button,[contenteditable="true"]') !== null);
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (!playing || isEditable(e.target) || !HANDLED.has(e.code)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.repeat) return;
    held.current.add(e.code);
    if (e.code === 'KeyE') pulses.current.pass = true;
    if (e.code === 'KeyQ') pulses.current.switchPlayer = true;
    if (e.code === 'KeyF') pulses.current.steal = true;
  };
  const onKeyUp = (e: ReactKeyboardEvent) => {
    if (!playing || !HANDLED.has(e.code)) return;
    if (!isEditable(e.target)) { e.preventDefault(); e.stopPropagation(); }
    if (e.code === 'Space' && held.current.has('Space')) pulses.current.shootReleased = true;
    held.current.delete(e.code);
  };

  const baseCamera = (sceneProps.gameCamera ?? sceneProps.primaryCamera) as BaseCamera | undefined;

  if (!playing) {
    if (sceneProps.staticPreview && baseCamera) {
      const cam = basketballCamera(baseCamera, world, createBasketballSession(world));
      return <>{renderScene({ ...sceneProps, gameCamera: cam })}</>;
    }
    return <>{renderScene(sceneProps)}</>;
  }

  const state = stateRef.current ?? createBasketballSession(world);
  const posed = poseBasketballEntities(world, state, sceneProps.entities);
  const cam = baseCamera ? basketballCamera(baseCamera, world, state) : undefined;
  const homePoss = state.holderId ? world.players.find(p => p.id === state.holderId)?.team === 'home' : state.flight?.team === 'home';
  const awayPoss = state.holderId ? world.players.find(p => p.id === state.holderId)?.team === 'away' : state.flight?.team === 'away';
  const controlled = world.players.find(p => p.id === state.controlledId);
  const result = state.homeScore > state.awayScore ? 'You win' : state.homeScore < state.awayScore ? 'You lose' : 'Draw';
  const tap = (k: 'shootReleased' | 'pass' | 'steal' | 'switchPlayer') => () => { pulses.current[k] = true; };

  return (
    <div className="bb-viewport" tabIndex={0} onKeyDown={onKeyDown} onKeyUp={onKeyUp} onBlur={() => held.current.clear()}
      aria-label="3D basketball exhibition. Click to focus, then use keyboard controls." data-testid="viewport-basketball">
      {renderScene({ ...sceneProps, entities: posed, gameView: true, readOnly: true, ...(cam ? { gameCamera: cam } : {}) })}
      <div className="bb-hud" aria-live="polite">
        <div className="bb-score" data-testid="status-basketball-score">
          <div className="bb-team bb-team--home"><i className="bb-poss" data-on={String(!!homePoss)} />{world.homeName}<b>{state.homeScore}</b></div>
          <div className="bb-clock"><b data-testid="text-game-clock">{clock(state.remaining)}</b><span data-testid="text-shot-clock">{Math.ceil(state.shotClock)}</span></div>
          <div className="bb-team bb-team--away"><b>{state.awayScore}</b>{world.awayName}<i className="bb-poss" data-on={String(!!awayPoss)} /></div>
        </div>
        <div className="bb-meter" aria-label="Shot charge" data-testid="meter-shot-charge"><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, state.charge))})` }} /></div>
        {state.message && <div className="bb-message" data-testid="text-game-message">{state.message}</div>}
        {world.errors.length > 0 && <div className="bb-message" data-testid="text-world-errors">{world.errors[0]}</div>}
      </div>
      <div className="bb-controls">
        {state.log.length > 0 && <div className="bb-log" data-testid="text-play-log">{state.log.slice(-3).map((l: string, i: number) => <div key={i}>{l}</div>)}</div>}
        <div className="bb-buttons">
          <button type="button" onClick={tap('shootReleased')} data-testid="button-bb-shoot">Shoot</button>
          <button type="button" onClick={tap('pass')} data-testid="button-bb-pass">Pass</button>
          <button type="button" onClick={tap('steal')} data-testid="button-bb-steal">Steal</button>
          <button type="button" onClick={tap('switchPlayer')} data-testid="button-bb-switch">Switch</button>
          <button type="button" onClick={restart} data-testid="button-bb-restart">Restart</button>
        </div>
        <div className="bb-keys">{controlled ? `#${controlled.number} · ` : ''}WASD move · Shift sprint · Space hold/release shoot · E pass · Q switch · F steal</div>
      </div>
      {state.over && (
        <div className="bb-final" data-testid="panel-final-score">
          <div className="bb-final-card">
            <h3>{result}</h3>
            <p>{world.homeName} {state.homeScore} - {state.awayScore} {world.awayName}</p>
            <button type="button" onClick={restart} data-testid="button-bb-play-again">Play again</button>
          </div>
        </div>
      )}
    </div>
  );
}
