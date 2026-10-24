import { useState } from 'react';
import { BookOpen, Bot, Boxes, Camera, Code2, Eye, Gamepad2, Layers3, Loader2, X } from 'lucide-react';
import type { BuilderDocument } from '@/hooks/use-mad-builder';
import type { GameCamera } from '@/lib/game-camera';
import type { ScriptFile } from '@/lib/project-scripts';
import { analyzeEgoGameVision, egoGameLanguageLibrary } from '@/lib/ego-game-language';
import type { EgoCharacterSize } from '@/lib/ego-character-anatomy';
import type { BuilderOperationResult } from './mad-builder-contract';
import { EgoScriptStudio } from './ego-script-studio';
import {
  egoGameTypes,
  getEgoGameLabel,
  getEgoGameSelectionLabel,
  type EgoGameType,
} from '@/lib/ego-ui-kit';
import { egoGraphicsReferences } from '@/lib/ego-visual-quality';
import './ego-graphics-references.css';
import { createEgoWorkspaceContext, type EgoInterfaceContext } from '@/lib/ego-workspace-context';
import { parseVisionAttachments } from '@/lib/vision-node-content';
import { studioProjectStorageKey } from '@/lib/studio-projects';
import { buildEgoGameBrief, egoGameFlowLabel, type EgoGameFlow } from '@/lib/ego-game-plan';

type EgoAssistantProps = {
  interfaceContext?: EgoInterfaceContext;
  gameVision: string;
  onGameVisionChange: (value: string) => void;
  gameFlow: EgoGameFlow;
  onGameFlowChange: (value: EgoGameFlow) => void;
  gameNotes: string;
  onGameNotesChange: (value: string) => void;
  project: BuilderDocument;
  animationsCount: number;
  animationControllersCount: number;
  onBuildVision: (
    vision: string,
    gameTypes: EgoGameType[],
    characterSize: EgoCharacterSize,
    onProgress: (message: string) => void,
  ) => Promise<BuilderOperationResult>;
  onBuildUi: (gameTypes: EgoGameType[], gameVision: string) => string;
  onAddFunctions: (gameTypes: EgoGameType[]) => string;
  scripts: ScriptFile[];
  camera: GameCamera;
  selectedEntityId: string | null;
  onCreateScript: (script: ScriptFile) => string;
  onUpdateScript: (script: ScriptFile) => string;
  onDeleteScript: (id: string) => void;
  onClose: () => void;
};

const guideByGame: Record<EgoGameType, string[]> = {
  rpg: ['Add a Player Controller, then attach Fighting, Healing, or Spell actions.', 'Use the UI Controls panel to move the health bar and quest tracker.', 'Add doors, pickups, and checkpoints from the object tools.'],
  racing: ['Add a vehicle and select its Racing function.', 'Use the UI Controls panel to place speed, lap, and position displays.', 'Press Play/Test to try steering, braking, and the race HUD.'],
  'kart-racing': ['Build a compact kart and a closed circuit with readable curbs.', 'Ego adds the arcade drive controls and a kart HUD with speed, lap, position, boost, and drift.', 'Press Play/Test; driving is a simple arcade controller, not full wheel or suspension simulation.'],
  'car-racing': ['Build a proportioned road car and a track with clear boundaries and checkpoints.', 'Ego adds a higher-speed drive profile and a car-racing HUD with speed, lap, position, gear, and RPM.', 'Press Play/Test; this starter controller is arcade-style and does not simulate tire forces or a real gearbox.'],
  sports: ['Create the playing field and add a Player Controller.', 'Use the score panel and stamina bar as your first HUD.', 'Add movement functions to the player; add sport-specific rules as the project grows.'],
  fighting: ['Add a player and an opponent to the scene.', 'Attach Fighting and Block functions to the player.', 'Use the health bars and round display as a starting HUD.'],
  rts: ['Create a terrain and add units to the scene.', 'Attach Command, Gather, and Build functions to a player unit.', 'Use the resource panel and selected-unit panel to plan the screen.'],
  card: ['Add a player object for the local card actions.', 'Attach Draw Card, Play Card, and End Turn functions.', 'Use the hand panel and energy display to arrange the card table.'],
  mmo: ['Create a player, NPCs, and a world area.', 'Attach supported combat, healing, and companion functions.', 'Use the quest, party, health, and mana panels as your first HUD.'],
  shooter: ['Add a Player Controller and a practice target.', 'Attach Shooting, Reload, and Crouch functions to the player.', 'Use Play/Test to try the controls; position the health and ammo displays.'],
  'third-person-shooter': ['Choose Third-Person Shooter and describe the player, objective, enemies, and map.', 'Ego can block out the player start, cover, targets, scene objects, and a shooter HUD; tune the Game Camera in Panel 3.', 'Use Play/Test to check supported movement and shooting actions. Weapons, missions, and online play need further implementation.'],
  'kingdom-strategy': ['Choose Kingdom Strategy and describe the map, home base, resource sites, and rival forces.', 'Use World Building tools in Panel 5 for terrain; add units and structures, then attach Command, Gather, or Build actions.', 'Use the starter resource and selected-unit panels; full economies, campaign rules, and online battles still need building.'],
  'creature-adventure-2d': ['Choose Creature Adventure · 2D and describe exploration, companions, encounters, and the goal.', 'Import creature and environment sprites in Panel 2 · Assets; tell Ego which asset names to reuse.', 'Play/Test the supported movement and action presets, then edit the party and health UI. Without matching sprite assets, Ego cannot invent finished 2D character art.'],
  'creature-adventure-3d': ['Choose Creature Adventure · 3D and describe the world, player, companions, and encounters.', 'Ego can add editable creature body-plan templates and use matching project model assets when available.', 'Use Play/Test for supported movement and actions; capture, party, battle, and progression rules require further implementation.'],
  platformer: ['Create platforms and add a Player Controller.', 'Attach Running, Crouching, and Fighting functions as needed.', 'Use the health, lives, and pause controls as a starter HUD.'],
};

function projectScan(project: BuilderDocument, animationsCount: number, animationControllersCount: number) {
  const components = project.entities.flatMap((entity) => entity.components);
  const assetCounts = { image: 0, model: 0, audio: 0, data: 0 };
  for (const asset of project.assets) assetCounts[asset.kind]++;
  let boardCounts = { nodes: 0, images: 0, videos: 0, menus: 0, audio: 0 };
  try {
    const savedPanels = JSON.parse(localStorage.getItem(studioProjectStorageKey('madhorse.vision-board-panels.v2')) ?? '[]') as unknown;
    if (Array.isArray(savedPanels)) {
      boardCounts = { nodes: savedPanels.length, images: 0, videos: 0, menus: 0, audio: 0 };
      for (const panel of savedPanels) {
        if (!panel || typeof panel !== 'object') continue;
        const item = panel as { id?: string; kind?: string; mediaId?: string; mediaName?: string; attachments?: unknown };
        for (const attachment of parseVisionAttachments(item.attachments, item)) {
          if (attachment.kind === 'image') boardCounts.images++;
          if (attachment.kind === 'video') boardCounts.videos++;
          if (attachment.kind === 'menu-screen') boardCounts.menus++;
          if (attachment.kind === 'audio') boardCounts.audio++;
        }
      }
    }
  } catch {
    // The board is optional; continue scanning the scene if its layout is unavailable.
  }
  return {
    objects: project.entities.length,
    components: components.length,
    scripts: project.scripts?.length ?? components.filter((component) => component.type === 'script').length,
    players: project.entities.filter((entity) =>
      entity.components.some((component) => component.type === 'characterController' && component.role === 'player')).length,
    ui: project.uiControls?.length ?? 0,
    animations: animationsCount,
    animationControllers: animationControllersCount,
    prefabs: project.prefabs?.length ?? 0,
    builds: project.builderBuildLogs?.length ?? 0,
    assets: assetCounts,
    board: boardCounts,
  };
}

export function EgoAssistant({
  interfaceContext,
  gameVision, onGameVisionChange, gameFlow, onGameFlowChange, gameNotes, onGameNotesChange,
  project, animationsCount, animationControllersCount, onBuildVision, onBuildUi, onAddFunctions, scripts, camera, selectedEntityId,
  onCreateScript, onUpdateScript, onDeleteScript, onClose,
}: EgoAssistantProps) {
  const [gameTypes, setGameTypes] = useState<EgoGameType[]>(['rpg']);
  const [characterSize, setCharacterSize] = useState<EgoCharacterSize>('prompt');
  const [phraseFilter, setPhraseFilter] = useState('');
  const [activityLog, setActivityLog] = useState<Array<{ id: string; action: string; detail: string; time: string; duration?: string }>>([]);
  const [sceneBuildBusy, setSceneBuildBusy] = useState(false);
  const [sceneBuildProgress, setSceneBuildProgress] = useState('');
  const [sceneBuildResult, setSceneBuildResult] = useState('');
  const [activeTab, setActiveTab] = useState<'build' | 'guide' | 'scripts'>('build');
  const scan = projectScan(project, animationsCount, animationControllersCount);
  const workspaceContext = createEgoWorkspaceContext(project, selectedEntityId, camera, interfaceContext);
  const gameLabel = getEgoGameSelectionLabel(gameTypes);
  const gameBrief = buildEgoGameBrief(gameVision, gameFlow, gameNotes);
  const visionAnalysis = analyzeEgoGameVision(gameBrief);
  const visiblePhrases = egoGameLanguageLibrary.filter((entry) =>
    `${entry.label} ${entry.phrases.join(' ')} ${entry.explanation} ${entry.engineArea}`
      .toLowerCase().includes(phraseFilter.trim().toLowerCase()));
  const hasUsableSceneObjects = project.entities.some(entity =>
    !/^(cube|game camera|camera|empty object)$/i.test(entity.name.trim()) &&
    entity.components.some(component =>
      ['primitive', 'spriteRenderer', 'modelRenderer', 'characterController'].includes(component.type)));

  const toggleGameType = (gameType: EgoGameType) => {
    setGameTypes(current => {
      const opposite = gameType === 'creature-adventure-2d'
        ? 'creature-adventure-3d'
        : gameType === 'creature-adventure-3d' ? 'creature-adventure-2d' : null;
      const next = current.includes(gameType)
        ? current.length > 1 ? current.filter(type => type !== gameType) : current
        : [...current.filter(type => type !== opposite), gameType];
      return next.length ? next : current;
    });
  };

  const appendActivity = (action: string, detail: string, duration?: string) => {
    setActivityLog(current => [...current, {
      id: crypto.randomUUID(),
      action,
      detail,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...(duration ? { duration } : {}),
    }].slice(-20));
  };

  const recordAction = (action: string, run: () => string) => {
    try {
      appendActivity(action, run());
    } catch (failure) {
      appendActivity(`${action} — needs attention`, failure instanceof Error ? failure.message : 'This action could not be completed.');
    }
  };

  const buildFromVision = async () => {
    const vision = gameBrief.trim();
    if (vision.length < 3 || sceneBuildBusy) return;
    const startedAt = performance.now();
    setSceneBuildBusy(true);
    setSceneBuildResult('');
    appendActivity('Read game vision', `Ego found ${visionAnalysis.detected.length} game areas in the description and is preparing a scene build.`);
    try {
      setSceneBuildProgress('Planning editable scene objects from the vision…');
      const sceneResult = await onBuildVision(vision, gameTypes, characterSize, setSceneBuildProgress);
      if (!sceneResult.ok) {
        setSceneBuildResult(`Build stopped: ${sceneResult.message}`);
        appendActivity('Scene build stopped', sceneResult.message);
        return;
      }
      const sceneDuration = Math.max(0.1, (performance.now() - startedAt) / 1000).toFixed(1);
      appendActivity('Created scene objects', sceneResult.message, `Scene step took ${sceneDuration} seconds.`);
      setSceneBuildProgress('Adding a player and supported game functions…');
      const functionResult = onAddFunctions(gameTypes);
      appendActivity('Added player functions', functionResult);
      setSceneBuildProgress('Creating an editable starter UI…');
      const uiResult = onBuildUi(gameTypes, vision);
      appendActivity('Created UI controls', uiResult);
      setSceneBuildResult('Scene, supported player functions, and UI starter were added. Select objects in the hierarchy to edit them.');
    } catch (failure) {
      const detail = failure instanceof Error ? failure.message : 'The build could not be completed.';
      setSceneBuildResult(`Build stopped: ${detail} Any earlier completed steps remain editable in the scene.`);
      appendActivity('Build needs attention', detail);
    } finally {
      setSceneBuildBusy(false);
      setSceneBuildProgress('');
    }
  };

  return (
    <div className="ego-assistant" data-testid="ego-assistant">
      <header className="ego-assistant-header">
        <div className="ego-assistant-title">
          <span className="ego-assistant-robot"><Bot size={18} aria-hidden="true" /></span>
          <div>
            <h2>Ego</h2>
              <p>Central game builder for worlds, characters, creatures, systems, animation, and UI</p>
          </div>
        </div>
        <button type="button" className="ego-assistant-close" onClick={onClose} aria-label="Close Ego">
          <X size={17} aria-hidden="true" />
        </button>
      </header>

      <div className="ego-assistant-body">
        <div className="ego-tabs" role="tablist" aria-label="Ego tools">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'build'}
            className={activeTab === 'build' ? 'is-active' : ''}
            onClick={() => setActiveTab('build')}
          >
            <Layers3 size={14} aria-hidden="true" /> Build UI & functions
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'scripts'}
            className={activeTab === 'scripts' ? 'is-active' : ''}
            onClick={() => setActiveTab('scripts')}
            data-testid="ego-tab-scripts"
          >
            <Code2 size={14} aria-hidden="true" /> Scripts & knowledge
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'guide'}
            className={activeTab === 'guide' ? 'is-active' : ''}
            onClick={() => setActiveTab('guide')}
          >
            <BookOpen size={14} aria-hidden="true" /> Step-by-step guide
          </button>
        </div>

        {activeTab === 'build' ? (
          <section className="ego-build-content" role="tabpanel">
            <section className="ego-vision-hero" aria-label="Ego game creation prompt">
              <img
                className="ego-vision-hero-image"
                src={`${import.meta.env.BASE_URL}images/ego-robot-panel.webp`}
                alt=""
                aria-hidden="true"
              />
              <div className="ego-vision-hero-overlay">
                <span>CREATE WITH EGO</span>
                <h3>What do you wish to create?</h3>
                <p>Describe it in the vision box below.</p>
              </div>
            </section>
            <section className="ego-editor-context" aria-label="Current scene and project assets" data-testid="ego-editor-context">
              <div className="ego-editor-context-heading">
                <div><Eye size={14} aria-hidden="true" /><strong>Ego’s live editor context</strong></div>
                <span>Scene 1 · {workspaceContext.activeObjectCount} objects</span>
              </div>
              <p><b>Selected:</b> {workspaceContext.selectedName ?? 'Nothing selected'} · <Camera size={12} aria-hidden="true" /> <b>Game Camera:</b> {workspaceContext.cameraSummary}</p>
              <p><b>Scene View:</b> {workspaceContext.visibleNames.length ? workspaceContext.visibleNames.join(' · ') : 'No active objects yet'}</p>
              {workspaceContext.interfaceSummary && <p data-testid="ego-interface-summary">{workspaceContext.interfaceSummary}</p>}
              <div className="ego-editor-assets">
                <b>Image/model assets Mad Builder can reuse:</b>
                {workspaceContext.assets.length ? workspaceContext.assets.map(asset => (
                  <span key={asset.id} title={`${asset.kind} · ${asset.id}`}>{asset.name} · {asset.kind}</span>
                )) : <span>No imported images or models yet</span>}
              </div>
              <small>Ego reads the current hierarchy, selection, camera settings, and asset records—not a screenshot of rendered pixels.</small>
            </section>
            <label className="ego-field">
              <span>Your game vision</span>
              <textarea
                value={gameVision}
                onChange={(event) => onGameVisionChange(event.target.value)}
                maxLength={500}
                rows={4}
                data-testid="ego-game-vision"
              />
            </label>
            <fieldset className="ego-game-type-picker" data-testid="ego-game-types">
              <legend>Choose game types</legend>
              <p>Select one or combine multiple game types.</p>
              <div className="ego-game-type-options">
                {egoGameTypes.map(game => (
                  <label
                    key={game.value}
                    className={`ego-game-type-choice${gameTypes.includes(game.value) ? ' is-selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      value={game.value}
                      checked={gameTypes.includes(game.value)}
                      onChange={() => toggleGameType(game.value)}
                      data-testid={`ego-game-type-${game.value}`}
                    />
                    <span>{game.label}</span>
                  </label>
                ))}
              </div>
              <span className="ego-selected-types">Selected: {gameLabel}</span>
              <small>Choose a genre or combine genres. Creature Adventure 2D and 3D are separate modes; choose one.</small>
              {gameTypes.includes('creature-adventure-2d') && (
                <small className="ego-2d-asset-note">2D mode reuses imported sprites. Upload creature and environment images in Panel 2 · Assets; Ego does not generate finished sprite art yet.</small>
              )}
            </fieldset>
            <label className="ego-character-size-picker">
              <span>Creature size</span>
              <select
                value={characterSize}
                onChange={(event) => setCharacterSize(event.target.value as EgoCharacterSize)}
                data-testid="ego-character-size"
              >
                <option value="prompt">Use size from vision</option>
                <option value="small">Small · 1.1 m</option>
                <option value="average">Average · 1.8 m</option>
                <option value="tall">Tall · 2.4 m</option>
                <option value="giant">Giant · 3.6 m</option>
              </select>
              <small>For humanoids, animals, and monsters. Write an exact size (such as 1.65 m or 6 ft), use a preset, then edit the named anatomy parts in Hierarchy.</small>
            </label>
            <section className="ego-vision-build-action" aria-label="Build scene from game vision">
              <p>
                {hasUsableSceneObjects
                  ? 'Ego will keep the current scene and add objects requested by your vision.'
                  : 'No game objects are ready yet. Ego will create editable scene objects from your vision.'}
              </p>
              <button
                type="button"
                className="ego-build-vision-button"
                onClick={() => void buildFromVision()}
                disabled={gameVision.trim().length < 3 || sceneBuildBusy}
                data-testid="ego-build-from-vision"
              >
                <Bot size={15} aria-hidden="true" />
                {sceneBuildBusy ? 'Building from vision…' : 'Build scene from vision'}
              </button>
              {sceneBuildBusy && (
                <div className="ego-vision-progress" role="status" data-testid="ego-vision-progress">
                  <img src={`${import.meta.env.BASE_URL}images/ego-robot-panel.webp`} alt="" aria-hidden="true" />
                  <Loader2 size={14} className="ego-progress-spinner" aria-hidden="true" />
                  <span>{sceneBuildProgress}</span>
                </div>
              )}
              {sceneBuildResult && <p className="ego-vision-build-result" role="status">{sceneBuildResult}</p>}
            </section>
            <section className="ego-vision-understanding" aria-label="Ego vision understanding" data-testid="ego-vision-understanding">
              <div className="ego-section-heading">
                <div><BookOpen size={14} aria-hidden="true" /><strong>What Ego understood</strong></div>
                <span>{visionAnalysis.detected.length} game areas found</span>
              </div>
              {visionAnalysis.detected.length ? (
                <div className="ego-understood-grid">
                  {visionAnalysis.detected.map(({ concept, matches }) => (
                    <article key={concept.id}>
                      <strong>{concept.label}</strong>
                      <span>Words found: {matches.join(', ')}</span>
                      <p>{concept.explanation}</p>
                      <small>Uses: {concept.engineArea}</small>
                      <button
                        type="button"
                        className="ego-add-concept-note"
                        disabled={gameNotes.includes(`${concept.label}:`)}
                        onClick={() => onGameNotesChange(
                          `${gameNotes.trim() ? `${gameNotes.trim()}\n` : ''}${concept.label}: ${concept.explanation}`.slice(0, 400),
                        )}
                        data-testid={`ego-add-concept-${concept.id}`}
                      >
                        {gameNotes.includes(`${concept.label}:`) ? 'Added to game notes' : 'Add help to game notes'}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="ego-vision-hint">
                  {visionAnalysis.unmatched || 'Write your idea in everyday words. Try who the player is, what they do, and what they are trying to finish.'}
                </p>
              )}
              <label className="ego-field ego-understood-flow">
                <span>What happens when players finish the main goal?</span>
                <select value={gameFlow} onChange={event => onGameFlowChange(event.target.value as EgoGameFlow)} data-testid="ego-game-flow">
                  <option value="undecided">{egoGameFlowLabel('undecided')}</option>
                  <option value="ending">{egoGameFlowLabel('ending')}</option>
                  <option value="ongoing">{egoGameFlowLabel('ongoing')}</option>
                  <option value="ending-and-ongoing">{egoGameFlowLabel('ending-and-ongoing')}</option>
                </select>
              </label>
              <label className="ego-field">
                <span>Game ending and continuing-play notes</span>
                <textarea value={gameNotes} maxLength={400} rows={3}
                  onChange={event => onGameNotesChange(event.target.value)} data-testid="ego-game-notes"
                  placeholder="Type what should happen when players finish, or what keeps the game going." />
              </label>
              <div className="ego-vision-milestones" aria-label="Game build milestones">
                <article><b>START</b><span>{visionAnalysis.start}</span></article>
                <article><b>MISSION</b><span>{visionAnalysis.mission}</span></article>
                <article><b>{gameFlow === 'ongoing' ? 'ONGOING' : 'FINISH'}</b>
                  <span>{gameFlow === 'ongoing' ? 'Plan repeatable or continuing goals with no required final ending.'
                    : gameFlow === 'ending-and-ongoing' ? 'Give the main story a clear ending, with optional play that continues afterward.'
                      : gameFlow === 'ending' ? 'Give players a clear final goal that completes the game.'
                        : visionAnalysis.finish}</span>
                </article>
              </div>
              <details className="ego-phrase-library">
                <summary>Read Ego’s game-building phrase library</summary>
                <label>
                  <span>Find a word or phrase</span>
                  <input value={phraseFilter} onChange={(event) => setPhraseFilter(event.target.value)} />
                </label>
                <div className="ego-phrase-entries">
                  {visiblePhrases.map((entry) => (
                    <article key={entry.id}>
                      <strong>{entry.label}</strong>
                      <span>{entry.phrases.join(' · ')}</span>
                      <small>{entry.explanation}</small>
                    </article>
                  ))}
                  {!visiblePhrases.length && <p>No matching phrase yet.</p>}
                </div>
              </details>
            </section>
            <div className="ego-build-actions">
              <button type="button" disabled={sceneBuildBusy} onClick={() => recordAction('Built UI kit', () => onBuildUi(gameTypes, gameBrief.trim()))} data-testid="ego-build-ui">
                <Layers3 size={15} aria-hidden="true" /> {gameTypes.length > 1 ? 'Create mixed UI kit' : `Create ${getEgoGameLabel(gameTypes[0])} UI kit`}
              </button>
              <button type="button" className="secondary" disabled={sceneBuildBusy} onClick={() => recordAction('Added game functions', () => onAddFunctions(gameTypes))} data-testid="ego-add-functions">
                <Gamepad2 size={15} aria-hidden="true" /> Add {gameTypes.length > 1 ? 'mixed game functions' : `${getEgoGameLabel(gameTypes[0])} functions`}
              </button>
            </div>
            <section className="ego-work-log" aria-label="Ego work log" data-testid="ego-work-log">
              <header>
                <img src={`${import.meta.env.BASE_URL}images/ego-robot-panel.webp`} alt="" aria-hidden="true" />
                <div><strong>Ego work log</strong><span>Updates appear here after each completed action.</span></div>
              </header>
              <div className="ego-work-log-entries" role="log" aria-live="polite">
                {activityLog.length ? activityLog.map(entry => (
                  <article key={entry.id}>
                    <span>{entry.time} · {entry.action}</span>
                    <p>{entry.detail}</p>
                    <small>{entry.duration ?? 'Completed immediately.'} This reports this action only, not full-game completion.</small>
                  </article>
                )) : (
                  <p className="ego-work-log-empty">Ego has not changed this project during this session. Full-game completion estimates are not available until a complete game-build and export pipeline is connected.</p>
                )}
              </div>
            </section>
            <p className="ego-capability-note">
              Ego coordinates editable scene builds, project assets, supported player actions, animation, and starter UI. These are buildable starting points—not finished AAA campaigns, custom 2D art, advanced economies, or production online games.
            </p>
          </section>
        ) : activeTab === 'scripts' ? (
          <EgoScriptStudio
            scripts={scripts}
            entities={project.entities}
            camera={camera}
            selectedEntityId={selectedEntityId}
            onCreate={onCreateScript}
            onUpdate={onUpdateScript}
            onDelete={onDeleteScript}
          />
        ) : (
          <section className="ego-guide-content" role="tabpanel">
            <h3>Build your {gameLabel} game step by step</h3>
            <section className="ego-guide-current" aria-label="Steps based on the current editor">
              <h4>What to do in this project now</h4>
              <ol>{workspaceContext.steps.map(step => <li key={step}>{step}</li>)}</ol>
              <p><Camera size={12} aria-hidden="true" /> Current Game Camera: {workspaceContext.cameraSummary}</p>
            </section>
            <ol>
              <li>Describe the game in the vision box and choose one or more game types.</li>
              <li>Press Build scene from vision. Mad Builder plans scene objects; Ego adds supported 3D creature templates, or uses matching imported sprites for Creature Adventure · 2D.</li>
              <li>Ego then adds the supported Player functions and an editable starter UI kit.</li>
              <li>When characters are present, Ego adds editable idle, movement, and genre-action clips plus a controller that switches states in Play/Test.</li>
              <li>Select generated objects in Panel 2 · Hierarchy to edit them, then use Play/Test. Add your own models, sprites, and textures through Panel 2 · Assets.</li>
            </ol>
            {gameTypes.map(gameType => (
              <section className="ego-guide-game" key={gameType}>
                <h4>{getEgoGameLabel(gameType)} setup</h4>
                <ol>{guideByGame[gameType].map((step) => <li key={step}>{step}</li>)}</ol>
              </section>
            ))}
            <details className="ego-graphics-references">
              <summary>Graphics and animation references</summary>
              <p>Ego uses these public Unity and Unreal guides as visual and animation-design references. Madhorse applies the transferable principles with its own renderer; it does not run HDRP, Nanite, Lumen, or Unity/Unreal animation systems.</p>
              <ul>{egoGraphicsReferences.map(reference => (
                <li key={reference.url}><a href={reference.url} target="_blank" rel="noreferrer">{reference.label}</a></li>
              ))}</ul>
            </details>
            <p className="ego-capability-note">Ego’s scene context comes from saved project data and camera settings; it does not currently inspect rendered pixels. Function actions are engine presets, not arbitrary generated code. Review each object in Hierarchy to edit its settings.</p>
          </section>
        )}

        <section className="ego-scan-card" aria-label="Project scan" data-testid="ego-project-scan">
          <div className="ego-section-heading">
            <div><Boxes size={15} aria-hidden="true" /><strong>Project scan</strong></div>
            <span>Saved in this browser</span>
          </div>
          <div className="ego-scan-grid">
            <span><b>{scan.objects}</b> scene objects</span>
            <span><b>{scan.components}</b> components</span>
            <span><b>{scan.ui}</b> UI elements</span>
            <span><b>{scan.animations}</b> animations</span>
            <span><b>{scan.animationControllers}</b> animation controllers</span>
            <span><b>{scan.prefabs}</b> prefabs</span>
            <span><b>{scan.builds}</b> Mad Builder builds</span>
            <span><b>{scan.players}</b> player objects</span>
            <span><b>{scan.scripts}</b> safe script slots</span>
            <span><b>{scan.board.nodes}</b> Vision Board nodes</span>
          </div>
          <p className="ego-asset-summary">Assets: {scan.assets.image} images · {scan.assets.model} models · {scan.assets.audio} audio · {scan.assets.data} data</p>
          <p className="ego-asset-summary">Vision Board: {scan.board.images} images · {scan.board.videos} videos · {scan.board.menus} menu screens · {scan.board.audio} audio files</p>
          <p className="ego-privacy-note">Ego reads the saved project in this browser. It does not upload or run project scripts.</p>
        </section>
      </div>
    </div>
  );
}
