import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Activity, Camera, Code2, Film, FolderOpen, Grid2X2, Layers3, ListTree, PanelLeft, Save, Settings2, ShieldCheck, WandSparkles } from 'lucide-react';
import { SystemStatus } from './system-status';
import './studio-design.css';
import './studio-integration.css';

const tools = [
  ['Hierarchy', ListTree], ['Assets', Layers3], ['Data', ShieldCheck],
  ['Mad Builder', WandSparkles], ['Animations', Film], ['UI Controls', Grid2X2],
  ['Game Camera', Camera], ['Scripts', Code2], ['Debugger', Activity],
] as const;
type Tool = typeof tools[number][0];
export type StudioConfig = {
  projectName: string;
  onRename: (name: string) => void;
  onSave: () => void;
  status: string;
  rules: Record<string, string>;
  onRulesChange: (rules: Record<string, string>) => void;
  onLayoutSwitch: () => void;
};

function HorseMark() {
  return <svg className="mhx-mark" viewBox="0 0 48 48" fill="none" aria-label="Madhorse fire horse">
    <circle cx="24" cy="24" r="11.5" stroke="currentColor" strokeWidth="1.35" />
    <path d="M24 17c1.8 3-.3 4.1 1.2 6.2 1.1 1.4 3.4 2 2.6 4.6-.6 2-2.7 3.1-4.8 2.4-2.5-.8-3.2-3.3-1.8-5.3.8-1.2 1.9-1.9 1.8-3.8-.1-1.4.3-2.7 1-4.1Z" fill="currentColor" />
    <path d="M12.4 20.2c1.4-7.2 7.8-12.4 15.5-12.4 8.8 0 15.9 7.1 15.9 15.9 0 7.2-4.8 13.3-11.4 15.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="m13.2 17.8 1.1-5.1 4.1 2.7 3.5-5.6 2.2 4.1 4.1-1.2 3.4 3.9 4.4 1.3 2.2 4.1-2.2 2.2-4.4.2-1.7 4.1-4.8 2.9-1.1 5.1-3.2-.4.8-6.2-4 3.4-2.7 4.2-3-.8 1.5-6.1-2.2-5.1 2-7.7Z" fill="currentColor" />
  </svg>;
}

function RuleEditor({ config }: { config: StudioConfig }) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  return <div className="studio-rules">
    <section className="mhx-data-callout"><ShieldCheck /><strong>Protected engine systems</strong>
      <p>Scene objects, physics, rendering and language runtimes are engine-managed. Project rules below are yours to edit.</p>
    </section>
    <h3>Game rules</h3>
    <p>Saved with this project, in this browser.</p>
    {Object.entries(config.rules).map(([name, content]) => <div className="studio-rule" key={name}>
      <label>{name}<input aria-label={`Rule ${name}`} value={content} maxLength={2000} onChange={event => config.onRulesChange({ ...config.rules, [name]: event.target.value })} /></label>
      <button aria-label={`Remove rule ${name}`} onClick={() => config.onRulesChange(Object.fromEntries(Object.entries(config.rules).filter(([entry]) => entry !== name)))}>Remove</button>
    </div>)}
    <form onSubmit={event => {
      event.preventDefault();
      const name = key.trim();
      if (!name || Object.hasOwn(config.rules, name) || Object.keys(config.rules).length >= 200) { setError('Use a new rule name. Maximum 200 rules.'); return; }
      config.onRulesChange({ ...config.rules, [name]: value });
      setKey(''); setValue(''); setError('');
    }}>
      <label>Rule name<input aria-label="New rule name" value={key} maxLength={80} onChange={event => setKey(event.target.value)} required /></label>
      <label>Value<input aria-label="New rule value" value={value} maxLength={2000} onChange={event => setValue(event.target.value)} /></label>
      <button className="mhx-primary-button">Add rule</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </div>;
}

export function StudioFrame({ panels, config, classicBoard, resetLayout }: {
  panels: Map<string, ReactElement>;
  config: StudioConfig;
  classicBoard: ReactNode;
  resetLayout: () => void;
}) {
  const [tab, setTab] = useState<Tool>('Hierarchy');
  const [classic, setClassic] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [help, setHelp] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const [name, setName] = useState(config.projectName);
  useEffect(() => setName(config.projectName), [config.projectName]);
  useEffect(() => {
    const root = rootRef.current;
    const handleToggle = (event: Event) => {
      const detail = event.target;
      if (detail instanceof HTMLDetailsElement && detail.classList.contains('script-menu') && detail.open) setTab('Scripts');
    };
    root?.addEventListener('toggle', handleToggle, true);
    return () => root?.removeEventListener('toggle', handleToggle, true);
  }, []);
  useEffect(() => {
    if (classic) return;
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLDetailsElement>('.studio-source-left > [data-workspace-panel] > .toolbar-buttons > details').forEach(detail => {
      detail.removeAttribute('name');
      detail.open = true;
    });
    root.querySelectorAll<HTMLDetailsElement>('.system-panel-tools > details').forEach((detail, index) => {
      detail.open = (index === 0 && tab === 'Animations') || (index === 1 && tab === 'UI Controls') || (index === 2 && tab === 'Game Camera');
    });
    const camera = root.querySelector<HTMLDetailsElement>('.mh-camctl');
    if (camera) camera.open = tab === 'Game Camera';
  }, [tab, classic, panels]);
  const label = tab === 'Debugger' ? 'PANEL 5 · SYSTEM DEBUGGER'
    : ['Animations', 'UI Controls', 'Game Camera'].includes(tab) ? 'PANEL 3 · SYSTEM'
    : tab === 'Scripts' ? 'PANEL 1 · SCRIPT' : 'PANEL 2 · PROJECT';
  const openProjects = () => {
    const menu = rootRef.current?.querySelector<HTMLDetailsElement>('.project-menu');
    if (menu) { menu.open = !menu.open; menu.querySelector<HTMLElement>('select')?.focus(); }
  };
  const restore = () => {
    resetLayout(); setTab('Hierarchy');
    try { localStorage.removeItem('madhorse-studio-scene-view-size'); } catch { /* Session layout can still reset. */ }
    rootRef.current?.querySelectorAll<HTMLElement>('[data-scene-size-host], .stage').forEach(node => {
      node.style.removeProperty('width'); node.style.removeProperty('height');
      node.removeAttribute('data-user-sized');
    });
    setClassic(false); setShowTools(false);
  };
  return <main ref={rootRef} className={`mhx-root studio-root${classic ? ' studio-classic' : ''}`} data-studio-tab={tab}>
    <header className="mhx-topbar">
      <div className="mhx-brand"><span className="mhx-brandmark"><HorseMark /></span><span className="mhx-brandname">MADHORSE <b>ENGINE</b></span><span className="mhx-version">STUDIO</span></div>
      <div className="mhx-project"><span className="mhx-project-label">PROJECT</span>
        <input aria-label="Project name" maxLength={80} value={name} onChange={event => setName(event.target.value)}
          onBlur={() => { if (name.trim()) config.onRename(name.trim()); else setName(config.projectName); }}
          onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setName(config.projectName); event.currentTarget.blur(); } }} />
      </div>
      <div className="mhx-header-actions"><span className="mhx-session"><i /> BROWSER LOCAL</span>
        <button className="mhx-save" onClick={config.onSave} data-testid="studio-save"><Save size={14} /> Save</button>
      </div>
    </header>
    <div className="mhx-commandbar">
      <div className="studio-command-left">
        <button className="mhx-flat-button" onClick={openProjects}><FolderOpen size={13} /> File</button>
        <div className="studio-tools-menu"><button className="mhx-flat-button" aria-expanded={showTools} onClick={() => setShowTools(!showTools)}><Settings2 size={13} /> Tools</button>
          {showTools && <div className="mhx-menu">
            <button onClick={restore}>Reset workspace layout</button>
            <button onClick={() => { config.onLayoutSwitch(); setClassic(!classic); setShowTools(false); }}>{classic ? 'Studio workspace' : 'Flexible numbered panels'}</button>
            <button onClick={() => { setHelp(true); setShowTools(false); }}>Workspace help</button>
          </div>}
        </div>
        <button className="mhx-flat-button" onClick={() => rootRef.current?.querySelector<HTMLElement>('.stage')?.focus()}>Scene Preview</button>
      </div>
      {!classic && <div className="studio-project-controls">{panels.get('tools-right')}</div>}
      <button className="mhx-flat-button studio-reset" onClick={restore}><PanelLeft size={14} /> Reset layout</button>
    </div>
    {classic ? <div className="studio-classic-board">{classicBoard}</div> : <div className="mhx-workspace">
      <nav className="mhx-rail" aria-label="Workspace tools"><div className="mhx-rail-group">
        {tools.map(([tool, Icon]) => <button key={tool} className={`mhx-icon-button${tab === tool ? ' active' : ''}`} aria-label={tool} title={tool} aria-pressed={tab === tool} onClick={() => setTab(tool)}><Icon /><span className="studio-rail-label">{tool}</span></button>)}
      </div><button className="studio-help" onClick={() => setHelp(true)}>Help</button></nav>
      <aside className="mhx-left-panel">
        <div className="mhx-panel-head"><div><span className="mhx-overline">{label}</span><h2>{tab}</h2></div></div>
        <div className="studio-source-left">{panels.get('tools-left')}</div>
        <div id="studio-script-host" hidden={tab !== 'Scripts'} />
        <div className="studio-system" id="studio-system-host" hidden={!['Animations', 'UI Controls', 'Game Camera'].includes(tab)}>{panels.get('system')}</div>
        <div className="studio-camera" hidden={tab !== 'Game Camera'}>{panels.get('camera')}</div>
        <div className="studio-debugger" hidden={tab !== 'Debugger'}>{panels.get('errors')}</div>
        {tab === 'Data' && <RuleEditor config={config} />}
      </aside>
      <section className="mhx-center">
        <div className="studio-live-scene">{panels.get('scene')}</div>
        <div className="studio-live-play">{panels.get('play')}</div>
      </section>
      <aside className="mhx-inspector"><div className="mhx-panel-head"><div><span className="mhx-overline">INSPECTOR</span><h2>Object data</h2></div></div><div id="studio-inspector-host" /></aside>
    </div>}
    <footer className="mhx-statusbar"><span className="mhx-status-brand"><i /> MADHORSE STUDIO</span><span className="mhx-status-message" role="status">{config.status || 'Projects save automatically in this browser'}</span><SystemStatus /></footer>
    {help && <div className="studio-help-backdrop" role="dialog" aria-modal="true" aria-label="Madhorse workspace help">
      <section><button onClick={() => setHelp(false)} autoFocus>Close help</button><h2>Madhorse workspace</h2>
        <p>Hierarchy → create/select objects → edit transforms, components and parent links in the Inspector.</p>
        <p>Assets → import models or images → select an object → apply an asset.</p>
        <p>Scripts → create/import code → assign it in the Inspector → Play/Test. Source executes only inside isolated runtimes.</p>
        <p>Mad Builder → describe what to build → inspect the AI plan → apply it to this project.</p>
        <p>Animations and UI Controls edit project content. Game Camera changes the same scene’s Canvas view.</p>
        <p>Debugger collects editor errors, warnings and script results. File contains project switching, new, rename and save.</p>
        <p>Tools → Flexible numbered panels preserves panel dragging/reordering. Drag the scene’s corner handles to resize. Projects stay on this device.</p>
      </section>
    </div>}
  </main>;
}
