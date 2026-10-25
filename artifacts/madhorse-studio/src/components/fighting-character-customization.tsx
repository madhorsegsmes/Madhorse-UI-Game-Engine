import type { ChangeEvent } from 'react';
import {
  fighterOutfitOptions,
  fighterRaceOptions,
  fighterStyleOptions,
  type FighterAppearance,
  type FightingAppearancePair,
} from '@/lib/fighter-appearance';
import './fighting-character-customization.css';

export function FightingCharacterCustomization({ value, onChange }: {
  value: FightingAppearancePair;
  onChange: (value: FightingAppearancePair) => void;
}) {
  const update = (fighter: 'player' | 'rival', field: keyof FighterAppearance) =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextValue = event.target.value as FighterAppearance[typeof field];
      onChange({
        ...value,
        [fighter]: { ...value[fighter], [field]: nextValue },
      });
    };

  const fighterCard = (fighter: 'player' | 'rival', title: string) => (
    <fieldset className="fighter-look-card" key={fighter}>
      <legend>{title}</legend>
      <label>
        <span>Race</span>
        <select value={value[fighter].race} onChange={update(fighter, 'race')}
          aria-label={`${title} race`} data-testid={`fighter-${fighter}-race`}>
          {fighterRaceOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label>
        <span>Style</span>
        <select value={value[fighter].style} onChange={update(fighter, 'style')}
          aria-label={`${title} visual style`} data-testid={`fighter-${fighter}-style`}>
          {fighterStyleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label>
        <span>Clothing</span>
        <select value={value[fighter].outfit} onChange={update(fighter, 'outfit')}
          aria-label={`${title} clothing`} data-testid={`fighter-${fighter}-clothing`}>
          {fighterOutfitOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </fieldset>
  );

  return (
    <section className="fighter-appearance-settings" aria-label="Fighter appearance">
      <div className="fighter-appearance-reference">
        <img src={`${import.meta.env.BASE_URL}references/default-fighting-character.webp`}
          alt="Default fighting-character modeling guide" />
        <p>The image guides the pose, proportions, and clothing detail. Choose a separate race, 3D style, and outfit for each fighter.</p>
      </div>
      <div className="fighter-appearance-pair">
        {fighterCard('player', 'Fighter 1 · Player')}
        {fighterCard('rival', 'Fighter 2 · Opponent')}
      </div>
    </section>
  );
}
