import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { describeSceneEdit, SceneEditHistory, type SceneEditState } from '@/lib/scene-edit-history';

export function useSceneEditHistory(value: SceneEditState, restore: (value: SceneEditState) => void,
  disabled: boolean, report: (message: string) => void) {
  const history = useRef<SceneEditHistory<SceneEditState> | null>(null);
  if (!history.current) history.current = new SceneEditHistory(value);
  const previous = useRef(value);
  const callbacks = useRef({ restore, disabled, report });
  callbacks.current = { restore, disabled, report };
  const [, refresh] = useReducer(version => version + 1, 0);

  useLayoutEffect(() => {
    const edit = describeSceneEdit(previous.current, value);
    previous.current = value;
    if (history.current!.record(value, edit.label, edit.group, performance.now())) refresh();
  }, [value]);

  const apply = useCallback((direction: 'undo' | 'redo') => {
    if (callbacks.current.disabled) return;
    const result = history.current![direction]();
    if (!result) return;
    callbacks.current.restore(result.value);
    callbacks.current.report(`${direction === 'undo' ? 'Undid' : 'Redid'}: ${result.label}.`);
    refresh();
  }, []);
  const undo = useCallback(() => apply('undo'), [apply]);
  const redo = useCallback(() => apply('redo'), [apply]);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || !(event.ctrlKey || event.metaKey) || callbacks.current.disabled) return;
      if (event.target instanceof Element && event.target.closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="dialog"],[role="alertdialog"]',
      )) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const key = event.key.toLowerCase();
      const direction = key === 'z' ? (event.shiftKey ? 'redo' : 'undo') : key === 'y' ? 'redo' : null;
      if (!direction || !history.current!.summary[direction === 'undo' ? 'canUndo' : 'canRedo']) return;
      event.preventDefault(); apply(direction);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [apply]);

  return { ...history.current.summary, undo, redo };
}
