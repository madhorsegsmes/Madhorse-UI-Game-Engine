import type { MadBuilderPlan } from '@workspace/api-client-react';
import type { BuilderReferenceImage } from '@workspace/api-client-react';
export type BuilderStyle = 'polished-game-ready' | 'realistic-game-ready' | 'stylized-high-detail';
export type BuilderBuildCategory = 'auto' | 'vehicle' | 'house';
export type BuilderMessage = { id: string; role: 'user' | 'assistant'; text: string };
export type BuilderOperationResult = { ok: boolean; message: string };
export type MadBuilderProps = {
  history: BuilderMessage[];
  plan: MadBuilderPlan | null;
  phase: 'idle' | 'planning' | 'ready' | 'applying';
  error: string;
  readOnly: boolean;
  onPlan: (
    prompt: string,
    saveAsPrefab: boolean,
    style: BuilderStyle,
    buildCategory: BuilderBuildCategory,
    referenceImages: BuilderReferenceImage[],
  ) => Promise<BuilderOperationResult>;
  onCancel: () => void;
  onDiscard: () => void;
  onApply: (saveAsPrefab: boolean) => void;
};
