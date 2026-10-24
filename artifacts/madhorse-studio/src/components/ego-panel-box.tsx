import { Bot, ChevronRight } from 'lucide-react';
import { createEgoWorkspaceContext, type EgoInterfaceContext } from '@/lib/ego-workspace-context';
import type { GameCamera } from '@/lib/game-camera';
import type { BuilderDocument } from '@/hooks/use-mad-builder';
import { egoGameFlowLabel, type EgoGameFlow } from '@/lib/ego-game-plan';
import './ego-panel-box.css';

export function EgoPanelBox({ project, camera, selectedEntityId, interfaceContext, gameVision, gameFlow, gameNotes, onGameVisionChange, onGameFlowChange, onGameNotesChange, onOpen }: {
  project: BuilderDocument;
  camera: GameCamera;
  selectedEntityId: string | null;
  interfaceContext: EgoInterfaceContext;
  gameVision: string;
  gameFlow: EgoGameFlow;
  gameNotes: string;
  onGameVisionChange: (value: string) => void;
  onGameFlowChange: (value: EgoGameFlow) => void;
  onGameNotesChange: (value: string) => void;
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
    <label className="fresh-ego-plan-field">
      <span>What do you want in your game?</span>
      <textarea value={gameVision} maxLength={500} rows={2} onChange={event => onGameVisionChange(event.target.value)}
        placeholder="Describe your game in your own words" data-testid="panel3-ego-game-vision" />
    </label>
    <label className="fresh-ego-plan-field">
      <span>How should the game flow?</span>
      <select value={gameFlow} onChange={event => onGameFlowChange(event.target.value as EgoGameFlow)} data-testid="panel3-ego-game-flow">
        <option value="undecided">{egoGameFlowLabel('undecided')}</option>
        <option value="ending">{egoGameFlowLabel('ending')}</option>
        <option value="ongoing">{egoGameFlowLabel('ongoing')}</option>
        <option value="ending-and-ongoing">{egoGameFlowLabel('ending-and-ongoing')}</option>
      </select>
    </label>
    <label className="fresh-ego-plan-field">
      <span>{gameFlow === 'undecided' ? 'Extra game details' : 'How should the ending or continuing play work?'}</span>
      <textarea value={gameNotes} maxLength={400} rows={2} onChange={event => onGameNotesChange(event.target.value)}
        placeholder="Add goals, an ending, or repeatable activities" data-testid="panel3-ego-game-notes" />
    </label>
    <p>Saved with this project. Ego uses its “What Ego understood” cards as optional writing help.</p>
  </section>;
}
