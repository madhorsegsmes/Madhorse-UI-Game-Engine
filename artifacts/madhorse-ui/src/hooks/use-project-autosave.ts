import { useEffect, useRef } from 'react';

export const projectStorageKey = 'madhorse-ui-projects';
const activeProjectKey = 'madhorse-ui-active-project';
const autosaveDelay = 350;

type IdentifiedProject = { id: string };

export function loadActiveProjectId(projects: IdentifiedProject[]) {
  const firstId = projects[0].id;
  try {
    const savedId = localStorage.getItem(activeProjectKey);
    return projects.some((project) => project.id === savedId) ? savedId! : firstId;
  } catch {
    return firstId;
  }
}

function persistProjectSnapshot(projects: unknown[], activeProjectId: string) {
  try {
    const serialized = JSON.stringify(projects);
    localStorage.setItem(projectStorageKey, serialized);
    localStorage.setItem(activeProjectKey, activeProjectId);
    return '';
  } catch {
    return 'Browser storage is full or unavailable. Latest changes may not survive a refresh.';
  }
}

export function useProjectAutosave<TProject>(
  projects: TProject[],
  activeProjectId: string,
  canOverwriteSavedData: boolean,
  onStatus: (message: string) => void,
) {
  const latestSnapshot = useRef({ projects, activeProjectId });
  latestSnapshot.current = { projects, activeProjectId };
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushPendingSave = useRef<() => void>(() => {});

  useEffect(() => {
    if (saveTimer.current !== null) clearTimeout(saveTimer.current);
    let pending = true;
    const flush = () => {
      if (!pending) return;
      pending = false;
      saveTimer.current = null;
      if (!canOverwriteSavedData) return;
      const message = persistProjectSnapshot(
        latestSnapshot.current.projects,
        latestSnapshot.current.activeProjectId,
      );
      onStatus(message || 'Project changes saved in this browser.');
    };

    flushPendingSave.current = flush;
    saveTimer.current = setTimeout(flush, autosaveDelay);

    return () => {
      pending = false;
      if (saveTimer.current !== null) clearTimeout(saveTimer.current);
      saveTimer.current = null;
    };
  }, [projects, activeProjectId, canOverwriteSavedData, onStatus]);

  useEffect(() => {
    const flush = () => flushPendingSave.current();
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flushWhenHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flushWhenHidden);
      flush();
    };
  }, []);
}
