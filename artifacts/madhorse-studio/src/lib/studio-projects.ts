export const LEGACY_STUDIO_PROJECT_ID = 'madhorse-studio-fresh-workspace';
const REGISTRY_KEY = 'madhorse-studio:projects:v1';
export type StudioProject = { id: string; name: string };
export type StudioProjectRegistry = { activeId: string; projects: StudioProject[] };

export function validateProjectName(value: string): string {
  const name = value.trim();
  if (!name) throw new Error('Enter a project name.');
  if (name.length > 80) throw new Error('Use 80 characters or fewer.');
  return name;
}
export function parseStudioProjects(raw: string): StudioProjectRegistry {
  const value = JSON.parse(raw);
  if (!value || !Array.isArray(value.projects) || !value.projects.length || value.projects.length > 200) throw new Error('Invalid project list.');
  const projects: StudioProject[] = value.projects.map((item: StudioProject) => {
    if (!item || typeof item.id !== 'string' || !/^[\w-]{1,100}$/.test(item.id) || typeof item.name !== 'string') throw new Error('Invalid project entry.');
    return { id: item.id, name: validateProjectName(item.name) };
  });
  if (new Set(projects.map(item => item.id)).size !== projects.length) throw new Error('Duplicate project identifiers.');
  return { projects, activeId: projects.some(item => item.id === value.activeId) ? value.activeId : projects[0].id };
}
export function loadStudioProjects(): StudioProjectRegistry {
  const raw = localStorage.getItem(REGISTRY_KEY);
  if (raw) return parseStudioProjects(raw);
  // Existing scenes stay under their original identity and storage keys.
  let name = '';
  try {
    const old = JSON.parse(localStorage.getItem('madhorse-studio:fresh-workspace:v1') ?? 'null');
    if (typeof old?.projectName === 'string') name = validateProjectName(old.projectName);
  } catch { /* An unnamed legacy scene can be named without changing its content. */ }
  return { activeId: LEGACY_STUDIO_PROJECT_ID, projects: [{ id: LEGACY_STUDIO_PROJECT_ID, name }] };
}
export function saveStudioProjects(registry: StudioProjectRegistry) {
  const validated = parseStudioProjects(JSON.stringify(registry));
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(validated));
}
export function activeStudioProjectId(): string {
  try { return loadStudioProjects().activeId; } catch { return LEGACY_STUDIO_PROJECT_ID; }
}
export function studioProjectStorageKey(base: string, projectId = activeStudioProjectId()) {
  return projectId === LEGACY_STUDIO_PROJECT_ID ? base : `${base}:${projectId}`;
}
