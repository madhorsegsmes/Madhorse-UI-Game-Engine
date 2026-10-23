import type { MadBuilderPlan } from '@workspace/api-client-react';
export type BuilderMessage = { id: string; role: 'user' | 'assistant'; text: string };
export type MadBuilderProps = {
  history: BuilderMessage[];
  plan: MadBuilderPlan | null;
  phase: 'idle' | 'planning' | 'ready' | 'applying';
  error: string;
  readOnly: boolean;
  onPlan: (prompt: string) => Promise<void>;
  onCancel: () => void;
  onDiscard: () => void;
  onApply: (saveAsPrefab: boolean) => void;
};
