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
      </div>
      {hud.controls.some(control => control.action === 'craft' || control.action === 'build') &&
        <p data-testid="action-inventory">Wood: {hud.wood} · Planks: {hud.planks}</p>}
      <p role="status" data-testid="action-feedback">{hud.message || 'Use your PC keyboard: W/A/S/D or arrows to move; press an action key.'}</p>
      <small>Test only. Stop or press Esc to restore your saved scene.</small>
    </div>
  </details>;
}
