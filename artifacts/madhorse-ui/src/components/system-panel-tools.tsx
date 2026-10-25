import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './system-panel-tools.css';
import { AnimationEditor } from '@/components/animation-editor';
import type { GameAnimation } from '@/lib/game-api';
import type { SceneEntity } from '@/lib/scene-model';
import { UI_BUTTON_ACTIONS, isUIButtonAction, type UIControlElement, type UIControlType } from '@/lib/ui-controls';
import type { GameCamera } from '@/lib/game-camera';
import { GameCameraSettings } from '@/components/game-camera-settings';

export function SystemPanelTools({
  gameCamera,
  cameraReadOnly,
  onCameraChange,
  onAimCamera,
  onShowGameView,
  readOnly,
  animations,
  entities,
  selectedEntityId,
  uiControls,
  selectedUIControlId,
  onAnimationsChange,
  onAnimationPreviewFrame,
  onCreateUIControl,
  onSelectUIControl,
  onUpdateUIControl,
  onDeleteUIControl,
}: {
  gameCamera: GameCamera;
  cameraReadOnly: boolean;
  onCameraChange: (camera: GameCamera) => void;
  onAimCamera: () => void;
  onShowGameView: () => void;
  readOnly: boolean;
  animations: GameAnimation[];
  entities: SceneEntity[];
  selectedEntityId: string | null;
  uiControls: UIControlElement[];
  selectedUIControlId: string | null;
  onAnimationsChange: (animations: GameAnimation[]) => void;
  onAnimationPreviewFrame: (animation: GameAnimation | null, time: number) => void;
  onCreateUIControl: (type: UIControlType) => void;
  onSelectUIControl: (id: string | null) => void;
  onUpdateUIControl: (id: string, changes: Partial<Omit<UIControlElement, 'id' | 'type'>>) => void;
  onDeleteUIControl: (id: string) => void;
}) {
  const uiControlsDetailsRef = useRef<HTMLDetailsElement>(null);
  const [uiControlsOpen, setUIControlsOpen] = useState(false);
  const [uiControlsMenuPosition, setUIControlsMenuPosition] = useState({ left: 8, bottom: 8 });
  const updateUIControlsMenuPosition = useCallback(() => {
    const details = uiControlsDetailsRef.current;
    const summary = details?.querySelector('summary');
    if (!summary) return;
    const bounds = summary.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 16);
    setUIControlsMenuPosition({
      left: Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8)),
      bottom: Math.max(8, window.innerHeight - bounds.top + 8),
    });
  }, []);
  useEffect(() => {
    if (!uiControlsOpen) return;
    updateUIControlsMenuPosition();
    window.addEventListener('resize', updateUIControlsMenuPosition);
    window.addEventListener('scroll', updateUIControlsMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateUIControlsMenuPosition);
      window.removeEventListener('scroll', updateUIControlsMenuPosition, true);
    };
  }, [uiControlsOpen, updateUIControlsMenuPosition]);

  return (
    <div className="system-panel-tools" role="group" aria-label="System tools">
      <details name="system-panel-tools">
        <summary className="control-button system-tool-button">Animations</summary>
        <AnimationEditor
          animations={animations}
          entities={entities}
          selectedEntityId={selectedEntityId}
          readOnly={readOnly}
          onChange={onAnimationsChange}
          onPreviewFrame={onAnimationPreviewFrame}
        />
      </details>
      <details name="system-panel-tools" ref={uiControlsDetailsRef} onToggle={(event) => setUIControlsOpen(event.currentTarget.open)}>
        <summary className="control-button system-tool-button">UI Controls</summary>
      </details>
      {uiControlsOpen && createPortal(
        <div
          id="system-panel-ui-controls-content"
          className="system-tool-content ui-controls-editor"
          role="region"
          aria-label="UI Controls menu"
          data-testid="ui-controls-menu"
          style={uiControlsMenuPosition}
        >
          <div className="ui-controls-heading">
            <strong>Game interface</strong>
            <span>Arrange 2D elements on the Canvas preview.</span>
          </div>
          <div className="ui-controls-add" role="group" aria-label="Add interface element">
            {([
              ['text', 'Add text'],
              ['button', 'Add button'],
              ['health-bar', 'Add health bar'],
              ['panel', 'Add panel'],
            ] as const).map(([type, label]) => (
              <button
                key={type}
                type="button"
                data-testid={`add-ui-control-${type}`}
                disabled={readOnly}
                onClick={() => onCreateUIControl(type)}
              >{label}</button>
            ))}
          </div>
          {uiControls.length === 0 ? (
            <p className="ui-controls-empty">Add an element to start building your game interface.</p>
          ) : (
            <div className="ui-controls-list" aria-label="Interface elements">
              {uiControls.map((element) => (
                <button
                  key={element.id}
                  type="button"
                  className={`ui-controls-item${selectedUIControlId === element.id ? ' is-selected' : ''}`}
                  aria-pressed={selectedUIControlId === element.id}
                  data-testid={`ui-control-item-${element.id}`}
                  onClick={() => onSelectUIControl(element.id)}
                >
                  <span>{element.label || element.type}</span>
                  <small>{element.type.replace('-', ' ')}</small>
                </button>
              ))}
            </div>
          )}
          {uiControls.find((element) => element.id === selectedUIControlId) && (() => {
            const selected = uiControls.find((element) => element.id === selectedUIControlId)!;
            return (
              <fieldset className="ui-controls-properties" disabled={readOnly}>
                <legend>Edit {selected.type.replace('-', ' ')}</legend>
                <label>
                  Label
                  <input
                    type="text"
                    maxLength={80}
                    value={selected.label}
                    data-testid="input-ui-control-label"
                    onChange={(event) => onUpdateUIControl(selected.id, { label: event.target.value })}
                  />
                </label>
                {selected.type === 'button' && (
                  <label className="ui-button-action-field">
                    On click (during Play)
                    <select
                      value={selected.action ?? 'none'}
                      data-testid="select-ui-button-action"
                      onChange={(event) => {
                        const action = event.target.value;
                        if (isUIButtonAction(action)) onUpdateUIControl(selected.id, { action });
                      }}
                    >
                      {UI_BUTTON_ACTIONS.map((action) => (
                        <option key={action.value} value={action.value}>{action.label}</option>
                      ))}
                    </select>
                    <span>Built-in actions only. Reset stops Play and restores the saved start; it does not change your project.</span>
                  </label>
                )}
                <div className="ui-controls-position">
                  <label>
                    X %
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={selected.x}
                      data-testid="input-ui-control-x"
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) onUpdateUIControl(selected.id, { x: Math.max(0, Math.min(100, value)) });
                      }}
                    />
                  </label>
                  <label>
                    Y %
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={selected.y}
                      data-testid="input-ui-control-y"
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) onUpdateUIControl(selected.id, { y: Math.max(0, Math.min(100, value)) });
                      }}
                    />
                  </label>
                </div>
                <div className="ui-controls-position">
                  <label>
                    Width
                    <input
                      type="number"
                      min="24"
                      max="1000"
                      value={selected.width}
                      data-testid="input-ui-control-width"
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) onUpdateUIControl(selected.id, { width: Math.max(24, Math.min(1000, value)) });
                      }}
                    />
                  </label>
                  <label>
                    Height
                    <input
                      type="number"
                      min="20"
                      max="500"
                      value={selected.height}
                      data-testid="input-ui-control-height"
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) onUpdateUIControl(selected.id, { height: Math.max(20, Math.min(500, value)) });
                      }}
                    />
                  </label>
                </div>
                <label>
                  Color
                  <input
                    type="color"
                    value={selected.color}
                    data-testid="input-ui-control-color"
                    onChange={(event) => onUpdateUIControl(selected.id, { color: event.target.value })}
                  />
                </label>
                <button
                  type="button"
                  className="ui-controls-delete"
                  data-testid={`delete-ui-control-${selected.id}`}
                  onClick={() => onDeleteUIControl(selected.id)}
                >Remove element</button>
              </fieldset>
            );
          })()}
          <p className="ui-controls-note" role="status">
            {readOnly ? 'Stop the game to edit interface elements.' : 'Drag elements on Canvas to arrange them. Changes save with this project.'}
          </p>
        </div>,
        document.body,
      )}
      <details name="system-panel-tools" data-testid="game-camera-tools">
        <summary className="control-button system-tool-button" data-testid="button-game-camera">Game Camera</summary>
        <div className="system-tool-content game-camera-tools" aria-label="Game Camera controls">
          <span>Canvas shows this camera’s view of your 3D scene.</span>
          <GameCameraSettings camera={gameCamera} readOnly={cameraReadOnly}
            onChange={onCameraChange} onReset={onAimCamera} />
          <button type="button" onClick={onShowGameView} data-testid="show-game-view">
            Show game view
          </button>
        </div>
      </details>
    </div>
  );
}
