import { publishDiagnostic } from './system-diagnostics';

/** Copy, never move, the original editor's saves on first use of Studio. */
export function initializeStudioStorage() {
  try {
    if (localStorage.getItem('madhorse-studio-projects') !== null) return;
    const legacy = localStorage.getItem('madhorse-ui-projects');
    if (legacy === null) return;
    const active = localStorage.getItem('madhorse-ui-active-project');
    if (active !== null) localStorage.setItem('madhorse-studio-active-project', active);
    localStorage.setItem('madhorse-studio-projects', legacy);
  } catch {
    publishDiagnostic('storage', 'error', 'Could not copy existing projects into Studio. The original editor’s saved projects were not changed.');
  }
}
