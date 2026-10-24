import { useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import BlankWorkspace from './blank-workspace';
import { loadStudioProjects, saveStudioProjects, validateProjectName, type StudioProjectRegistry } from '@/lib/studio-projects';
import { exportStudioProject } from '@/lib/project-file';
import type { FreshWorkspaceSnapshot } from '@/lib/fresh-workspace-storage';
import './studio-projects.css';
import { getSystemActivity, subscribeSystemActivity } from '@/lib/system-activity';
import { createEgoUiKit } from '@/lib/ego-ui-kit';
import { createGameCamera } from '@/lib/game-camera';
import { createGameStarterKit } from '@/lib/scene-starter-kits';
import { removeFreshWorkspace, saveFreshWorkspace } from '@/lib/fresh-workspace-storage';

const fightingStarterVision = 'A 2D side-view fighting game with a player, a training rival, editable combat actions, and a round HUD.';

function createFightingStarterSnapshot(projectName: string): FreshWorkspaceSnapshot {
  const starter = createGameStarterKit('fighting', { x: -15, y: 50, z: 0 });
  const camera = createGameCamera(starter.entities);
  camera.position = { x: 0, y: 1.2, z: -17 };
  camera.target = { x: 0, y: 1.2, z: 0 };
  camera.fov = 42;
  camera.placement = 'custom';
  const uiControls = createEgoUiKit(['fighting'], 0)
    .filter(control => control.type === 'health-bar' || control.type === 'text');
  return {
    projectName,
    egoGameVision: fightingStarterVision,
    egoGameFlow: 'undecided',
    egoGameNotes: 'Move with A and D. Strike with F, block with Control, run with Shift, and crouch with C. Use Play Test to try the arena.',
    entities: starter.entities,
    camera,
    assets: [],
    animations: [],
    animationControllers: [],
    builderHistory: [],
    builderDraft: null,
    builderDraftRequest: '',
    builderBuildLogs: [],
    prefabs: [],
    uiControls,
    scripts: [],
  };
}

function clearFightingStarterRequest() {
  const url = new URL(window.location.href);
  url.searchParams.delete('starter');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export default function StudioProjects() {
  const [initial] = useState(() => {
    try { return { registry: loadStudioProjects(), error: '' }; }
    catch { return { registry: null, error: 'Could not read the saved project list. No project data was changed. Check browser storage before continuing.' }; }
  });
  const [registry, setRegistry] = useState<StudioProjectRegistry | null>(initial.registry);
  const active = registry?.projects.find(project => project.id === registry.activeId);
  const [mode, setMode] = useState<'name' | 'new' | 'rename' | 'template' | null>(() => {
    if (new URLSearchParams(window.location.search).get('starter') === '2d-fighting') return 'template';
    return active?.name ? null : 'name';
  });
  const [draft, setDraft] = useState(() =>
    new URLSearchParams(window.location.search).get('starter') === '2d-fighting' ? 'My 2D Fighting Game' : '',
  );
  const [error, setError] = useState(initial.error);
  const [savingProject, setSavingProject] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ kind: 'progress' | 'success' | 'error'; message: string } | null>(null);
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
    if (mode === 'template') {
      if (registry.projects.length >= 200) {
        setError('This browser has reached the 200-project limit. Remove or export a project before creating another.');
        return;
      }
      const id = crypto.randomUUID();
      try {
        saveFreshWorkspace(createFightingStarterSnapshot(name), id);
        const next: StudioProjectRegistry = {
          activeId: id,
          projects: [...registry.projects, { id, name }],
        };
        if (!persist(next)) {
          removeFreshWorkspace(id);
          return;
        }
        clearFightingStarterRequest();
        setMode(null);
        setDraft('');
        setExportStatus(null);
      } catch (cause) {
        try { removeFreshWorkspace(id); } catch { /* Storage may be unavailable. Existing project data stays untouched. */ }
        setError(cause instanceof Error
          ? `The fighting-game starter could not be saved. Existing projects were left untouched. ${cause.message}`
          : 'The fighting-game starter could not be saved. Existing projects were left untouched.');
      }
      return;
    }
    if (mode === 'new' && activity.pending > 0) { setError('Wait for the current operation to finish before creating another project.'); return; }
    const id = mode === 'new' ? crypto.randomUUID() : active.id;
    const next = mode === 'new'
      ? { activeId: id, projects: [...registry.projects, { id, name }] }
      : { ...registry, projects: registry.projects.map(project => project.id === id ? { ...project, name } : project) };
    if (persist(next)) { setMode(null); setDraft(''); setExportStatus(null); }
  }
  async function saveProjectFile(snapshot: FreshWorkspaceSnapshot) {
    if (savingProject || activity.pending > 0 || !active) return;
    setSavingProject(true);
    setExportStatus({ kind: 'progress', message: 'Preparing the project file…' });
    try {
      const archive = await exportStudioProject(active.id, active.name, snapshot, message => setExportStatus({ kind: 'progress', message }));
      const url = URL.createObjectURL(archive.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = archive.fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setExportStatus({
        kind: 'success',
        message: `Saved ${archive.fileName} with ${archive.attachmentCount} imported file${archive.attachmentCount === 1 ? '' : 's'} and this project's scene data.`,
      });
    } catch (cause) {
      setExportStatus({ kind: 'error', message: cause instanceof Error ? cause.message : 'Could not save the project file.' });
    } finally {
      setSavingProject(false);
    }
  }
  return <>
    <BlankWorkspace key={active.id} projectId={active.id} projectName={active.name}
      projectControls={(readOnly, snapshot) => {
        const disabled = readOnly || activity.pending > 0 || savingProject;
        return <>
        <details className="studio-project-menu" ref={menu}>
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
        </details>
        <button type="button" className="studio-save-project" onClick={() => void saveProjectFile(snapshot)}
          disabled={disabled} title="Download a project file with your scene, imported files, and Vision Board"
          aria-label={savingProject ? 'Saving project file' : 'Save project file'} data-testid="button-save-project">
          <Save size={12} aria-hidden="true" /> {savingProject ? 'Saving…' : 'Save'}
        </button>
        </>;
      }} />
    {exportStatus && <div className={`studio-project-notice studio-export-notice is-${exportStatus.kind}`}
      role={exportStatus.kind === 'error' ? 'alert' : 'status'}>{exportStatus.message}</div>}
    {error && !mode && <div className="studio-project-notice" role="alert">{error}</div>}
    {mode && <div className="studio-project-backdrop">
      <form className="studio-project-dialog" role="dialog" aria-modal="true" aria-labelledby="project-name-heading"
        onSubmit={submit} onKeyDown={event => {
          if (event.key === 'Escape' && mode !== 'name') {
            event.stopPropagation();
            if (mode === 'template') clearFightingStarterRequest();
            setMode(null);
            setError('');
          }
          if (event.key === 'Tab') {
            const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('input, button')];
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}>
        <h2 id="project-name-heading">{mode === 'template' ? 'Name your 2D fighting game' : mode === 'new' ? 'New project' : mode === 'rename' ? 'Rename project' : 'Name your project'}</h2>
        <p>{mode === 'template'
          ? 'This creates a separate project with a fighting arena, two editable fighters, combat controls, and a Play Test HUD. Your other saved projects stay untouched.'
          : mode === 'new'
            ? 'Your current project stays saved in this browser.'
            : 'This name will appear above the scene view. Your scene and files will be kept.'}</p>
        <label>Project name
          <input autoFocus required maxLength={80} value={draft} onChange={event => setDraft(event.target.value)}
            aria-describedby={error ? 'project-name-error' : undefined} />
        </label>
        {error && <p id="project-name-error" role="alert">{error}</p>}
        <footer>
          {mode !== 'name' && <button type="button" onClick={() => {
            if (mode === 'template') clearFightingStarterRequest();
            setMode(null);
            setError('');
          }}>Cancel</button>}
          <button type="submit">{mode === 'template' ? 'Create fighting game' : mode === 'new' ? 'Create project' : 'Save name'}</button>
        </footer>
      </form>
    </div>}
  </>;
}
