import { Bot, ChevronRight } from 'lucide-react';
import { createEgoWorkspaceContext, type EgoInterfaceContext } from '@/lib/ego-workspace-context';
import type { GameCamera } from '@/lib/game-camera';
import type { BuilderDocument } from '@/hooks/use-mad-builder';
import './ego-panel-box.css';

export function EgoPanelBox({ project, camera, selectedEntityId, interfaceContext, onOpen }: {
  project: BuilderDocument;
  camera: GameCamera;
  selectedEntityId: string | null;
  interfaceContext: EgoInterfaceContext;
  onOpen: () => void;
}) {
  const context = createEgoWorkspaceContext(project, selectedEntityId, camera, interfaceContext);
  return <section className="fresh-ego-box" aria-label="Ego live interface context" data-testid="panel3-ego-box">
    <header>
      <img src={`${import.meta.env.BASE_URL}images/ego-robot-panel.webp`} alt="" />
      <div><strong>Ego <small>Live</small></strong><span title={interfaceContext.projectName}>{interfaceContext.projectName || 'Name your project'}</span></div>
      <button type="button" onClick={onOpen} data-testid="button-panel3-open-ego">
        <Bot size={12} aria-hidden="true" /> Open Ego <ChevronRight size={12} aria-hidden="true" />
      </button>
    </header>
    <dl>
      <div><dt>View</dt><dd>{interfaceContext.view === 'play' ? 'Play Test' : interfaceContext.view === 'canvas' ? 'Canvas / Game Camera' : 'Scene view'}</dd></div>
      <div><dt>Selected</dt><dd title={context.selectedName ?? undefined}>{context.selectedName ?? 'Nothing selected'}</dd></div>
      <div><dt>Scene</dt><dd>{context.activeObjectCount} objects · {project.assets.length} assets</dd></div>
      <div><dt>Tools</dt><dd title={interfaceContext.activeTool ?? undefined}>{interfaceContext.activeTool || (interfaceContext.toolset === 'world' ? 'World Building' : '3D Modeling')}</dd></div>
    </dl>
    <p>Reads project data and editor controls—not screen pixels.</p>
  </section>;
}
