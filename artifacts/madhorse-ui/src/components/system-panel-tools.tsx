import './system-panel-tools.css';

export function SystemPanelTools({ onAimCamera, onShowGameView, readOnly }: {
  onAimCamera: () => void;
  onShowGameView: () => void;
  readOnly: boolean;
}) {
  return (
    <div className="system-panel-tools" role="group" aria-label="System tools">
      <details name="system-panel-tools">
        <summary className="control-button system-tool-button">Animations</summary>
        <div id="system-panel-animations-content" className="system-tool-content" aria-label="Animations menu" />
      </details>
      <details name="system-panel-tools">
        <summary className="control-button system-tool-button">UI Controls</summary>
        <div id="system-panel-ui-controls-content" className="system-tool-content" aria-label="UI Controls menu" />
      </details>
      <details name="system-panel-tools" data-testid="game-camera-tools">
        <summary className="control-button system-tool-button" data-testid="button-game-camera">Game Camera</summary>
        <div className="system-tool-content game-camera-tools" aria-label="Game Camera controls">
          <span>Canvas shows this camera’s view of your 3D scene.</span>
          <button type="button" onClick={onAimCamera} disabled={readOnly} data-testid="aim-game-camera">
            Aim at square
          </button>
          <button type="button" onClick={onShowGameView} data-testid="show-game-view">
            Show game view
          </button>
        </div>
      </details>
    </div>
  );
}
