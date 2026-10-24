import { useState } from 'react';
import { BookOpen, Bot, Boxes, Code2, Gamepad2, Layers3, X } from 'lucide-react';
import type { BuilderDocument } from '@/hooks/use-mad-builder';
import type { GameCamera } from '@/lib/game-camera';
import type { ScriptFile } from '@/lib/project-scripts';
import { analyzeEgoGameVision, egoGameLanguageLibrary } from '@/lib/ego-game-language';
import { EgoScriptStudio } from './ego-script-studio';
import {
  egoGameTypes,
  getEgoGameLabel,
  getEgoGameSelectionLabel,
  type EgoGameType,
} from '@/lib/ego-ui-kit';

type EgoAssistantProps = {
  project: BuilderDocument;
  animationsCount: number;
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
  sports: ['Create the playing field and add a Player Controller.', 'Use the score panel and stamina bar as your first HUD.', 'Add movement functions to the player; add sport-specific rules as the project grows.'],
  fighting: ['Add a player and an opponent to the scene.', 'Attach Fighting and Block functions to the player.', 'Use the health bars and round display as a starting HUD.'],
  rts: ['Create a terrain and add units to the scene.', 'Attach Command, Gather, and Build functions to a player unit.', 'Use the resource panel and selected-unit panel to plan the screen.'],
  card: ['Add a player object for the local card actions.', 'Attach Draw Card, Play Card, and End Turn functions.', 'Use the hand panel and energy display to arrange the card table.'],
  mmo: ['Create a player, NPCs, and a world area.', 'Attach supported combat, healing, and companion functions.', 'Use the quest, party, health, and mana panels as your first HUD.'],
  shooter: ['Add a Player Controller and a practice target.', 'Attach Shooting, Reload, and Crouch functions to the player.', 'Use Play/Test to try the controls; position the health and ammo displays.'],
  platformer: ['Create platforms and add a Player Controller.', 'Attach Running, Crouching, and Fighting functions as needed.', 'Use the health, lives, and pause controls as a starter HUD.'],
};

function projectScan(project: BuilderDocument, animationsCount: number) {
  const components = project.entities.flatMap((entity) => entity.components);
  const assetCounts = { image: 0, model: 0, audio: 0, data: 0 };
  for (const asset of project.assets) assetCounts[asset.kind]++;
  let boardCounts = { nodes: 0, images: 0, menus: 0, audio: 0 };
  try {
    const savedPanels = JSON.parse(localStorage.getItem('madhorse.vision-board-panels.v2') ?? '[]') as unknown;
    if (Array.isArray(savedPanels)) {
      boardCounts = { nodes: savedPanels.length, images: 0, menus: 0, audio: 0 };
      for (const panel of savedPanels) {
        if (!panel || typeof panel !== 'object') continue;
        const kind = (panel as { kind?: unknown }).kind;
        if (kind === 'image') boardCounts.images++;
        if (kind === 'menu-screen') boardCounts.menus++;
        if (kind === 'audio') boardCounts.audio++;
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
    prefabs: project.prefabs?.length ?? 0,
    builds: project.builderBuildLogs?.length ?? 0,
    assets: assetCounts,
    board: boardCounts,
  };
}

export function EgoAssistant({
  project, animationsCount, onBuildUi, onAddFunctions, scripts, camera, selectedEntityId,
  onCreateScript, onUpdateScript, onDeleteScript, onClose,
}: EgoAssistantProps) {
  const [gameTypes, setGameTypes] = useState<EgoGameType[]>(['rpg']);
  const [gameVision, setGameVision] = useState('');
  const [phraseFilter, setPhraseFilter] = useState('');
  const [activityLog, setActivityLog] = useState<Array<{ id: string; action: string; detail: string; time: string }>>([]);
  const [activeTab, setActiveTab] = useState<'build' | 'guide' | 'scripts'>('build');
  const scan = projectScan(project, animationsCount);
  const gameLabel = getEgoGameSelectionLabel(gameTypes);
  const visionAnalysis = analyzeEgoGameVision(gameVision);
  const visiblePhrases = egoGameLanguageLibrary.filter((entry) =>
    `${entry.label} ${entry.phrases.join(' ')} ${entry.explanation} ${entry.engineArea}`
      .toLowerCase().includes(phraseFilter.trim().toLowerCase()));

  const toggleGameType = (gameType: EgoGameType) => {
    setGameTypes(current => current.includes(gameType)
      ? current.length > 1 ? current.filter(type => type !== gameType) : current
      : [...current, gameType]);
  };

  const recordAction = (action: string, run: () => string) => {
    try {
      const detail = run();
      setActivityLog(current => [...current, {
        id: crypto.randomUUID(),
        action,
        detail,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }].slice(-20));
    } catch (failure) {
      setActivityLog(current => [...current, {
        id: crypto.randomUUID(),
        action: `${action} — needs attention`,
        detail: failure instanceof Error ? failure.message : 'This action could not be completed.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }].slice(-20));
    }
  };

  return (
    <div className="ego-assistant" data-testid="ego-assistant">
      <header className="ego-assistant-header">
        <div className="ego-assistant-title">
          <span className="ego-assistant-robot"><Bot size={18} aria-hidden="true" /></span>
          <div>
            <h2>Ego</h2>
            <p>Project-aware UI builder and step-by-step guide</p>
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
            <label className="ego-field">
              <span>Your game vision</span>
              <textarea
                value={gameVision}
                onChange={(event) => setGameVision(event.target.value)}
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
            </fieldset>
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
                    </article>
                  ))}
                </div>
              ) : (
                <p className="ego-vision-hint">
                  {visionAnalysis.unmatched || 'Write your idea in everyday words. Try who the player is, what they do, and what they are trying to finish.'}
                </p>
              )}
              <div className="ego-vision-milestones" aria-label="Game build milestones">
                <article><b>START</b><span>{visionAnalysis.start}</span></article>
                <article><b>MISSION</b><span>{visionAnalysis.mission}</span></article>
                <article><b>FINISH</b><span>{visionAnalysis.finish}</span></article>
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
              <button type="button" onClick={() => recordAction('Built UI kit', () => onBuildUi(gameTypes, gameVision.trim()))} data-testid="ego-build-ui">
                <Layers3 size={15} aria-hidden="true" /> {gameTypes.length > 1 ? 'Create mixed UI kit' : `Create ${getEgoGameLabel(gameTypes[0])} UI kit`}
              </button>
              <button type="button" className="secondary" onClick={() => recordAction('Added game functions', () => onAddFunctions(gameTypes))} data-testid="ego-add-functions">
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
                    <small>Action estimate: completed immediately. This is not a full-game build.</small>
                  </article>
                )) : (
                  <p className="ego-work-log-empty">Ego has not changed this project during this session. Full-game completion estimates are not available until a complete game-build and export pipeline is connected.</p>
                )}
              </div>
            </section>
            <p className="ego-capability-note">
              Ego uses editable UI templates and supported engine actions. It creates a Player Controller if the project has no player yet. Full-game publishing is not available in this build.
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
            <ol>
              <li>Choose one or more game types and describe the idea you want to make.</li>
              <li>Create the UI kit. Its text, panels, buttons, and bars are added to this project.</li>
              <li>Add game functions. Ego connects supported actions to the Player Controller.</li>
              <li>Close Ego, open UI Controls to move and edit the new elements, then use Play/Test.</li>
            </ol>
            {gameTypes.map(gameType => (
              <section className="ego-guide-game" key={gameType}>
                <h4>{getEgoGameLabel(gameType)} setup</h4>
                <ol>{guideByGame[gameType].map((step) => <li key={step}>{step}</li>)}</ol>
              </section>
            ))}
            <p className="ego-capability-note">Function actions are engine presets, not generated code. Review each object in Hierarchy to edit its settings.</p>
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
            <span><b>{scan.prefabs}</b> prefabs</span>
            <span><b>{scan.builds}</b> Mad Builder builds</span>
            <span><b>{scan.players}</b> player objects</span>
            <span><b>{scan.scripts}</b> safe script slots</span>
            <span><b>{scan.board.nodes}</b> Vision Board nodes</span>
          </div>
          <p className="ego-asset-summary">Assets: {scan.assets.image} images · {scan.assets.model} models · {scan.assets.audio} audio · {scan.assets.data} data</p>
          <p className="ego-asset-summary">Vision Board: {scan.board.images} images · {scan.board.menus} menu screens · {scan.board.audio} audio files</p>
          <p className="ego-privacy-note">Ego reads the saved project in this browser. It does not upload or run project scripts.</p>
        </section>
      </div>
    </div>
  );
}
