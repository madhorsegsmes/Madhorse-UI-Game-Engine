import type { ActionHud } from '@/lib/player-action-runtime';

export function PlayerActionHud({ hud }: { hud: ActionHud }) {
  const keyHint = (key: string, label: string, active = false) => <span
    key={key} className={`fresh-action-key${active ? ' is-held' : ''}`} data-control-key={key}
  ><span>{label}</span><kbd>{key === ' ' ? 'Space' : key.toUpperCase()}</kbd></span>;
  return <details className="fresh-action-hud" open data-testid="player-action-hud">
    <summary>{hud.player} · {hud.mode}{hud.mode === 'Driving' ? ` · ${hud.speed} km/h` : ''} <small>PC keyboard guide</small></summary>
    <div className="fresh-action-hud-body">
      <div className="fresh-action-hud-keys" aria-label="Move player">
        {keyHint('w', 'Forward')}{keyHint('s', 'Back')}{keyHint('a', 'Left')}{keyHint('d', 'Right')}{keyHint(' ', 'Jump')}
      </div>
      <div className="fresh-action-hud-keys" aria-label="Player actions">
        {hud.controls.map(control => keyHint(control.key, control.label,
          control.action === 'race' && hud.mode === 'Driving' ||
          control.action === 'run' && hud.mode === 'Running' ||
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
      <p role="status" data-testid="action-feedback">{hud.message || 'Use your PC keyboard: W/A/S/D or arrows to move; press an action key.'}</p>
      <small>Test only. Stop or press Esc to restore your saved scene.</small>
    </div>
  </details>;
}
