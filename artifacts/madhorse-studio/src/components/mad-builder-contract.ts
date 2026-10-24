import type { MadBuilderPlan } from '@workspace/api-client-react';
import type { BuilderReferenceImage } from '@workspace/api-client-react';
export type BuilderStyle = 'polished-game-ready' | 'realistic-game-ready' | 'stylized-high-detail';
export type BuilderMessage = { id: string; role: 'user' | 'assistant'; text: string };
export type MadBuilderProps = {
  history: BuilderMessage[];
  plan: MadBuilderPlan | null;
  phase: 'idle' | 'planning' | 'ready' | 'applying';
  error: string;
  readOnly: boolean;
  onPlan: (prompt: string, saveAsPrefab: boolean, style: BuilderStyle, referenceImages: BuilderReferenceImage[]) => Promise<void>;
  onCancel: () => void;
  onDiscard: () => void;
  onApply: (saveAsPrefab: boolean) => void;
};
