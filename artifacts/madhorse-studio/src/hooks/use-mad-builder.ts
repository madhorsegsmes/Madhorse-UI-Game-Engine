import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { planMadBuilder, type MadBuilderPlan } from '@workspace/api-client-react';
import { PlanMadBuilderResponse } from '@workspace/api-zod';
import { compileBuilderPlan } from '@/lib/mad-builder';
import { capturePrefab } from '@/lib/scene-authoring';
import { beginSystemActivity } from '@/lib/system-activity';
import type { BuilderMessage, MadBuilderProps } from '@/components/mad-builder-contract';
import type { AuthoringDocument } from './use-scene-authoring';

export type BuilderDocument = AuthoringDocument & { builderHistory?: BuilderMessage[]; builderDraft?: MadBuilderPlan | null };
export function useMadBuilder<T extends BuilderDocument>({ project, activeProjectRef, setProjects, readOnly, onBuilt, selectedEntityId }: {
  project: T; activeProjectRef: MutableRefObject<T>; setProjects: Dispatch<SetStateAction<T[]>>;
  readOnly: boolean; onBuilt: (rootId: string) => void; selectedEntityId?: string | null;
}): MadBuilderProps {
  const [phase, setPhase] = useState<MadBuilderProps['phase']>(project.builderDraft ? 'ready' : 'idle');
  const [plan, setPlan] = useState<MadBuilderPlan | null>(project.builderDraft ?? null);
  const [error, setError] = useState('');
  const request = useRef<{ controller: AbortController; finish: () => void } | null>(null);
  const session = useRef(0);
  const planProjectId = useRef(project.id);
  const cancel = () => {
    session.current++;
    request.current?.controller.abort();
    request.current?.finish();
    request.current = null;
  };
  useEffect(() => {
    planProjectId.current = project.id;
    setPlan(project.builderDraft ?? null); setError(''); setPhase(project.builderDraft ? 'ready' : 'idle');
    return cancel;
  }, [project.id]);
  function message(text: string, role: BuilderMessage['role']) {
    const item = { id: crypto.randomUUID(), role, text: text.slice(0, 2000) };
    setProjects((projects) => projects.map((entry) => entry.id !== project.id ? entry : {
      ...entry, builderHistory: [...(entry.builderHistory ?? []), item].slice(-40),
    }));
  }
  function applyBuilderPlan(planToBuild: MadBuilderPlan, saveAsPrefab: boolean) {
    if (readOnly || activeProjectRef.current.id !== project.id || planProjectId.current !== project.id) return;
    const finish = beginSystemActivity('Mad Builder is building');
    setPhase('applying'); setError('');
    try {
      const latest = activeProjectRef.current;
      const build = compileBuilderPlan(planToBuild, latest.entities, latest.assets);
      const prefab = saveAsPrefab ? capturePrefab(build.entities, build.rootId, build.plan.title, build.uiControls) : null;
      const response: BuilderMessage = { id: crypto.randomUUID(), role: 'assistant',
        text: `Built ${build.plan.title}: ${build.entities.length - 1} editable parts${prefab ? ', with a reusable prefab' : ''}. Existing objects were kept.` };
      setProjects((projects) => projects.map((entry) => entry.id !== project.id ? entry : {
        ...entry, builderDraft: null, entities: [...entry.entities, ...build.entities],
        uiControls: [...(entry.uiControls ?? []), ...build.uiControls],
        prefabs: prefab ? [...(entry.prefabs ?? []), prefab] : entry.prefabs,
        builderHistory: [...(entry.builderHistory ?? []), response].slice(-40),
      }));
      setPlan(null); setPhase('idle');
      onBuilt(build.rootId);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The build was rejected. No changes were made.');
      setPhase('ready');
    } finally { finish(); }
  }
  return {
    history: project.builderHistory ?? [], phase, plan, error, readOnly,
    onPlan: async (raw, saveAsPrefab) => {
      const prompt = raw.trim();
      if (readOnly || phase === 'planning' || phase === 'applying' || prompt.length < 3 || prompt.length > 2000) return;
      cancel();
      const token = session.current;
      const controller = new AbortController();
      const finish = beginSystemActivity('Mad Builder is planning');
      request.current = { controller, finish };
      setError(''); setPlan(null); setPhase('planning');
      message(prompt, 'user');
      try {
        const contextEntity = project.entities.find((entity) => entity.id === selectedEntityId) ??
          project.entities.find((entity) => entity.id === 'player');
        const result = PlanMadBuilderResponse.parse(await planMadBuilder({
          prompt, selectedName: contextEntity?.name ?? '',
          assets: project.assets.slice(0, 40).map(({ id, name, kind }) => ({ id, name: name.slice(0, 160), kind })),
        }, { signal: controller.signal }));
        if (token !== session.current || activeProjectRef.current.id !== project.id) return;
        // Validate on the client before any generated object is added to the scene.
        if (result.parts?.length) compileBuilderPlan(result, activeProjectRef.current.entities, activeProjectRef.current.assets);
        planProjectId.current = project.id;
        setPlan(result); setPhase('ready');
        setProjects((projects) => projects.map((entry) => entry.id !== project.id ? entry : { ...entry, builderDraft: result }));
        message(result.summary, 'assistant');
        setPhase('applying');
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        if (token !== session.current || controller.signal.aborted) return;
        applyBuilderPlan(result, saveAsPrefab);
      } catch (failure) {
        if (token !== session.current || controller.signal.aborted) return;
        const data = failure && typeof failure === 'object' && 'data' in failure ? failure.data : null;
        const detail = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : null;
        setError(detail ?? (failure instanceof Error ? failure.message.slice(0, 500) : 'Mad Builder could not build a valid scene.'));
        const draft = activeProjectRef.current.builderDraft ?? null;
        setPlan(draft); setPhase(draft ? 'ready' : 'idle');
      } finally {
        finish();
        if (request.current?.controller === controller) request.current = null;
      }
    },
    onCancel: () => {
      cancel();
      const draft = activeProjectRef.current.builderDraft ?? plan ?? null;
      setPhase(draft ? 'ready' : 'idle'); setPlan(draft); setError('');
      message(phase === 'applying'
        ? 'Build canceled before it was added. The saved plan is ready to build again.'
        : 'Canceled. No scene changes were made.', 'assistant');
    },
    onDiscard: () => {
      setPlan(null); setPhase('idle'); setError('');
      setProjects((projects) => projects.map((entry) => entry.id !== project.id ? entry : { ...entry, builderDraft: null }));
    },
    onApply: (saveAsPrefab) => {
      if (readOnly || !plan || phase !== 'ready' || activeProjectRef.current.id !== project.id ||
          planProjectId.current !== project.id) return;
      applyBuilderPlan(plan, saveAsPrefab);
    },
  };
}
