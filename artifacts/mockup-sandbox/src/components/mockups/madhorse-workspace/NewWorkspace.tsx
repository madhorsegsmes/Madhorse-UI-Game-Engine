import { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Aperture, ArrowDownToLine, Box, Braces, Camera,
  Check, ChevronDown, CircleHelp, Code2, Command, Copy, Cuboid, Eye, FilePlus2,
  Film, FolderOpen, Grid2X2, Image, Layers3, Lightbulb, Link2, ListTree, Minus,
  MoreHorizontal, Move3D, PanelLeft, Play, Plus, Rotate3D, Ruler, Save, Search,
  Send, Settings2, ShieldCheck, Square, Sun, Upload, WandSparkles, X,
} from 'lucide-react';
import { SceneRenderFallback } from './_shared/scene-render-fallback';
import {
  createSceneEntity, createStarterCube, createTransformComponent,
  type SceneEntity,
} from './_shared/scene-model';
import type { SceneRenderSettings } from './_shared/use-scene-render-settings';
import './new-workspace.css';

type WorkspaceTab = 'Hierarchy' | 'Assets' | 'Data' | 'Mad Builder' | 'Animations' | 'UI Controls' | 'Game Camera' | 'Scripts' | 'Debugger';
type EntityKind = 'Object' | 'UI canvas' | 'Plane' | 'Terrain' | 'Lighting' | 'Camera' | 'Prefab' | 'Texture';

const gameTypes = ['RTS', 'RPG', 'MMO', 'Arena fighting', 'Card game', 'Sports', 'Racing'];
const languages = ['JavaScript', 'TypeScript', 'Python', 'Lua', 'C', 'C++', 'C#'];
const initialDebuggerRows = [
  { level: 'INFO', source: 'Scene', text: 'Starter scene initialized', time: '09:41:02' },
  { level: 'WARN', source: 'Assets', text: 'No external assets in this design preview', time: '09:40:58' },
  { level: 'INFO', source: 'Renderer', text: 'SVG solid-mesh renderer active', time: '09:40:54' },
  { level: 'INFO', source: 'System', text: 'Preview session ready', time: '09:40:52' },
];

function HorseMark() {
  return <svg className="mhx-mark" viewBox="0 0 48 48" fill="none" aria-label="Madhorse flame horse">
    <circle cx="24" cy="24" r="11.5" stroke="currentColor" strokeWidth="1.35" />
    <path d="M24 17c1.8 3-.3 4.1 1.2 6.2 1.1 1.4 3.4 2 2.6 4.6-.6 2-2.7 3.1-4.8 2.4-2.5-.8-3.2-3.3-1.8-5.3.8-1.2 1.9-1.9 1.8-3.8-.1-1.4.3-2.7 1-4.1Z" fill="currentColor" />
    <path d="M12.4 20.2c1.4-7.2 7.8-12.4 15.5-12.4 8.8 0 15.9 7.1 15.9 15.9 0 7.2-4.8 13.3-11.4 15.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="m13.2 17.8 1.1-5.1 4.1 2.7 3.5-5.6 2.2 4.1 4.1-1.2 3.4 3.9 4.4 1.3 2.2 4.1-2.2 2.2-4.4.2-1.7 4.1-4.8 2.9-1.1 5.1-3.2-.4.8-6.2-4 3.4-2.7 4.2-3-.8 1.5-6.1-2.2-5.1 2-7.7Z" fill="currentColor" />
  </svg>;
}

function IconButton({ label, children, onClick, active = false }: { label: string; children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  return <button type="button" className={`mhx-icon-button${active ? ' active' : ''}`} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

export default function NewWorkspace() {
  const [project, setProject] = useState('Ashen Vale — Prototype');
  const [gameType, setGameType] = useState('RPG');
  const [tab, setTab] = useState<WorkspaceTab>('Hierarchy');
  const [view, setView] = useState<'3D Scene' | '2D Canvas'>('3D Scene');
  const [zoom, setZoom] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [plan, setPlan] = useState(false);
  const [projectToast, setProjectToast] = useState('All changes stay in this prototype');
  const [entities, setEntities] = useState<SceneEntity[]>(() => {
    const cube = createStarterCube();
    const camera = createSceneEntity('Main Camera', { x: 50, y: 50, z: 0 }, null, false);
    camera.components = [
      createTransformComponent({ x: 50, y: 42, z: 0 }),
      { id: 'prototype-camera', type: 'camera', enabled: true, fov: 50, target: { x: 50, y: 50, z: 0 } },
    ];
    return [cube, camera];
  });
  const [selected, setSelected] = useState('starter-cube');
  const [settings, setSettings] = useState<SceneRenderSettings>({
    showGrid: true, studioLighting: true, exposure: 1, background: '#17191c',
  });
  const [showSettings, setShowSettings] = useState(false);
  const [debugSearch, setDebugSearch] = useState('');
  const [debugLevel, setDebugLevel] = useState('ALL');
  const [debugRows, setDebugRows] = useState(initialDebuggerRows);
  const [scriptLanguage, setScriptLanguage] = useState('TypeScript');
  const [scriptName, setScriptName] = useState('movement.ts');
  const [script, setScript] = useState('export function update(delta: number) {\\n  // Design preview only\\n}');
  const [scriptStatus, setScriptStatus] = useState('Sandbox idle · no code executed');
  const [animationTime, setAnimationTime] = useState(38);
  const [cameraMode, setCameraMode] = useState('Perspective');
  const [showFileMenu, setShowFileMenu] = useState(false);
  const selectedEntity = entities.find((entity) => entity.id === selected) ?? entities[0];
  const visibleDebug = useMemo(() => debugRows.filter((row) =>
    (debugLevel === 'ALL' || row.level === debugLevel) &&
    `${row.level} ${row.source} ${row.text}`.toLowerCase().includes(debugSearch.toLowerCase()),
  ), [debugLevel, debugSearch]);

  function addEntity(kind: EntityKind) {
    const name = kind === 'Object' ? 'New Object' : kind;
    const entity = createSceneEntity(name, { x: 54, y: 48, z: 0 }, null, false);
    if (kind === 'Plane' || kind === 'Terrain') {
      entity.components.push({ id: `primitive-${Date.now()}`, type: 'primitive', enabled: true, shape: kind === 'Plane' ? 'plane' : 'terrain', color: '#858a90', textureAssetId: null });
    } else if (kind === 'Lighting') {
      entity.components.push({ id: `light-${Date.now()}`, type: 'light', enabled: true, kind: 'directional', color: '#f4e6cf', intensity: 1 });
    } else if (kind === 'Camera') {
      entity.components.push({ id: `camera-${Date.now()}`, type: 'camera', enabled: true, fov: 50, target: { x: 50, y: 50, z: 0 } });
    } else if (kind === 'UI canvas') {
      entity.components.push({ id: `canvas-${Date.now()}`, type: 'uiCanvas', enabled: true, controlId: 'prototype-canvas' });
    }
    setEntities((items) => [...items, entity]);
    setSelected(entity.id);
    setTab('Hierarchy');
  }

  function chooseTab(next: WorkspaceTab) { setTab(next); }
  function setPreviewMessage(message: string) {
    setProjectToast(message);
    window.setTimeout(() => setProjectToast('All changes stay in this prototype'), 2800);
  }

  return (
    <main className="mhx-root" aria-label="Madhorse Engine design preview">
      <header className="mhx-topbar">
        <div className="mhx-brand"><span className="mhx-brandmark"><HorseMark /></span><span className="mhx-brandname">MADHORSE <b>ENGINE</b></span><span className="mhx-version">UI / 02</span></div>
        <div className="mhx-project">
          <span className="mhx-project-label">PROJECT</span>
          <input aria-label="Project name" value={project} onChange={(event) => setProject(event.target.value)} />
          <button className="mhx-chevron" onClick={() => setShowFileMenu((value) => !value)} aria-label="Project actions"><ChevronDown size={15} /></button>
          {showFileMenu && <div className="mhx-menu mhx-project-menu">
            <button onClick={() => { setProject('Untitled Project'); setShowFileMenu(false); setPreviewMessage('New project preview created locally'); }}><FilePlus2 size={14} /> New project preview</button>
            <button onClick={() => setPreviewMessage('Project browser is a non-persistent preview')}><FolderOpen size={14} /> Browse projects</button>
            <button onClick={() => setPreviewMessage('Save preview — no project data was written')}><Save size={14} /> Save design preview</button>
            <button onClick={() => setPreviewMessage('Rename using the project name field')}><MoreHorizontal size={14} /> Rename project</button>
          </div>}
        </div>
        <div className="mhx-header-actions">
          <span className="mhx-session"><i /> DESIGN PREVIEW</span>
          <button className="mhx-save" onClick={() => setPreviewMessage('Save is visual-only; saved project data is unchanged')}><Save size={14} /> <span>Save</span></button>
          <button className="mhx-user">MH</button>
        </div>
      </header>

      <div className="mhx-commandbar">
        <div className="mhx-crumb"><span>WORKSPACE</span><b>/</b><strong>{project}</strong></div>
        <div className="mhx-top-controls">
          <button className="mhx-flat-button mhx-menu-trigger" onClick={() => setShowFileMenu((value) => !value)}><FolderOpen size={13} /> File</button>
          <button className="mhx-flat-button mhx-menu-trigger" onClick={() => { setShowSettings(true); setPreviewMessage('Render tools opened'); }}><Settings2 size={13} /> Tools</button>
          <details className="mhx-select-wrap"><summary><span>GAME TYPE</span><strong>{gameType}</strong><ChevronDown size={13} /></summary><div className="mhx-menu mhx-game-menu">{gameTypes.map((type) => <button key={type} onClick={() => { setGameType(type); setPreviewMessage(`${type} selected in local preview`); }}>{type}</button>)}</div></details>
          <button className="mhx-flat-button" onClick={() => setPreviewMessage('Layout restored to the design preview default')}><PanelLeft size={14} /> Reset layout</button>
          <div className="mhx-sysstate"><Settings2 size={14} /><span className="mhx-progress"><i /></span><span>System ready</span></div>
        </div>
      </div>

      <div className="mhx-workspace">
        <nav className="mhx-rail" aria-label="Workspace tools">
          <div className="mhx-rail-group">
            <IconButton label="Hierarchy" active={tab === 'Hierarchy'} onClick={() => chooseTab('Hierarchy')}><ListTree /></IconButton>
            <IconButton label="Assets" active={tab === 'Assets'} onClick={() => chooseTab('Assets')}><Layers3 /></IconButton>
            <IconButton label="Data" active={tab === 'Data'} onClick={() => chooseTab('Data')}><ShieldCheck /></IconButton>
            <span className="mhx-rail-separator" />
            <IconButton label="Mad Builder" active={tab === 'Mad Builder'} onClick={() => chooseTab('Mad Builder')}><WandSparkles /></IconButton>
            <IconButton label="Animations" active={tab === 'Animations'} onClick={() => chooseTab('Animations')}><Film /></IconButton>
            <IconButton label="UI Controls" active={tab === 'UI Controls'} onClick={() => chooseTab('UI Controls')}><Grid2X2 /></IconButton>
            <IconButton label="Game Camera" active={tab === 'Game Camera'} onClick={() => chooseTab('Game Camera')}><Camera /></IconButton>
            <IconButton label="Scripts" active={tab === 'Scripts'} onClick={() => chooseTab('Scripts')}><Code2 /></IconButton>
            <IconButton label="System Debugger" active={tab === 'Debugger'} onClick={() => chooseTab('Debugger')}><Activity /></IconButton>
          </div>
          <div className="mhx-rail-bottom"><IconButton label="Help"><CircleHelp /></IconButton><span className="mhx-rail-mark">M</span></div>
        </nav>

        <aside className="mhx-left-panel">
          <div className="mhx-panel-head"><div><span className="mhx-overline">{tab === 'Debugger' ? 'PANEL 5 · SYSTEM DEBUGGER' : ['Animations', 'UI Controls', 'Game Camera'].includes(tab) ? 'PANEL 3 · SYSTEM' : tab === 'Scripts' ? 'PANEL 1 · PROJECT' : 'PANEL 2 · PROJECT'}</span><h2>{tab}</h2></div><button className="mhx-plain-icon" aria-label="Panel options"><MoreHorizontal size={17} /></button></div>
          {tab === 'Hierarchy' && <>
            <div className="mhx-hier-actions"><button className="mhx-add-button" onClick={() => addEntity('Object')}><Plus size={14} /> Add object</button><button className="mhx-plain-icon" onClick={() => setPreviewMessage('Hierarchy filter is ready')} aria-label="Search hierarchy"><Search size={15} /></button></div>
            <div className="mhx-tree">
              <div className="mhx-tree-root"><ChevronDown size={13} /><Layers3 size={14} /><span>Scene</span><small>{entities.length} items</small></div>
              {entities.map((entity) => {
                const camera = entity.components.some((component) => component.type === 'camera');
                const primitive = entity.components.find((component) => component.type === 'primitive');
                return <button key={entity.id} className={`mhx-tree-row${selected === entity.id ? ' selected' : ''}`} onClick={() => setSelected(entity.id)}>
                  <span className="mhx-tree-indent" />{camera ? <Camera size={14} /> : primitive ? <Square size={14} /> : <Box size={14} />}
                  <span>{entity.name}</span>{selected === entity.id && <span className="mhx-row-state">ACTIVE</span>}
                </button>;
              })}
            </div>
            <div className="mhx-create-tools"><span className="mhx-overline">CREATE</span><div className="mhx-create-grid">
              {(['UI canvas', 'Plane', 'Terrain', 'Lighting', 'Camera', 'Prefab', 'Texture'] as EntityKind[]).map((kind) => <button key={kind} onClick={() => kind === 'Prefab' || kind === 'Texture' ? setPreviewMessage(`${kind} creation is shown as a design-preview affordance`) : addEntity(kind)}>
                {kind === 'UI canvas' ? <Grid2X2 /> : kind === 'Plane' ? <Square /> : kind === 'Terrain' ? <Ruler /> : kind === 'Lighting' ? <Lightbulb /> : kind === 'Camera' ? <Camera /> : kind === 'Prefab' ? <Copy /> : <Image />}
                <span>{kind}</span>
              </button>)}
            </div></div>
            <div className="mhx-panel-foot"><Link2 size={13} /><span>Drag items to link / unlink parent</span></div>
          </>}
          {tab === 'Assets' && <div className="mhx-tab-content"><div className="mhx-empty-asset"><div className="mhx-empty-icon"><FolderOpen /></div><strong>Asset library</strong><p>Models, sprites, materials, textures and prefabs appear here.</p><button className="mhx-outline-button" onClick={() => setPreviewMessage('Import is a prototype affordance; no files are uploaded')}><Upload size={14} /> Import asset</button></div><div className="mhx-asset-types">{['3D Models', 'Sprites', 'Materials', 'Textures', 'Prefabs'].map((label) => <button key={label} onClick={() => setPreviewMessage(`${label} collection selected`)}><ChevronDown size={13} />{label}<small>0</small></button>)}</div></div>}
          {tab === 'Data' && <div className="mhx-tab-content"><div className="mhx-data-callout"><ShieldCheck /><strong>Protected system data</strong><p>Engine references are read-only. Game rules and project values can be edited separately.</p></div><div className="mhx-data-list"><button onClick={() => setPreviewMessage('System references are protected')}><span>System references</span><b>LOCKED</b></button><button onClick={() => setPreviewMessage('Game rules opened in preview')}><span>Game rules</span><b>EDITABLE</b></button><button onClick={() => setPreviewMessage('Project values opened in preview')}><span>Project values</span><b>EDITABLE</b></button></div><button className="mhx-outline-button" onClick={() => setPreviewMessage('Rule editor is a visual-only affordance')}><Plus size={14} /> Add game rule</button></div>}
          {tab === 'Mad Builder' && <div className="mhx-tab-content mhx-builder"><div className="mhx-builder-note"><WandSparkles /><div><b>Mad Builder</b><p>Describe a scene change. This mockup will only draft a plan.</p></div></div><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Add a stone bridge beside the starter cube…" aria-label="Mad Builder prompt" /><button className="mhx-primary-button" onClick={() => { setPlan(true); setPreviewMessage('Design plan generated locally — no AI request was sent'); }} disabled={!prompt.trim()}><Send size={14} /> Draft construction plan</button>{plan && <div className="mhx-plan"><div><span className="mhx-overline">DESIGN PREVIEW PLAN</span><button onClick={() => setPlan(false)} aria-label="Dismiss plan"><X size={14} /></button></div><p>1. Add a scene object: “{prompt || 'New scene element'}”</p><p>2. Place near the selected object</p><button className="mhx-outline-button" onClick={() => setPreviewMessage('Apply is disabled in this design-only preview')}><Check size={14} /> Apply preview plan</button><small>No project changes will be made.</small></div>}</div>}
          {tab === 'Scripts' && <div className="mhx-tab-content mhx-scripts">
            <div className="mhx-script-file"><Braces size={14} /><input value={scriptName} onChange={(event) => setScriptName(event.target.value)} aria-label="Script filename" /><MoreHorizontal size={16} /></div>
            <div className="mhx-script-tools"><select value={scriptLanguage} onChange={(event) => setScriptLanguage(event.target.value)} aria-label="Script language">{languages.map((language) => <option key={language}>{language}</option>)}</select><button onClick={() => setPreviewMessage('Import script preview only — file contents are not read')}><Upload size={13} /> Import</button><button onClick={() => { setScriptName(`new-script.${scriptLanguage === 'TypeScript' ? 'ts' : scriptLanguage === 'JavaScript' ? 'js' : scriptLanguage.toLowerCase()}`); setScript(''); setPreviewMessage('Blank script created in local editor state'); }}><Plus size={13} /> Create</button></div>
            <textarea className="mhx-code-editor" spellCheck={false} value={script} onChange={(event) => setScript(event.target.value)} aria-label="Script editor" />
            <div className="mhx-script-run"><button className="mhx-primary-button" onClick={() => setScriptStatus('Run isolated · simulated only; source was not executed')}><Play size={13} /> Run isolated</button><span>{scriptStatus}</span></div>
            <p className="mhx-safety-copy">Runs never reach a real runtime in this preview.</p>
          </div>}
          {tab === 'Animations' && <div className="mhx-tab-content"><div className="mhx-section-title"><Film size={15} /> Animation timeline <button onClick={() => setPreviewMessage('New animation is a local preview affordance')}><Plus size={15} /></button></div><button className="mhx-animation-row" onClick={() => setAnimationTime((time) => (time + 10) % 100)}><span>Idle / Cube</span><small>0:02.4</small><ChevronDown size={13} /></button><div className="mhx-scrub"><div className="mhx-ticks"><span>00:00</span><span>00:01</span><span>00:02</span><span>00:03</span></div><input type="range" min="0" max="100" value={animationTime} onChange={(event) => setAnimationTime(Number(event.target.value))} aria-label="Scrub animation timeline" /><div className="mhx-keyframes"><i /><i /><i /></div><p>Scrub preview · {((animationTime / 100) * 2.4).toFixed(2)} sec</p></div><button className="mhx-outline-button" onClick={() => setPreviewMessage('Animation keyframes remain preview-only')}><Plus size={14} /> Add keyframe</button></div>}
          {tab === 'UI Controls' && <div className="mhx-tab-content"><div className="mhx-data-callout"><Grid2X2 /><strong>Canvas controls</strong><p>Create interface elements on the selected 2D canvas.</p></div><div className="mhx-ui-list">{['Button', 'Text label', 'Panel', 'Health bar', 'Image'].map((item) => <button key={item} onClick={() => { setView('2D Canvas'); setPreviewMessage(`${item} added to local canvas preview`); }}><Plus size={14} />{item}</button>)}</div><button className="mhx-outline-button" onClick={() => setView('2D Canvas')}><Eye size={14} /> Open 2D canvas</button></div>}
          {tab === 'Game Camera' && <div className="mhx-tab-content"><div className="mhx-camera-preview"><Camera /><span>CAMERA · NORTH</span><b>50 mm</b></div><div className="mhx-control-field"><label>Projection</label><select value={cameraMode} onChange={(event) => setCameraMode(event.target.value)}><option>Perspective</option><option>Orthographic</option></select></div><div className="mhx-control-field"><label>Field of view <b>50°</b></label><input type="range" min="20" max="100" defaultValue="50" /></div><div className="mhx-control-field"><label>Camera position</label><div className="mhx-number-row"><input value="0.0" readOnly /><input value="6.0" readOnly /><input value="-8.0" readOnly /></div></div><p className="mhx-hint">Camera controls sit outside the 2D canvas preview.</p></div>}
          {tab === 'Debugger' && <div className="mhx-tab-content"><div className="mhx-debug-controls"><label><Search size={13} /><input value={debugSearch} onChange={(event) => setDebugSearch(event.target.value)} placeholder="Search messages" /></label><select value={debugLevel} onChange={(event) => setDebugLevel(event.target.value)}><option>ALL</option><option>INFO</option><option>WARN</option><option>ERROR</option></select></div><div className="mhx-debug-list">{visibleDebug.map((row) => <article key={row.time}><span className={`mhx-level ${row.level.toLowerCase()}`}>{row.level}</span><div><b>{row.source}</b><p>{row.text}</p><small>{row.time}</small></div></article>)}{visibleDebug.length === 0 && <div className="mhx-empty-debug">No messages match this filter.</div>}</div><div className="mhx-debug-actions"><button onClick={() => setPreviewMessage('Report prepared from public preview messages only')}><ArrowDownToLine size={13} /> Report</button><button onClick={() => { setDebugRows([]); setPreviewMessage('Public preview messages cleared locally'); }}><X size={13} /> Clear</button></div><p className="mhx-safety-copy">Prototype messages only. No private runtime logs.</p></div>}
        </aside>

        <section className="mhx-center">
          <div className="mhx-scene-header">
            <div className="mhx-view-tabs" role="tablist" aria-label="Scene view">
              {(['3D Scene', '2D Canvas'] as const).map((mode) => <button key={mode} role="tab" aria-selected={view === mode} className={view === mode ? 'selected' : ''} onClick={() => setView(mode)}>{mode === '3D Scene' ? <Cuboid size={14} /> : <Grid2X2 size={14} />}{mode}</button>)}
            </div>
            <div className="mhx-scene-actions">
              <div className="mhx-toolstrip"><IconButton label="Select tool" active><Command /></IconButton><IconButton label="Move tool"><Move3D /></IconButton><IconButton label="Rotate tool"><Rotate3D /></IconButton><IconButton label="Scale tool"><Aperture /></IconButton></div>
              <span className="mhx-tool-divider" />
              <button className="mhx-flat-button" onClick={() => setShowSettings((value) => !value)}><Settings2 size={14} /> Render</button>
              <button className="mhx-flat-button mhx-frame-btn" onClick={() => { setZoom(100); setPreviewMessage('Scene framed to selection'); }}><Eye size={14} /> Frame</button>
            </div>
          </div>
          <div className="mhx-scene-meta"><span><i className="mhx-red-dot" />{view === '3D Scene' ? 'SOLID VIEW' : 'CANVAS VIEW'}</span><span>{cameraMode.toUpperCase()} · MAIN CAMERA NORTH</span><span className="mhx-meta-right">LOCAL DESIGN PREVIEW</span></div>
          <div className="mhx-viewport" style={{ resize: 'both' }}>
            {view === '3D Scene' ? <div className="mhx-render-host"><SceneRenderFallback entities={entities} settings={settings} zoom={zoom} selectedEntityId={selected} onSelectEntity={setSelected} /></div> :
              <div className="mhx-canvas-view"><div className="mhx-canvas-artboard"><span className="mhx-artboard-label">GAME CANVAS · 1920 × 1080</span><div className="mhx-ui-demo">HUD · HEALTH 100</div><div className="mhx-ui-demo mhx-ui-button">START GAME</div></div><div className="mhx-canvas-note">2D interface canvas · camera controls remain available in Panel 3</div></div>}
            <div className="mhx-axis"><span>X</span><span>Y</span><span>Z</span></div>
            <div className="mhx-object-tags"><span><Box size={12} /> Cube</span><span><Camera size={12} /> Main Camera</span><span><Grid2X2 size={12} /> Ground grid</span></div>
            <div className="mhx-camera-control"><Camera size={13} /><span>MAIN CAMERA</span><button onClick={() => setPreviewMessage('Camera pose controls available in Panel 3')}><Settings2 size={13} /></button></div>
            {showSettings && <div className="mhx-render-popover"><div><b>Render settings</b><button onClick={() => setShowSettings(false)} aria-label="Close render settings"><X size={14} /></button></div><label><input type="checkbox" checked={settings.showGrid} onChange={(event) => setSettings((s) => ({ ...s, showGrid: event.target.checked }))} /> Show grid</label><label><input type="checkbox" checked={settings.studioLighting} onChange={(event) => setSettings((s) => ({ ...s, studioLighting: event.target.checked }))} /> Studio lighting</label><label>Exposure <input type="range" min=".5" max="1.6" step=".1" value={settings.exposure} onChange={(event) => setSettings((s) => ({ ...s, exposure: Number(event.target.value) }))} /></label><label>Background <input type="color" value={settings.background} onChange={(event) => setSettings((s) => ({ ...s, background: event.target.value }))} /></label><small>Session-only values · not saved</small></div>}
          </div>
          <div className="mhx-viewport-footer"><span><i /> {selectedEntity?.name ?? 'No selection'}</span><span>GRID {settings.showGrid ? 'ON' : 'OFF'} · UNIT 1.0</span><div className="mhx-zoom"><button onClick={() => setZoom((value) => Math.max(30, value - 10))} aria-label="Zoom out"><Minus size={13} /></button><span>{zoom}%</span><button onClick={() => setZoom((value) => Math.min(180, value + 10))} aria-label="Zoom in"><Plus size={13} /></button><button onClick={() => setZoom(100)} aria-label="Reset zoom">FIT</button></div></div>
          <div className="mhx-playbar"><div className="mhx-play-tools"><span className="mhx-overline">PANEL 4 · PLAY / TEST</span><button className="mhx-play-button" onClick={() => { setPlaying(true); setPreviewMessage('Play state simulated — no game runtime started'); }} disabled={playing}><Play size={14} fill="currentColor" /> Play</button><button className="mhx-stop-button" onClick={() => { setPlaying(false); setPreviewMessage('Preview stopped'); }} disabled={!playing}><Square size={13} /> Stop</button></div><span className={`mhx-play-status${playing ? ' running' : ''}`}><i />{playing ? 'SIMULATED PLAY MODE' : 'READY FOR TEST'}</span><span className="mhx-prototype-note">No project or runtime changes</span></div>
          <div className="mhx-resize-corner" aria-hidden="true" />
        </section>

        <aside className="mhx-inspector">
          <div className="mhx-panel-head"><div><span className="mhx-overline">INSPECTOR</span><h2>{selectedEntity?.name || 'Selection'}</h2></div><button className="mhx-plain-icon" aria-label="Inspector options"><MoreHorizontal size={17} /></button></div>
          <div className="mhx-inspector-breadcrumb"><span>SCENE</span><b>/</b><strong>{selectedEntity?.name || '—'}</strong></div>
          <div className="mhx-inspector-section"><div className="mhx-section-title"><Move3D size={14} /> Transform <ChevronDown size={13} /></div>{['Position', 'Rotation', 'Scale'].map((label, i) => <div className="mhx-transform-row" key={label}><span>{label}</span>{['X', 'Y', 'Z'].map((axis, j) => <label key={axis}><small>{axis}</small><input aria-label={`${label} ${axis}`} defaultValue={i === 2 ? '1.00' : i === 0 ? (j === 1 ? '0.00' : '0.00') : '0.00'} /></label>)}</div>)}</div>
          <div className="mhx-inspector-section"><div className="mhx-section-title"><Box size={14} /> Components <button aria-label="Add component" onClick={() => setPreviewMessage('Component picker is available in the design preview')}><Plus size={14} /></button></div>
            {selectedEntity?.components.map((component) => <details key={component.id} className="mhx-component" open><summary><span>{component.type === 'primitive' ? <Cuboid size={13} /> : component.type === 'camera' ? <Camera size={13} /> : component.type === 'transform' ? <Move3D size={13} /> : component.type === 'physics' ? <Activity size={13} /> : <Sun size={13} />}{component.type === 'primitive' ? 'Mesh Renderer' : component.type === 'uiCanvas' ? 'UI Canvas' : component.type[0].toUpperCase() + component.type.slice(1)}</span><ChevronDown size={13} /></summary><div className="mhx-component-body"><span>Status</span><b><i /> Enabled</b>{component.type === 'primitive' && <><span>Shape</span><b>Cube · solid mesh</b><span>Material</span><b>Silver / default</b></>}{component.type === 'camera' && <><span>FOV</span><b>50°</b><span>Target</span><b>Scene origin</b></>}</div></details>)}
          </div>
          <div className="mhx-inspector-section"><div className="mhx-section-title"><ShieldCheck size={14} /> Object state</div><div className="mhx-state-row"><span>Active in scene</span><button className="mhx-toggle on" onClick={() => { setEntities((current) => current.map((entity) => entity.id === selected ? { ...entity, active: !entity.active } : entity)); }} aria-label="Toggle object active"><i /></button></div><div className="mhx-state-row"><span>Parent</span><button className="mhx-parent-button" onClick={() => setPreviewMessage('Parent / unlink interaction preview')}>None <Link2 size={12} /></button></div></div>
          <div className="mhx-inspector-foot"><span>Changes are local to this design proposal.</span></div>
        </aside>
      </div>

      <footer className="mhx-statusbar">
        <span className="mhx-status-brand"><i /> MADHORSE UI · DESIGN PROPOSAL</span><span className="mhx-status-divider" /><span className="mhx-status-message"><Check size={13} />{projectToast}</span><span className="mhx-status-right"><span><Activity size={12} /> System status</span><span><Sun size={12} /> Wake control preview</span><span>v0.2 / PREVIEW</span></span>
      </footer>
    </main>
  );
}
