export type VisionPanelKind = 'blank' | 'image' | 'video' | 'menu-screen' | 'audio' | 'start' | 'mission' | 'finish';
export type VisionAttachmentKind = 'image' | 'video' | 'audio' | 'menu-screen';
export type VisionAttachmentRole = 'reference' | 'scene' | 'menu';
export type VisionEffects = {
  preset: 'none' | 'cinematic' | 'vintage' | 'dream' | 'noir' | 'vivid';
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
};
export type VisionNodeAttachment = {
  id: string;
  kind: VisionAttachmentKind;
  name: string;
  mediaId?: string;
  role: VisionAttachmentRole;
  effects: VisionEffects;
  menuTitle?: string;
  menuButtons?: string[];
};
export type VisionNodeContent = {
  id: string;
  kind: VisionPanelKind;
  label?: string;
  details?: string;
  complete?: boolean;
  attachments?: VisionNodeAttachment[];
};

/** New boards are drafts; creators choose all steps and add their own Finish. */
export function createBasicVisionNodes(): (VisionNodeContent & {
  parentId: null; x: number; y: number; width: number; height: number;
})[] {
  return [{
    id: 'root', parentId: null, kind: 'start', label: 'Start',
    details: 'Add your nodes with +. Add a Finish node when your game plan is ready.',
    attachments: [], x: 24, y: 24, width: 270, height: 190,
  }];
}

export function visionBoardHasFinish(nodes: Pick<VisionNodeContent, 'kind'>[]): boolean {
  return nodes.some(node => node.kind === 'finish');
}
export const defaultVisionEffects: VisionEffects = {
  preset: 'none', brightness: 100, contrast: 100, saturation: 100, blur: 0,
};
export const visionEffectPresets = [
  { id: 'none', label: 'Original' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'dream', label: 'Dream glow' },
  { id: 'noir', label: 'Black & white' },
  { id: 'vivid', label: 'Vivid color' },
] as const;

const bounded = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function parseVisionEffects(value: unknown): VisionEffects {
  const item = (value && typeof value === 'object' ? value : {}) as Partial<VisionEffects>;
  return {
    preset: visionEffectPresets.some(preset => preset.id === item.preset) ? item.preset! : 'none',
    brightness: bounded(item.brightness, 100, 20, 200),
    contrast: bounded(item.contrast, 100, 20, 200),
    saturation: bounded(item.saturation, 100, 0, 250),
    blur: bounded(item.blur, 0, 0, 12),
  };
}

export function visionMediaFilter(effects: VisionEffects) {
  const preset = {
    none: '',
    cinematic: 'sepia(.12) saturate(.8) contrast(1.15)',
    vintage: 'sepia(.55) contrast(.9)',
    dream: 'saturate(1.15) brightness(1.08)',
    noir: 'grayscale(1) contrast(1.2)',
    vivid: 'saturate(1.5) contrast(1.1)',
  }[effects.preset];
  return `${preset} brightness(${effects.brightness}%) contrast(${effects.contrast}%) saturate(${effects.saturation}%) blur(${effects.blur}px)`.trim();
}

export function createVisionMenu(): VisionNodeAttachment {
  return {
    id: crypto.randomUUID(), kind: 'menu-screen', name: 'Menu screen', role: 'menu',
    effects: { ...defaultVisionEffects }, menuTitle: 'YOUR GAME', menuButtons: ['Play', 'Settings', 'Exit'],
  };
}

export function parseVisionAttachments(value: unknown, legacy?: {
  id?: string; kind?: string; mediaId?: string; mediaName?: string;
}): VisionNodeAttachment[] {
  if (!Array.isArray(value)) {
    if (legacy?.mediaId && ['image', 'video', 'audio'].includes(legacy.kind ?? '')) {
      return [{
        id: `legacy-${legacy.id}`, kind: legacy.kind as 'image' | 'video' | 'audio',
        mediaId: legacy.mediaId, name: legacy.mediaName ?? 'Saved attachment',
        role: 'reference', effects: { ...defaultVisionEffects },
      }];
    }
    if (legacy?.kind === 'menu-screen') return [{ ...createVisionMenu(), id: `legacy-menu-${legacy.id}` }];
    return [];
  }
  const seen = new Set<string>();
  return value.slice(0, 20).flatMap(raw => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Partial<VisionNodeAttachment>;
    if (typeof item.id !== 'string' || !item.id || seen.has(item.id) ||
      !['image', 'video', 'audio', 'menu-screen'].includes(item.kind ?? '') ||
      (item.kind !== 'menu-screen' && typeof item.mediaId !== 'string')) return [];
    seen.add(item.id);
    return [{
      id: item.id, kind: item.kind!, name: typeof item.name === 'string' ? item.name.slice(0, 180) : 'Attachment',
      ...(typeof item.mediaId === 'string' ? { mediaId: item.mediaId } : {}),
      role: (['reference', 'scene', 'menu'].includes(item.role ?? '') ? item.role : 'reference') as VisionAttachmentRole,
      effects: parseVisionEffects(item.effects),
      ...(item.kind === 'menu-screen' ? {
        menuTitle: typeof item.menuTitle === 'string' ? item.menuTitle.slice(0, 100) : 'YOUR GAME',
        menuButtons: Array.isArray(item.menuButtons)
          ? item.menuButtons.filter((label): label is string => typeof label === 'string').slice(0, 6).map(label => label.slice(0, 50))
          : ['Play', 'Settings', 'Exit'],
      } : {}),
    }];
  });
}
