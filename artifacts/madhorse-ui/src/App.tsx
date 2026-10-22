import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { ScriptRunner } from '@/components/script-runner';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
const projectStorageKey = 'madhorse-ui-projects';
const gameTypes = ['RTS', 'RPG', 'MMO', 'Arena Fighting', 'Card Game', 'Sport Game'] as const;
const scriptLanguages: Record<string, string> = {
  '.py': 'Python',
  '.c': 'C',
  '.h': 'C / C++',
  '.cc': 'C++',
  '.cpp': 'C++',
  '.cxx': 'C++',
  '.hpp': 'C++',
  '.js': 'JavaScript',
  '.mjs': 'JavaScript',
  '.ts': 'TypeScript',
  '.lua': 'Lua',
  '.cs': 'C#',
};
const maxScriptSize = 256 * 1024;
const maxProjectScriptsSize = 1024 * 1024;

type ScriptFile = {
  id: string;
  name: string;
  language: string;
  size: number;
  content: string;
};

type Project = {
  id: string;
  name: string;
  gameType: string;
  savedAt: string;
  scripts?: ScriptFile[];
};

function loadProjects(): Project[] {
  try {
    const stored = localStorage.getItem(projectStorageKey);
    const projects = stored ? JSON.parse(stored) : null;
    if (Array.isArray(projects) && projects.length > 0) return projects;
  } catch {
    // Start with a clean project if browser storage is unavailable or invalid.
  }
  return [{ id: crypto.randomUUID(), name: 'Untitled Project', gameType: '', savedAt: '', scripts: [] }];
}

function HorseMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-labelledby="horse-mark-title"
    >
      <title id="horse-mark-title">A fire horse encircling a flame</title>
      <circle cx="24" cy="24" r="11.5" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M24 17c1.8 3-.3 4.1 1.2 6.2 1.1 1.4 3.4 2 2.6 4.6-.6 2-2.7 3.1-4.8 2.4-2.5-.8-3.2-3.3-1.8-5.3.8-1.2 1.9-1.9 1.8-3.8-.1-1.4.3-2.7 1-4.1Z"
        fill="currentColor"
      />
      <path
        d="M12.4 20.2c1.4-7.2 7.8-12.4 15.5-12.4 8.8 0 15.9 7.1 15.9 15.9 0 7.2-4.8 13.3-11.4 15.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="m13.2 17.8 1.1-5.1 4.1 2.7 3.5-5.6 2.2 4.1 4.1-1.2 3.4 3.9 4.4 1.3 2.2 4.1-2.2 2.2-4.4.2-1.7 4.1-4.8 2.9-1.1 5.1-3.2-.4.8-6.2-4 3.4-2.7 4.2-3-.8 1.5-6.1-2.2-5.1 2-7.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Home() {
  const [projects, setProjects] = useState<Project[]>(loadProjects);
  const [activeProjectId, setActiveProjectId] = useState(projects[0].id);
  const [saveMessage, setSaveMessage] = useState('');
  const [scriptMessage, setScriptMessage] = useState('');
  const [isDraggingScript, setIsDraggingScript] = useState(false);
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0];

  useEffect(() => {
    try {
      localStorage.setItem(projectStorageKey, JSON.stringify(projects));
    } catch {
      setSaveMessage('Browser storage unavailable');
    }
  }, [projects]);

  function updateActiveProject(updates: Partial<Project>) {
    setProjects((current) =>
      current.map((project) =>
        project.id === activeProjectId ? { ...project, ...updates } : project,
      ),
    );
  }

  function createProject() {
    const name = window.prompt('Name your project');
    if (!name?.trim()) return;
    const project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      gameType: '',
      savedAt: '',
      scripts: [],
    };
    setProjects((current) => [...current, project]);
    setActiveProjectId(project.id);
    setSaveMessage('New project created');
  }

  function renameProject() {
    const name = window.prompt('Rename project', activeProject.name);
    if (!name?.trim()) return;
    updateActiveProject({ name: name.trim() });
    setSaveMessage('Project renamed');
  }

  function saveProject() {
    updateActiveProject({ savedAt: new Date().toISOString() });
    setSaveMessage('Project saved');
  }

  async function importScriptFiles(files: FileList | File[]) {
    const scripts = activeProject.scripts ?? [];
    let totalSize = scripts.reduce((sum, script) => sum + script.size, 0);
    const imported: ScriptFile[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(files)) {
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      const language = scriptLanguages[extension];
      if (!language) {
        rejected.push(`${file.name}: unsupported file type`);
        continue;
      }
      if (file.size > maxScriptSize) {
        rejected.push(`${file.name}: files must be 256 KB or smaller`);
        continue;
      }
      if (totalSize + file.size > maxProjectScriptsSize) {
        rejected.push(`${file.name}: this project has reached its 1 MB script storage limit`);
        continue;
      }

      try {
        const content = await file.text();
        if (content.includes('\u0000')) {
          rejected.push(`${file.name}: file is not plain text`);
          continue;
        }
        imported.push({
          id: crypto.randomUUID(),
          name: file.name,
          language,
          size: file.size,
          content,
        });
        totalSize += file.size;
      } catch {
        rejected.push(`${file.name}: could not read file`);
      }
    }

    if (imported.length > 0) {
      updateActiveProject({ scripts: [...scripts, ...imported] });
    }
    setScriptMessage([
      imported.length ? `Imported ${imported.length} script${imported.length === 1 ? '' : 's'}` : '',
      ...rejected,
    ].filter(Boolean).join(' · ') || 'Choose a script file to import.');
  }

  function removeScript(scriptId: string) {
    updateActiveProject({
      scripts: (activeProject.scripts ?? []).filter((script) => script.id !== scriptId),
    });
    setScriptMessage('Script removed from this project');
  }

  return (
    <main className="workspace" aria-label="Madhorse game creation workspace">
      <div className="shell">
        <header className="topbar">
          <div className="brand" aria-label="Madhorse UI">
            <HorseMark />
            <span className="brand-name">MADHORSE<span>UI</span></span>
          </div>
          <div className="utility-mark" aria-hidden="true"><i /><i /><i /></div>
        </header>

        <section className="stage" aria-label="Empty game workspace">
          <div className="frame-lines" aria-hidden="true" />
          <span className="stage-corner tl" aria-hidden="true" />
          <span className="stage-corner tr" aria-hidden="true" />
          <span className="stage-corner bl" aria-hidden="true" />
          <span className="stage-corner br" aria-hidden="true" />
        </section>

        <div className="statusbar" role="group" aria-label="Workspace status and actions">
          <div className="status-segment" aria-hidden="true"><span className="status-diamond" /></div>
          <div className="workspace-controls">
            <details className="project-menu">
              <summary className="control-button project-button" aria-label="Project actions">
                Project <span className="control-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="project-menu-panel">
                <label htmlFor="project-dropdown">Current project</label>
              <select
                id="project-dropdown"
                className="project-dropdown"
                value={activeProjectId}
                onChange={(event) => {
                  setActiveProjectId(event.target.value);
                  setSaveMessage('');
                }}
                aria-label="Choose project"
                data-testid="select-project"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
                <div className="project-actions">
                  <button type="button" onClick={createProject}>New project</button>
                  <button type="button" onClick={renameProject}>Rename</button>
                  <button type="button" onClick={saveProject}>Save project</button>
                </div>
                <span className="project-save-status" role="status" aria-live="polite">
                  {saveMessage || (activeProject.savedAt ? 'Saved in this browser' : 'Not saved yet')}
                </span>
              </div>
            </details>
            <label className="sr-only" htmlFor="game-type-dropdown">Game type</label>
            <span className="game-type-wrap">
              <select
                id="game-type-dropdown"
                className="control-button game-type-button"
                value={activeProject.gameType}
                onChange={(event) => updateActiveProject({ gameType: event.target.value })}
                aria-label="Game type"
                data-testid="select-game-type"
              >
                <option value="">Game Type</option>
                {gameTypes.map((gameType) => (
                  <option key={gameType} value={gameType}>{gameType}</option>
                ))}
              </select>
              <span className="control-chevron" aria-hidden="true">⌄</span>
            </span>
            <details className="script-menu">
              <summary className="control-button script-button" aria-label="Script tools">
                Script <span className="control-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="script-menu-panel">
                <div className="script-panel-heading">
                  <strong>Project scripts</strong>
                  <span>Python · C++ · JavaScript · Lua · C#</span>
                </div>
                <label
                  className={`script-dropzone${isDraggingScript ? ' is-dragging' : ''}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDraggingScript(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setIsDraggingScript(false);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDraggingScript(false);
                    void importScriptFiles(event.dataTransfer.files);
                  }}
                >
                  <input
                    className="script-file-input"
                    type="file"
                    multiple
                    accept=".py,.c,.h,.cc,.cpp,.cxx,.hpp,.js,.mjs,.ts,.lua,.cs"
                    onChange={(event) => {
                      if (event.target.files) void importScriptFiles(event.target.files);
                      event.target.value = '';
                    }}
                  />
                  <span className="script-drop-icon" aria-hidden="true">+</span>
                  <span>Drop scripts here or <u>browse files</u></span>
                  <small>Plain-text files up to 256 KB each</small>
                </label>
                <div className="script-list" aria-live="polite">
                  {(activeProject.scripts ?? []).length === 0 ? (
                    <span className="script-empty">No scripts added to this project.</span>
                  ) : (
                    (activeProject.scripts ?? []).map((script) => (
                      <div className="script-file-row" key={script.id}>
                        <span className="script-file-info">
                          <strong>{script.name}</strong>
                          <small>{script.language} · {(script.size / 1024).toFixed(1)} KB</small>
                        </span>
                        <button
                          type="button"
                          className="script-remove"
                          onClick={() => removeScript(script.id)}
                          aria-label={`Remove ${script.name}`}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <ScriptRunner projectId={activeProject.id} scripts={activeProject.scripts ?? []} />
                <span className="script-message" role="status">{scriptMessage}</span>
              </div>
            </details>
          </div>
          <div className="status-segment" aria-hidden="true"><span className="status-diamond" /></div>
        </div>

        <section className="panel-row" aria-label="Workspace panels">
          <div className="panel" aria-hidden="true" />
          <div className="panel" aria-hidden="true" />
          <div className="panel" aria-hidden="true" />
        </section>

        <div className="shell-footer" aria-hidden="true">
          <span className="footer-line" />
          <span className="footer-center"><i /><i /><i /></span>
          <span className="footer-line" />
        </div>
      </div>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
