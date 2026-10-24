import type { ActionHud } from '@/lib/player-action-runtime';

export function PlayerActionHud({ hud }: { hud: ActionHud }) {
  const keyHint = (key: string, label: string, active = false) => <span
    key={key} className={`fresh-action-key${active ? ' is-held' : ''}`} data-control-key={key}
  ><span>{label}</span><kbd>{key === ' ' ? 'Space' : key.toUpperCase()}</kbd></span>;
  return <details className="fresh-action-hud" open data-testid="player-action-hud">
    <summary>{hud.player} · {hud.mode}{hud.mode === 'Driving' ? ` · ${hud.speed} km/h` : ''} <small>PC keyboard guide</small></summary>
    <div className="fresh-action-hud-body">
      {hud.showFightingHud && <section className="fresh-fight-match" aria-label="Fighting match status" data-testid="fight-match-hud">
        <header>{hud.matchStatus}</header>
        <div className="fresh-fight-health-row">
          <div>
            <span>{hud.player} · {hud.health}/{hud.maxHealth}</span>
            <div role="progressbar" aria-label="Player health" aria-valuemin={0} aria-valuemax={hud.maxHealth}
              aria-valuenow={hud.health} className="fresh-fight-health-track is-player">
              <i style={{ width: `${Math.max(0, Math.min(100, hud.health / hud.maxHealth * 100))}%` }} />
            </div>
          </div>
          <strong aria-hidden="true">VS</strong>
          <div>
            <span>{hud.opponentName} · {hud.opponentHealth}/{hud.opponentMaxHealth}</span>
            <div role="progressbar" aria-label={`${hud.opponentName} health`} aria-valuemin={0} aria-valuemax={hud.opponentMaxHealth}
              aria-valuenow={hud.opponentHealth} className="fresh-fight-health-track is-rival">
              <i style={{ width: `${Math.max(0, Math.min(100, hud.opponentHealth / hud.opponentMaxHealth * 100))}%` }} />
            </div>
          </div>
        </div>
        <div className="fresh-fight-meter-row">
          <span>SPECIAL</span>
          <div role="progressbar" aria-label="Special meter" aria-valuemin={0} aria-valuemax={hud.maxSpecialMeter}
            aria-valuenow={hud.specialMeter} className="fresh-fight-meter">
            <i style={{ width: `${Math.max(0, Math.min(100, hud.specialMeter / hud.maxSpecialMeter * 100))}%` }} />
          </div>
          <b>{hud.comboCount > 1 ? `${hud.comboCount} HIT COMBO` : 'F / J / K MOVES'}</b>
        </div>
      </section>}
      <div className="fresh-action-hud-keys" aria-label="Move player">
        {hud.showFightingHud
          ? <>{keyHint('a', 'Left')}{keyHint('d', 'Right')}{keyHint(' ', 'Jump')}</>
          : <>{keyHint('w', 'Forward')}{keyHint('s', 'Back')}{keyHint('a', 'Left')}{keyHint('d', 'Right')}{keyHint(' ', 'Jump')}</>}
      </div>
      <div className="fresh-action-hud-keys" aria-label="Player actions">
        {hud.controls.map(control => keyHint(control.key, control.label,
          control.action === 'race' && hud.mode === 'Driving' ||
          control.action === 'run' && hud.mode === 'Running' ||
          control.action === 'block' && hud.mode === 'Blocking' ||
          control.action === 'crouch' && hud.mode === 'Crouching',
        ))}
        {hud.extraControls.map(control => keyHint(control.key, control.label))}
      </div>
      {hud.showHealth && <div className="fresh-action-health">
        <span>Health: {hud.health}/{hud.maxHealth}</span>
        <div role="progressbar" aria-label="Player health" aria-valuemin={0} aria-valuemax={hud.maxHealth}
          aria-valuenow={hud.health} className="fresh-action-health-track">
          <span style={{ width: `${Math.max(0, Math.min(100, hud.health / hud.maxHealth * 100))}%` }} />
        </div>
      </div>}
      {hud.showInventory && <p data-testid="action-inventory">{hud.inventoryText}</p>}
      {hud.resourceText && <p data-testid="action-resources">{hud.resourceText}</p>}
      <p role="status" data-testid="action-feedback">{hud.message || 'Use your PC keyboard: W/A/S/D or arrows to move; press an action key.'}</p>
      <small>Test only. Stop or press Esc to restore your saved scene.</small>
    </div>
  </details>;
}
