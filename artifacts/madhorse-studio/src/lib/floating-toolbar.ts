export type ToolbarPosition = { x: number; y: number };
export function clampToolbarPosition(position: ToolbarPosition, screen: { width: number; height: number }, size: { width: number; height: number }): ToolbarPosition {
  return {
    x: Math.max(0, Math.min(Math.max(0, screen.width - size.width), position.x)),
    y: Math.max(0, Math.min(Math.max(0, screen.height - size.height), position.y)),
  };
}
export function parseToolbarPosition(raw: string | null): ToolbarPosition | null {
  try {
    const value = JSON.parse(raw ?? 'null');
    return value && typeof value.x === 'number' && Number.isFinite(value.x) &&
      typeof value.y === 'number' && Number.isFinite(value.y) ? { x: value.x, y: value.y } : null;
  } catch { return null; }
}
