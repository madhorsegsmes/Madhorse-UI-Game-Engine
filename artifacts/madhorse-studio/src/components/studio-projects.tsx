import { useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import BlankWorkspace from './blank-workspace';
import { loadStudioProjects, saveStudioProjects, validateProjectName, type StudioProjectRegistry } from '@/lib/studio-projects';
import './studio-projects.css';
import { getSystemActivity, subscribeSystemActivity } from '@/lib/system-activity';

export default function StudioProjects() {
  const [initial] = useState(() => {
    try { return { registry: loadStudioProjects(), error: '' }; }
    catch { return { registry: null, error: 'Could not read the saved project list. No project data was changed. Check browser storage before continuing.' }; }
  });
  const [registry, setRegistry] = useState<StudioProjectRegistry | null>(initial.registry);
  const active = registry?.projects.find(project => project.id === registry.activeId);
  const [mode, setMode] = useState<'name' | 'new' | 'rename' | null>(() => active?.name ? null : 'name');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(initial.error);
  const menu = useRef<HTMLDetailsElement>(null);
  const activity = useSyncExternalStore(subscribeSystemActivity, getSystemActivity, getSystemActivity);
  if (!registry || !active) return <main className="studio-project-error" role="alert">{error}</main>;
  function persist(next: StudioProjectRegistry) {
    try { saveStudioProjects(next); setRegistry(next); setError(''); return true; }
    catch { setError('Could not save the project list in this browser. No project was switched or replaced. Check available storage.'); return false; }
  }
  function open(next: 'new' | 'rename') {
    if (menu.current) menu.current.open = false;
    setDraft(next === 'rename' ? active!.name : ''); setError(''); setMode(next);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    let name: string;
    try { name = validateProjectName(draft); } catch (cause) { setError((cause as Error).message); return; }
    if (!registry || !active) return;
    if (mode === 'new' && activity.pending > 0) { setError('Wait for the current operation to finish before creating another project.'); return; }
    const id = mode === 'new' ? crypto.randomUUID() : active.id;
    const next = mode === 'new'
      ? { activeId: id, projects: [...registry.projects, { id, name }] }
      : { ...registry, projects: registry.projects.map(project => project.id === id ? { ...project, name } : project) };
    if (persist(next)) { setMode(null); setDraft(''); }
  }
  return <>
    <BlankWorkspace key={active.id} projectId={active.id} projectName={active.name}
      projectControls={readOnly => {
        const disabled = readOnly || activity.pending > 0;
        return <details className="studio-project-menu" ref={menu}>
        <summary>Project</summary>
        <div className="studio-project-menu-body">
          <button type="button" disabled={disabled || registry.projects.length >= 200} onClick={() => open('new')}>New project</button>
          <button type="button" disabled={disabled} onClick={() => open('rename')}>Rename project</button>
          <span>Open saved project</span>
          {registry.projects.map(project => <button key={project.id} type="button" title={project.name}
            disabled={disabled} aria-current={project.id === active.id ? 'true' : undefined}
            onClick={() => {
              if (persist({ ...registry, activeId: project.id }) && menu.current) menu.current.open = false;
            }}>{project.name || 'Name your project'}</button>)}
        </div>
      </details>;
      }} />
    {error && !mode && <div className="studio-project-notice" role="alert">{error}</div>}
    {mode && <div className="studio-project-backdrop">
      <form className="studio-project-dialog" role="dialog" aria-modal="true" aria-labelledby="project-name-heading"
        onSubmit={submit} onKeyDown={event => {
          if (event.key === 'Escape' && mode !== 'name') { event.stopPropagation(); setMode(null); setError(''); }
          if (event.key === 'Tab') {
            const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('input, button')];
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}>
        <h2 id="project-name-heading">{mode === 'new' ? 'New project' : mode === 'rename' ? 'Rename project' : 'Name your project'}</h2>
        <p>{mode === 'new' ? 'Your current project stays saved in this browser.' : 'This name will appear above the scene view. Your scene and files will be kept.'}</p>
        <label>Project name
          <input autoFocus required maxLength={80} value={draft} onChange={event => setDraft(event.target.value)}
            aria-describedby={error ? 'project-name-error' : undefined} />
        </label>
        {error && <p id="project-name-error" role="alert">{error}</p>}
        <footer>
          {mode !== 'name' && <button type="button" onClick={() => { setMode(null); setError(''); }}>Cancel</button>}
          <button type="submit">{mode === 'new' ? 'Create project' : 'Save name'}</button>
        </footer>
      </form>
    </div>}
  </>;
}
