import { useState } from 'react';
import { Compass, Crosshair, Globe2, Puzzle, Swords, X } from 'lucide-react';
import { gameStarterKits, type GameStarterKitId } from '@/lib/scene-starter-kits';
import { defaultFightingAppearancePair, type FightingAppearancePair } from '@/lib/fighter-appearance';
import { FightingCharacterCustomization } from './fighting-character-customization';

const icons: Record<GameStarterKitId, typeof Crosshair> = {
  basketball:Globe2,
  blank:Compass,
  shooter: Crosshair,
  'third-person-shooter': Crosshair,
  mmorpg: Globe2,
  'pixel-rpg': Compass,
  'cart-racer': Compass,
  'card-duel': Compass,
  rpg: Swords,
  puzzle: Puzzle,
  fighting: Swords,
  rts: Compass,
};

export function GameStarterKitDialog({ onAdd, onClose }: {
  onAdd: (kit: GameStarterKitId, appearances?: FightingAppearancePair) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<GameStarterKitId>('shooter');
  const [appearances, setAppearances] = useState<FightingAppearancePair>(() => ({
    player: { ...defaultFightingAppearancePair.player },
    rival: { ...defaultFightingAppearancePair.rival },
  }));
  return (
    <div className="fresh-game-tools-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="fresh-starter-kit-dialog" role="dialog" aria-modal="true" aria-label="Scene starter kits" data-testid="starter-kit-dialog">
        <header className="fresh-game-tools-heading">
          <div><small>READY-TO-EDIT GAME SCENES</small><h2>Scene Starter Kits</h2></div>
          <button type="button" aria-label="Close starter kits" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="fresh-starter-kit-list">
          {gameStarterKits.map(kit => {
            const Icon = icons[kit.id];
            return (
              <button type="button" key={kit.id} className="fresh-starter-kit-card"
                aria-pressed={selected === kit.id} data-active={selected === kit.id}
                data-testid={`starter-kit-${kit.id}`} onClick={() => setSelected(kit.id)}>
                <Icon size={18} aria-hidden="true" />
                <span><strong>{kit.title}</strong><small>{kit.description}</small></span>
              </button>
            );
          })}
        </div>
        <p className="fresh-starter-kit-note">Starter kits add objects and settings to the current scene. Your saved objects stay in place. Edit or delete any part after adding.</p>
        {selected === 'fighting' && <FightingCharacterCustomization value={appearances} onChange={setAppearances} />}
        <div className="fresh-storyboard-footer">
          <span>Scene data stays in this browser and is editable.</span>
          <button type="button" className="fresh-storyboard-action primary" onClick={() => onAdd(selected, appearances)}>Add kit to Scene 1</button>
        </div>
      </section>
    </div>
  );
}
