import { useState } from 'react';
import { GripVertical, Settings } from 'lucide-react';
import { SceneRenderFallback } from './_shared/scene-render-fallback';
import { createStarterCube } from './_shared/scene-model';
import './_group.css';

// Source-extracted editor shell. Runtime, storage and project hooks are stubbed
// at the boundary so this comparison cannot change a real saved project.
function Handle() {
  return <button className="workspace-panel-handle" aria-label="Panel drag handle"><GripVertical size={14} /></button>;
}
function Menu({ label }: { label: string }) {
  return <details className="workspace-browser-menu"><summary className="control-button">{label} <span className="control-chevron">⌄</span></summary><div className="workspace-browser-panel"><p className="panel-text">Extracted layout preview — the working system remains in the app.</p></div></details>;
}
function HorseMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 48 48" fill="none" role="img" aria-label="A fire horse encircling a flame">
      <circle cx="24" cy="24" r="11.5" stroke="currentColor" strokeWidth="1.35" />
      <path d="M24 17c1.8 3-.3 4.1 1.2 6.2 1.1 1.4 3.4 2 2.6 4.6-.6 2-2.7 3.1-4.8 2.4-2.5-.8-3.2-3.3-1.8-5.3.8-1.2 1.9-1.9 1.8-3.8-.1-1.4.3-2.7 1-4.1Z" fill="currentColor" />
      <path d="M12.4 20.2c1.4-7.2 7.8-12.4 15.5-12.4 8.8 0 15.9 7.1 15.9 15.9 0 7.2-4.8 13.3-11.4 15.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="m13.2 17.8 1.1-5.1 4.1 2.7 3.5-5.6 2.2 4.1 4.1-1.2 3.4 3.9 4.4 1.3 2.2 4.1-2.2 2.2-4.4.2-1.7 4.1-4.8 2.9-1.1 5.1-3.2-.4.8-6.2-4 3.4-2.7 4.2-3-.8 1.5-6.1-2.2-5.1 2-7.7Z" fill="currentColor" />
    </svg>
  );
}

export default function Current() {
  const [mode, setMode] = useState<'2d' | '3d'>('3d');
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(100);
  return (
    <main className="workspace madhorse-current" aria-label="Source-extracted Madhorse workspace">
      <div className="shell"><div className="workspace-board">
        <div data-workspace-panel="main">
          <header className="main-panel" aria-label="Main panel">
            <div className="main-panel-identity"><span className="panel-label">MAIN PANEL</span><Handle />
              <div className="brand" aria-label="Madhorse UI"><HorseMark /><span className="brand-name">MADHORSE<span>UI</span></span></div>
            </div>
            <span className="main-panel-divider" aria-hidden="true" />
            <div className="main-panel-controls"><Menu label="File" /><Menu label="Tools" />
              <button className="control-button scene-tab is-active">Scene Preview</button><button className="workspace-layout-reset">Reset layout</button>
            </div>
            <div className="system-status"><Settings className="system-status-cog" /><span className="system-loading-bar"><span /></span><span className="system-status-label">System ready</span><button className="system-wake-status">Keep awake</button></div>
          </header>
        </div>
        <div data-workspace-panel="scene">
          <section className="stage" id="scene-preview" aria-label="Scene preview">
            <div className="game-scene">
              <button className="scene-expand-button">Expand view</button>
              <div className="scene-view-tabs" role="tablist">
                <button className={mode === '3d' ? 'is-active' : ''} onClick={() => setMode('3d')}>3D Preview</button>
                <button className={mode === '2d' ? 'is-active' : ''} onClick={() => setMode('2d')}>Canvas</button>
              </div>
              {mode === '3d' ? <div style={{ position: 'absolute', inset: '70px 0 36px' }}>
                <SceneRenderFallback entities={[createStarterCube()]} settings={{ background: '#18191b', exposure: 1, showGrid: true, studioLighting: true }} zoom={zoom} selectedEntityId={null} onSelectEntity={() => {}} />
              </div> : <div className="scene-2d-view"><div className="scene-field"><button className="scene-player" style={{ left: '50%', top: '50%', width: 220, height: 220, transform: 'translate(-50%,-50%)' }} aria-label="Player" /></div></div>}
              <div className="scene-view-status">Perspective · Preview only</div>
              <div style={{ position: 'absolute', right: 8, bottom: 8 }}><button className="control-button" onClick={() => setZoom(Math.max(30, zoom - 10))}>−</button><span> {zoom}% </span><button className="control-button" onClick={() => setZoom(Math.min(180, zoom + 10))}>+</button></div>
            </div>
            <span className="frame-line frame-line-top" /><span className="frame-line frame-line-bottom" />
          </section>
        </div>
        <div data-workspace-panel="camera"><div className="workspace-camera-panel"><Handle /><details className="mh-camctl"><summary>Game Camera · North of the square</summary><p>Camera settings are preserved in the working app.</p></details></div></div>
        <div data-workspace-panel="tools-left"><div className="toolbar-group">
          <div className="workspace-panel-heading"><span className="panel-label">PANEL 2</span><Handle /></div>
          <div className="toolbar-buttons"><Menu label="Hierarchy" /><Menu label="Assets" /><Menu label="Data" /><Menu label="Mad Builder" /></div>
        </div></div>
        <div data-workspace-panel="tools-right"><div className="toolbar-group toolbar-group-right">
          <div className="workspace-panel-heading"><span className="panel-label">PANEL 1</span><Handle /></div>
          <div className="toolbar-buttons"><Menu label="Project" /><Menu label="Game Type" /><Menu label="Script" /></div>
        </div></div>
        <div data-workspace-panel="system"><div className="panel">
          <div className="workspace-panel-heading"><span className="panel-label">PANEL 3 / System</span><Handle /></div>
          <div className="system-panel-tools"><Menu label="Animations" /><Menu label="UI Controls" /><Menu label="Game Camera" /></div>
        </div></div>
        <div data-workspace-panel="play"><div className="panel">
          <div className="workspace-panel-heading"><span className="panel-label">PANEL 4 / Play / Test Game</span><Handle /></div>
          <div className="panel-play-actions"><button className="control-button" disabled={playing} onClick={() => setPlaying(true)}>Play</button><button className="control-button" disabled={!playing} onClick={() => setPlaying(false)}>Stop</button></div>
          <span className="panel-text">Design preview only. Game runtime remains in the app.</span>
        </div></div>
        <div data-workspace-panel="errors"><div className="panel">
          <div className="workspace-panel-heading"><span className="panel-label">PANEL 5 / System Debugger</span><Handle /></div>
          <div className="toolbar-buttons"><button className="control-button">All levels</button><button className="control-button">All sources</button><button className="control-button">Report</button><button className="control-button">Clear</button></div>
          <span className="panel-text">Script runtime: no active error.</span>
        </div></div>
      </div></div>
    </main>
  );
}
