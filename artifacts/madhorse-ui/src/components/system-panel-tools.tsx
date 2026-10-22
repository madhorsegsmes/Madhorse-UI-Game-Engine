import './system-panel-tools.css';

export function SystemPanelTools() {
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
    </div>
  );
}
