export type FighterAttack = 'light-attack' | 'heavy-attack' | 'special-attack';
export type FighterMotionEvent = {
  attack?: { kind: FighterAttack; startedAt: number; duration: number };
  hitAt?: number;
};
export type FighterPlayback = FighterMotionEvent & {
  basketball?: {shoot:number;dribble:boolean;passing:number};
  time: number;
  moving: boolean;
  blocking: boolean;
  defeated: boolean;
};

export function fighterAttackDuration(kind: FighterAttack) {
  return kind === 'light-attack' ? .27 : kind === 'heavy-attack' ? .43 : .62;
}

export function fighterAttackEnvelope(attack: FighterMotionEvent['attack'], time: number) {
  if (!attack) return 0;
  const phase = (time - attack.startedAt) / attack.duration;
  if (phase < 0 || phase >= 1) return 0;
  const smooth = (value: number) => value * value * (3 - 2 * value);
  return phase < .27 ? smooth(phase / .27) : 1 - smooth((phase - .27) / .73);
}
