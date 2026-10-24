export type EgoGameFlow = 'undecided' | 'ending' | 'ongoing' | 'ending-and-ongoing';

export function isEgoGameFlow(value: unknown): value is EgoGameFlow {
  return value === 'undecided' || value === 'ending' || value === 'ongoing' || value === 'ending-and-ongoing';
}

const flowGuidance: Partial<Record<EgoGameFlow, string>> = {
  ending: 'Plan a finite game with a clear final objective and ending.',
  ongoing: 'Plan a continuing game without a required final ending; support repeatable or ongoing play.',
  'ending-and-ongoing': 'Plan a main story with a clear ending and optional repeatable or continuing play afterward.',
};

export function buildEgoGameBrief(vision: string, flow: EgoGameFlow, notes: string) {
  return [
    vision.trim(),
    flowGuidance[flow] ? `Game flow: ${flowGuidance[flow]}` : '',
    notes.trim() ? `Creator's game-design notes: ${notes.trim().slice(0, 400)}` : '',
  ].filter(Boolean).join('\n\n').slice(0, 1_100);
}

export function egoGameFlowLabel(flow: EgoGameFlow) {
  switch (flow) {
    case 'ending': return 'Has an ending';
    case 'ongoing': return 'Keeps going';
    case 'ending-and-ongoing': return 'Has an ending, then continues';
    default: return 'Not decided yet';
  }
}
