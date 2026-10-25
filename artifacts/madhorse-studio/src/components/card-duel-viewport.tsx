import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ScenePreview3DProps } from './scene-preview-3d';
import {
  buildDuelWorld, createDuelSession, duelAction, playRivalTurn,
  type DuelAction, type DuelCard, type DuelInstance, type DuelMonster, type DuelSide, type DuelState, type DuelWorld,
} from '@/lib/card-duel-runtime';
import { duelArtDataUri } from '@/lib/card-duel-art';
import './card-duel-viewport.css';

const SPELL_ART: Record<DuelCard['effect'], string> = {
  none: 'spark', heal: 'heal', damage: 'spark', destroy: 'shatter', shield: 'ward', boost: 'boost', draw: 'draw',
};
const MONSTER_ART = ['dragon', 'golem', 'mage', 'wolf', 'knight', 'phoenix'];

function fallbackKind(card: DuelCard) {
  if (card.type === 'trap') return 'ward';
  if (card.type === 'spell') return SPELL_ART[card.effect];
  const n = card.name.toLowerCase();
  const hit = MONSTER_ART.find(k => n.includes(k));
  if (hit) return hit;
  let h = 0; for (const ch of card.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return MONSTER_ART[h % MONSTER_ART.length];
}

function tributesFor(level: number) { return level >= 7 ? 2 : level >= 5 ? 1 : 0; }

type ArtFn = (card: DuelCard) => string;

function CardFace({ card, art, onBad, monster, small, selected, onClick, testId, faceDown, label }: {
  card?: DuelCard; art: ArtFn; onBad: (url: string) => void; monster?: DuelMonster; small?: boolean; selected?: boolean;
  onClick?: () => void; testId: string; faceDown?: boolean; label?: string;
}) {
  const cls = ['cdv-card', small ? 'is-small' : '', selected ? 'is-selected' : '', faceDown ? 'is-back' : '',
    card ? `is-${card.type}` : '', monster?.position === 'defense' ? 'is-defense' : '', monster?.attacked ? 'is-spent' : ''].join(' ');
  const inner = faceDown || !card
    ? <span className="cdv-back-sigil" aria-hidden />
    : <>
      <span className="cdv-card-name">{card.name}</span>
      <span className="cdv-card-art"><img src={art(card)} alt="" draggable={false} onError={e => onBad(e.currentTarget.getAttribute('src') ?? '')} /></span>
      {card.type === 'monster'
        ? <span className="cdv-card-stats">
          <span className="cdv-lv">{'\u2605'}{card.level}</span>
          <span>{card.attack + (monster?.bonusAttack ?? 0)}<i>/</i>{card.defense}</span>
        </span>
        : <span className="cdv-card-stats"><span className="cdv-kind">{card.type}</span><span>{card.effect !== 'none' ? `${card.effect} ${card.power || ''}` : ''}</span></span>}
    </>;
  const color=!faceDown&&card&&/^#[0-9a-f]{6}$/i.test(card.color)?card.color:null;
  const style=color?{background:`linear-gradient(155deg, #ffffff99, ${color} 55%, #ffffff55), ${color}`}:undefined;
  return onClick
    ? <button type="button" className={cls} style={style} onClick={onClick} data-testid={testId} aria-label={label ?? card?.name ?? 'card'} aria-pressed={selected}>{inner}</button>
    : <div className={cls} style={style} data-testid={testId} aria-label={label ?? card?.name}>{inner}</div>;
}

export function CardDuelViewport(props: ScenePreview3DProps & { playing: boolean }) {
  const { entities, assetUrls, playing, staticPreview, onGraphicsReady, onSelectEntity, selectedEntityId } = props;
  const worldKey = useMemo(() => JSON.stringify(entities.map(e => [e.id, e.name, e.active, e.parentId, e.components])), [entities]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const world: DuelWorld = useMemo(() => buildDuelWorld(entities), [worldKey]);
  const [state, setState] = useState<DuelState>(() => createDuelSession(world));
  const [handSel, setHandSel] = useState<number | null>(null);
  const [own, setOwn] = useState<number[]>([]);
  const [enemy, setEnemy] = useState<number | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const ready = useRef(onGraphicsReady); ready.current = onGraphicsReady;
  const interactive = playing && !staticPreview;

  const clearSel = () => { setHandSel(null); setOwn([]); setEnemy(null); };
  useEffect(() => { setState(createDuelSession(world)); clearSel(); setInspect(null); }, [world, playing]);
  useEffect(() => { ready.current?.(); }, []);
  useEffect(() => {
    const el = host.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setCompact(e.contentRect.width < 760 || e.contentRect.height < 460));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!interactive || state.turn !== 'rival' || state.winner || world.errors.length) return;
    const t = window.setTimeout(() => setState(s => playRivalTurn(world, s)), 650);
    return () => window.clearTimeout(t);
  }, [interactive, state, world]);

  const [badUrls, setBadUrls] = useState<Set<string>>(() => new Set());
  const markBad = (url: string) => { if (!url.startsWith('data:')) setBadUrls(s => (s.has(url) ? s : new Set(s).add(url))); };
  const art: ArtFn = card => {
    const url = card.artAssetId ? assetUrls[card.artAssetId] : undefined;
    return url && !badUrls.has(url) ? url : duelArtDataUri(fallbackKind(card), card.color);
  };
  const boardUrl = world.boardArtAssetId ? assetUrls[world.boardArtAssetId] : undefined;
  const boardImg = boardUrl && !badUrls.has(boardUrl) ? boardUrl : null;
  const boardColor = /^#[0-9a-f]{3,8}$/i.test(world.boardColor) ? world.boardColor : undefined;
  const cardOf = (i?: DuelInstance | null) => (i ? world.cards[i.cardId] : undefined);
  const myTurn = interactive && state.turn === 'player' && !state.winner && !world.errors.length;
  const p = state.player, r = state.rival;
  const handCard = handSel !== null ? cardOf(p.hand[handSel]) : undefined;
  const enemyEmpty = r.field.every(m => !m);
  const firstTurnNoAttack = state.turnNumber <= 1;

  const run = (action: DuelAction) => {
    if (!myTurn) return;
    setState(s => duelAction(world, s, action));
    clearSel();
  };

  const select = (cardId?: string) => {
    if (!cardId) return;
    setInspect(cardId);
    if (!playing && !staticPreview) onSelectEntity(cardId);
  };

  const needTrib = handCard?.type === 'monster' ? tributesFor(handCard.level) : 0;
  const canSummon = myTurn && state.phase === 'main' && handCard?.type === 'monster' && !p.summoned
    && (needTrib === 0 ? p.field.some(m => !m) : own.length === needTrib || (own.length === 0 && p.field.filter(Boolean).length >= needTrib));
  const summon = (position: 'attack' | 'defense') => handSel !== null &&
    run({ type: 'summon', hand: handSel, position, ...(needTrib && own.length ? { tributes: own.slice(0, needTrib) } : {}) });
  const castSpell = () => {
    if (handSel === null || !handCard) return;
    const target = handCard.effect === 'destroy' ? enemy ?? undefined : handCard.effect === 'boost' ? own[0] : undefined;
    run({ type: 'spell', hand: handSel, ...(target !== undefined ? { target } : {}) });
  };
  const attacker = own[0];
  const attackerMon = attacker !== undefined ? p.field[attacker] : null;
  const canAttack = myTurn && state.phase === 'battle' && !!attackerMon && attackerMon.position === 'attack' && !attackerMon.attacked && !firstTurnNoAttack;

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (!interactive || t.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (e.key === 'Escape') { clearSel(); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === 'Enter' && t === e.currentTarget && myTurn) { run({ type: 'end-turn' }); e.preventDefault(); e.stopPropagation(); }
    else if (/^[1-6]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (i < p.hand.length) { setHandSel(h => (h === i ? null : i)); setOwn([]); select(p.hand[i].cardId); e.preventDefault(); e.stopPropagation(); }
    }
  };

  const clickOwn = (slot: number, m: DuelMonster | null) => {
    if (!m) return;
    select(m.instance.cardId);
    if (!interactive) return;
    if (state.phase === 'battle') setOwn(o => (o[0] === slot ? [] : [slot]));
    else setOwn(o => (o.includes(slot) ? o.filter(x => x !== slot) : [...o, slot].slice(-2)));
  };
  const clickEnemy = (slot: number, m: DuelMonster | null) => {
    if (!m) return;
    select(m.instance.cardId);
    if (!interactive) return;
    if (canAttack && attacker !== undefined) run({ type: 'attack', slot: attacker, target: slot });
    else setEnemy(e => (e === slot ? null : slot));
  };

  const life = (side: DuelSide) => Math.max(0, Math.min(100, (side.life / Math.max(1, world.startingLife)) * 100));
  const inspected = inspect ? world.cards[inspect] : handCard;
  const showRivalHand = false; // rival hand is always hidden

  const renderRow = (side: DuelSide, who: 'player' | 'rival') => (
    <>
      <div className={`cdv-row cdv-monsters cdv-${who}`}>
        {side.field.map((m, i) => (
          <div key={i} className="cdv-zone" data-testid={`zone-${who}-monster-${i}`}>
            {m && <CardFace card={cardOf(m.instance)} art={art} onBad={markBad} monster={m} small={compact}
              selected={who === 'player' ? own.includes(i) : enemy === i || selectedEntityId === m.instance.cardId}
              onClick={staticPreview ? undefined : () => (who === 'player' ? clickOwn(i, m) : clickEnemy(i, m))}
              testId={`card-${who}-field-${i}`} />}
          </div>))}
      </div>
      <div className={`cdv-row cdv-traps cdv-${who}`}>
        {side.traps.map((t, i) => (
          <div key={i} className="cdv-zone is-trap" data-testid={`zone-${who}-trap-${i}`}>
            {t && <CardFace card={cardOf(t.instance)} art={art} onBad={markBad} small faceDown={who === 'rival' || staticPreview}
              onClick={who === 'player' && !staticPreview ? () => select(t.instance.cardId) : undefined}
              label={who === 'rival' ? 'Set trap' : undefined} testId={`card-${who}-trap-${i}`} />}
          </div>))}
      </div>
    </>
  );

  const lifeBar = (side: DuelSide, who: 'player' | 'rival', name: string) => (
    <div className={`cdv-life cdv-life-${who} ${state.turn === who && !state.winner ? 'is-active' : ''}`}>
      <span className="cdv-life-name" data-testid={`text-${who}-name`}>{name}</span>
      <span className="cdv-life-track"><span style={{ transform: `scaleX(${life(side) / 100})` }} /></span>
      <span className="cdv-life-num" data-testid={`text-${who}-life`}>{side.life}</span>
      <span className="cdv-pile" title="Deck">{side.deck.length}</span>
    </div>
  );

  return (
    <div ref={host} tabIndex={staticPreview ? -1 : 0} onKeyDown={onKey} data-testid="card-duel-viewport"
      className={`cdv ${compact ? 'is-compact' : ''} ${staticPreview ? 'is-static' : ''} ${interactive ? 'is-playing' : 'is-editing'}`}>
      <div className="cdv-table" style={boardColor ? { ['--cdv-felt' as string]: boardColor } : undefined} data-testid="duel-table">
        {boardImg && <img className="cdv-board-art" src={boardImg} alt="" draggable={false} onError={() => markBad(boardImg)} data-testid="img-duel-board" />}
        {lifeBar(r, 'rival', world.rivalName)}
        <div className="cdv-hand cdv-hand-rival" aria-label="Rival hand">
          {r.hand.map((c, i) => <CardFace key={c.uid} card={showRivalHand ? cardOf(c) : undefined} art={art} onBad={markBad} small faceDown testId={`card-rival-hand-${i}`} label="Hidden card" />)}
        </div>
        <div className="cdv-field">
          {renderRow(r, 'rival')}
          <div className="cdv-midline">
            <span className="cdv-phase" data-testid="text-phase">{state.winner ? (state.winner === 'player' ? 'Victory' : 'Defeat') : `${state.turn === 'player' ? 'Your' : 'Rival'} ${state.phase} \u00b7 T${state.turnNumber}`}</span>
          </div>
          {renderRow(p, 'player')}
        </div>
        {lifeBar(p, 'player', world.playerName)}
        <div className="cdv-hand cdv-hand-player">
          {p.hand.map((c, i) => <CardFace key={c.uid} card={cardOf(c)} art={art} onBad={markBad} small={compact || staticPreview}
            selected={handSel === i || (!playing && selectedEntityId === c.cardId)}
            onClick={staticPreview ? undefined : () => { select(c.cardId); if (interactive) { setHandSel(h => (h === i ? null : i)); setOwn([]); } }}
            testId={`card-player-hand-${i}`} />)}
        </div>
      </div>

      {!staticPreview && (
        <aside className="cdv-side">
          {world.errors.length > 0 && <div className="cdv-errors" data-testid="text-duel-errors">{world.errors.map((e, i) => <p key={i}>{e}</p>)}</div>}
          <div className="cdv-detail" data-testid="panel-card-detail">
            {inspected ? <>
              <img src={art(inspected)} alt="" onError={e => markBad(e.currentTarget.getAttribute('src') ?? '')} />
              <div>
                <strong>{inspected.name}</strong>
                <em>{inspected.type}{inspected.type === 'monster' ? ` \u00b7 Lv ${inspected.level} \u00b7 ${inspected.attack}/${inspected.defense}` : ` \u00b7 ${inspected.effect}${inspected.power ? ` ${inspected.power}` : ''}`}</em>
                <p>{inspected.description || 'No card text.'}</p>
              </div>
            </> : <p className="cdv-hint">Select a card to read it.</p>}
          </div>

          {interactive ? (
            <div className="cdv-controls">
              <p className="cdv-msg" data-testid="text-duel-message">{state.message}</p>
              {state.phase === 'main' && <div className="cdv-btns">
                <button type="button" disabled={!canSummon} onClick={() => summon('attack')} data-testid="button-summon-attack">Summon ATK{needTrib ? ` (${needTrib} tribute)` : ''}</button>
                <button type="button" disabled={!canSummon} onClick={() => summon('defense')} data-testid="button-summon-defense">Set DEF</button>
                <button type="button" disabled={!myTurn || handCard?.type !== 'spell'} onClick={castSpell} data-testid="button-cast-spell">Cast spell</button>
                <button type="button" disabled={!myTurn || handCard?.type !== 'trap' || !p.traps.some(t => !t)} onClick={() => handSel !== null && run({ type: 'set-trap', hand: handSel })} data-testid="button-set-trap">Set trap</button>
                <button type="button" disabled={!myTurn || own.length !== 1 || !p.field[own[0]]} onClick={() => run({ type: 'position', slot: own[0] })} data-testid="button-change-position">Flip position</button>
                <button type="button" disabled={!myTurn || firstTurnNoAttack} onClick={() => run({ type: 'battle' })} data-testid="button-battle">Battle</button>
              </div>}
              {state.phase === 'battle' && <div className="cdv-btns">
                <button type="button" disabled={!canAttack || enemy === null || !r.field[enemy]} onClick={() => attacker !== undefined && enemy !== null && run({ type: 'attack', slot: attacker, target: enemy })} data-testid="button-attack">Attack target</button>
                {enemyEmpty && <button type="button" disabled={!canAttack} onClick={() => attacker !== undefined && run({ type: 'attack', slot: attacker })} data-testid="button-attack-direct">Attack directly</button>}
              </div>}
              <div className="cdv-btns">
                <button type="button" className="is-primary" disabled={!myTurn} onClick={() => run({ type: 'end-turn' })} data-testid="button-end-turn">End turn <kbd>Enter</kbd></button>
                <button type="button" disabled={handSel === null && !own.length && enemy === null} onClick={clearSel} data-testid="button-clear-selection">Clear <kbd>Esc</kbd></button>
                <button type="button" className="is-test" onClick={() => { setState(createDuelSession(world)); clearSel(); }} data-testid="button-restart-duel">Restart test</button>
              </div>
              {!compact && <ol className="cdv-log" data-testid="list-duel-log">{state.log.slice(-5).reverse().map((l, i) => <li key={i}>{l}</li>)}</ol>}
              {!compact && <p className="cdv-rules">1 summon/turn · Lv5-6 needs 1 tribute, Lv7+ 2 (click your monsters) · each monster attacks once · no attacks turn 1 · traps cancel next attack · keys 1-6 select hand.</p>}
            </div>
          ) : (
            <div className="cdv-controls">
              <p className="cdv-msg">Authoring preview. Click a card to select its source entity. Press Play / Test to duel the AI.</p>
            </div>
          )}
        </aside>
      )}
      {state.winner && interactive && <div className="cdv-banner" data-testid="text-duel-winner">{state.winner === 'player' ? 'Victory' : 'Defeat'}</div>}
    </div>
  );
}
