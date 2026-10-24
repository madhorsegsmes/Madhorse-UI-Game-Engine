import { useEffect, useRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import './scene-tool-cursor.css';

export type SceneCursorTool = { label: string; Icon: LucideIcon };

/** Follow the pointer without rerendering the scene or intercepting its input. */
export function SceneToolCursor({ host, tool }: {
  host: RefObject<HTMLElement | null>; tool?: SceneCursorTool | null;
}) {
  const badge = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = badge.current;
    const region = host.current;
    if (!tool || !element || !region) return;
    const hide = () => { element.hidden = true; };
    hide();
    const move = (event: PointerEvent) => {
      const target = event.target;
      if (event.pointerType === 'touch' || !(target instanceof Element) || !region.contains(target) ||
        target.closest('button, input, select, textarea, a, summary, [role="toolbar"]')) {
        hide(); return;
      }
      element.hidden = false;
      element.style.left = `${Math.max(0, Math.min(window.innerWidth - element.offsetWidth - 4, event.clientX + 18))}px`;
      element.style.top = `${Math.max(0, Math.min(window.innerHeight - element.offsetHeight - 4, event.clientY + 18))}px`;
    };
    document.addEventListener('pointermove', move, true);
    region.addEventListener('pointerleave', hide);
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', hide);
    return () => {
      hide();
      document.removeEventListener('pointermove', move, true);
      region.removeEventListener('pointerleave', hide);
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [host, tool]);
  if (!tool) return null;
  const Icon = tool.Icon;
  return createPortal(
    <div ref={badge} className="scene-tool-cursor" hidden aria-hidden="true" data-testid="scene-tool-cursor">
      <Icon size={20} strokeWidth={2} /><span>{tool.label}</span>
    </div>, document.body,
  );
}
