import type { MadBuilderPlan } from '@workspace/api-client-react';

export type MadBuilderModuleCategory = 'vehicle' | 'house';
export type MadBuilderModuleId =
  | 'house-window' | 'house-door' | 'house-wall' | 'house-roof'
  | 'vehicle-wheel' | 'vehicle-headlight' | 'vehicle-door' | 'vehicle-mirror';

type ModulePart = {
  key: string;
  name: string;
  shape: NonNullable<MadBuilderPlan['parts'][number]['shape']>;
  position: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  color: string;
  rotation?: { x: number; y: number; z: number };
  opacity?: number;
};

export type MadBuilderModule = {
  id: MadBuilderModuleId;
  category: MadBuilderModuleCategory;
  label: string;
  description: string;
  prefabName: string;
  parts: ModulePart[];
};

const assembly = (
  id: MadBuilderModuleId,
  name: string,
  category: MadBuilderModuleCategory,
  parts: ModulePart[],
): MadBuilderModule => ({
    id,
    category,
    label: name,
    description: category === 'house' ? 'Editable trim, structure and insert parts.' : 'Editable body, glass and fitting parts.',
    prefabName: `Madhorse Module - ${name}`,
    parts,
  });

export const MAD_BUILDER_MODULES: MadBuilderModule[] = [
  assembly('house-window', 'Window Assembly', 'house', [
    { key: 'glass', name: 'Tinted window glass', shape: 'rounded-cube', position: { x: 0, y: 0, z: 0 }, size: { x: 1.05, y: 1.25, z: 0.08 }, color: '#82b9d0', opacity: 0.48 },
    { key: 'left-jamb', name: 'Left window jamb', shape: 'rounded-cube', position: { x: -0.62, y: 0, z: 0.06 }, size: { x: 0.14, y: 1.65, z: 0.18 }, color: '#eee2cc' },
    { key: 'right-jamb', name: 'Right window jamb', shape: 'rounded-cube', position: { x: 0.62, y: 0, z: 0.06 }, size: { x: 0.14, y: 1.65, z: 0.18 }, color: '#eee2cc' },
    { key: 'header', name: 'Window header', shape: 'cube', position: { x: 0, y: 0.76, z: 0.06 }, size: { x: 1.38, y: 0.14, z: 0.18 }, color: '#eee2cc' },
    { key: 'sill', name: 'Projecting window sill', shape: 'cube', position: { x: 0, y: -0.82, z: 0.12 }, size: { x: 1.5, y: 0.2, z: 0.28 }, color: '#d5c2a5' },
    { key: 'mullion', name: 'Center mullion', shape: 'cube', position: { x: 0, y: 0, z: 0.1 }, size: { x: 0.07, y: 1.38, z: 0.1 }, color: '#f3e8d2' },
  ]),
  assembly('house-door', 'Door Assembly', 'house', [
    { key: 'door', name: 'Raised-panel door', shape: 'rounded-cube', position: { x: 0, y: 0, z: 0 }, size: { x: 0.95, y: 2.05, z: 0.16 }, color: '#7a4938' },
    { key: 'frame-left', name: 'Left door casing', shape: 'cube', position: { x: -0.58, y: 0, z: 0.08 }, size: { x: 0.15, y: 2.3, z: 0.2 }, color: '#eee2cc' },
    { key: 'frame-right', name: 'Right door casing', shape: 'cube', position: { x: 0.58, y: 0, z: 0.08 }, size: { x: 0.15, y: 2.3, z: 0.2 }, color: '#eee2cc' },
    { key: 'transom', name: 'Decorative transom', shape: 'rounded-cube', position: { x: 0, y: 1.18, z: 0.08 }, size: { x: 1.25, y: 0.34, z: 0.16 }, color: '#82b9d0', opacity: 0.48 },
    { key: 'knob', name: 'Brass door knob', shape: 'sphere', position: { x: 0.34, y: -0.12, z: 0.18 }, size: { x: 0.1, y: 0.1, z: 0.1 }, color: '#c89a50' },
  ]),
  assembly('house-wall', 'Wall Section', 'house', [
    { key: 'wall', name: 'Exterior wall panel', shape: 'cube', position: { x: 0, y: 0, z: 0 }, size: { x: 4, y: 2.8, z: 0.26 }, color: '#d8c9b1' },
    { key: 'baseboard', name: 'Foundation trim', shape: 'cube', position: { x: 0, y: -1.35, z: 0.16 }, size: { x: 4.08, y: 0.18, z: 0.3 }, color: '#eee2cc' },
    { key: 'cornice', name: 'Top cornice', shape: 'cube', position: { x: 0, y: 1.38, z: 0.08 }, size: { x: 4.18, y: 0.2, z: 0.34 }, color: '#eee2cc' },
    { key: 'left-trim', name: 'Left vertical trim', shape: 'cube', position: { x: -1.92, y: 0, z: 0.16 }, size: { x: 0.16, y: 2.65, z: 0.24 }, color: '#f3e8d2' },
    { key: 'right-trim', name: 'Right vertical trim', shape: 'cube', position: { x: 1.92, y: 0, z: 0.16 }, size: { x: 0.16, y: 2.65, z: 0.24 }, color: '#f3e8d2' },
  ]),
  assembly('house-roof', 'Gabled Roof Section', 'house', [
    { key: 'left-slope', name: 'Left roof plane', shape: 'cube', position: { x: -1.1, y: 0.62, z: 0 }, size: { x: 2.65, y: 0.24, z: 3.2 }, rotation: { x: 0, y: 0, z: -32 }, color: '#30374b' },
    { key: 'right-slope', name: 'Right roof plane', shape: 'cube', position: { x: 1.1, y: 0.62, z: 0 }, size: { x: 2.65, y: 0.24, z: 3.2 }, rotation: { x: 0, y: 0, z: 32 }, color: '#30374b' },
    { key: 'ridge', name: 'Ridge cap', shape: 'rounded-cube', position: { x: 0, y: 1.32, z: 0 }, size: { x: 0.2, y: 0.18, z: 3.35 }, color: '#202633' },
    { key: 'fascia', name: 'Front fascia', shape: 'cube', position: { x: 0, y: -0.24, z: -1.62 }, size: { x: 4.6, y: 0.2, z: 0.16 }, color: '#eee2cc' },
  ]),
  assembly('vehicle-wheel', 'Wheel Assembly', 'vehicle', [
    { key: 'tire', name: 'Rubber tire', shape: 'cylinder', position: { x: 0, y: 0, z: 0 }, size: { x: 0.72, y: 0.3, z: 0.72 }, rotation: { x: 90, y: 0, z: 0 }, color: '#17191d' },
    { key: 'sidewall', name: 'Raised tire sidewall', shape: 'torus', position: { x: 0, y: 0, z: 0.18 }, size: { x: 0.54, y: 0.54, z: 0.08 }, color: '#303238' },
    { key: 'rim', name: 'Alloy rim', shape: 'cylinder', position: { x: 0, y: 0, z: 0.23 }, size: { x: 0.48, y: 0.48, z: 0.1 }, rotation: { x: 90, y: 0, z: 0 }, color: '#a9adb4' },
    { key: 'hub', name: 'Center hub', shape: 'cylinder', position: { x: 0, y: 0, z: 0.3 }, size: { x: 0.16, y: 0.16, z: 0.1 }, rotation: { x: 90, y: 0, z: 0 }, color: '#d0a24d' },
    ...Array.from({ length: 5 }, (_, index) => {
      const angle = index * (Math.PI * 2 / 5);
      return { key: `spoke-${index + 1}`, name: `Alloy spoke ${index + 1}`, shape: 'cube' as const,
        position: { x: Math.cos(angle) * 0.16, y: Math.sin(angle) * 0.16, z: 0.3 },
        size: { x: 0.06, y: 0.31, z: 0.07 }, rotation: { x: 0, y: 0, z: index * 72 }, color: '#d5d8dd' };
    }),
  ]),
  assembly('vehicle-headlight', 'Headlight Assembly', 'vehicle', [
    { key: 'housing', name: 'Recessed lamp housing', shape: 'rounded-cube', position: { x: 0, y: 0, z: 0 }, size: { x: 0.68, y: 0.28, z: 0.18 }, color: '#20242a' },
    { key: 'lens', name: 'Clear headlight lens', shape: 'rounded-cube', position: { x: 0, y: 0, z: 0.12 }, size: { x: 0.55, y: 0.18, z: 0.08 }, color: '#d8efff', opacity: 0.72 },
    { key: 'projector', name: 'Projector lamp', shape: 'cylinder', position: { x: -0.12, y: 0, z: 0.18 }, size: { x: 0.11, y: 0.11, z: 0.05 }, color: '#fff4c6' },
    { key: 'signal', name: 'Amber signal lens', shape: 'rounded-cube', position: { x: 0.2, y: 0, z: 0.17 }, size: { x: 0.12, y: 0.09, z: 0.04 }, color: '#f4a543' },
  ]),
  assembly('vehicle-door', 'Door and Glass Module', 'vehicle', [
    { key: 'door', name: 'Contoured door skin', shape: 'rounded-cube', position: { x: 0, y: 0, z: 0 }, size: { x: 1.2, y: 0.72, z: 0.16 }, color: '#b94c27' },
    { key: 'window', name: 'Side-window glass', shape: 'rounded-cube', position: { x: 0, y: 0.55, z: 0 }, size: { x: 1.04, y: 0.48, z: 0.08 }, color: '#253644', opacity: 0.58 },
    { key: 'beltline', name: 'Window beltline trim', shape: 'cube', position: { x: 0, y: 0.28, z: 0.1 }, size: { x: 1.2, y: 0.055, z: 0.07 }, color: '#c5c6c9' },
    { key: 'handle', name: 'Flush door handle', shape: 'rounded-cube', position: { x: 0.35, y: 0.08, z: 0.12 }, size: { x: 0.24, y: 0.07, z: 0.06 }, color: '#d7d5d2' },
  ]),
  assembly('vehicle-mirror', 'Side Mirror Assembly', 'vehicle', [
    { key: 'mount', name: 'Mirror mounting arm', shape: 'cylinder', position: { x: 0, y: -0.08, z: 0 }, size: { x: 0.08, y: 0.36, z: 0.08 }, rotation: { x: 0, y: 0, z: -24 }, color: '#20242a' },
    { key: 'shell', name: 'Painted mirror shell', shape: 'rounded-cube', position: { x: 0, y: 0.13, z: 0.02 }, size: { x: 0.4, y: 0.25, z: 0.25 }, color: '#b94c27' },
    { key: 'glass', name: 'Mirror glass', shape: 'rounded-cube', position: { x: 0, y: 0.13, z: 0.16 }, size: { x: 0.28, y: 0.15, z: 0.035 }, color: '#9ec7d9', opacity: 0.72 },
    { key: 'indicator', name: 'Mirror signal strip', shape: 'cube', position: { x: 0, y: 0.02, z: 0.16 }, size: { x: 0.24, y: 0.035, z: 0.025 }, color: '#f3a14a' },
  ]),
];

export function getMadBuilderModules(category: MadBuilderModuleCategory) {
  return MAD_BUILDER_MODULES.filter((module) => module.category === category);
}

export function getMadBuilderModule(id: MadBuilderModuleId) {
  const module = MAD_BUILDER_MODULES.find((item) => item.id === id);
  if (!module) throw new Error('This Mad Builder module is not available.');
  return module;
}

export function createMadBuilderModulePlan(moduleId: MadBuilderModuleId): MadBuilderPlan {
  const module = getMadBuilderModule(moduleId);
  return {
    title: module.label,
    summary: `${module.label} made from separate editable parts and saved to the project prefab library.`,
    warnings: [],
    parts: [
      {
        key: 'module-root', parentKey: null, kind: 'group', name: module.label,
        position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 }, color: '#bfc3ca',
      },
      ...module.parts.map((part) => ({
        ...part, parentKey: 'module-root', kind: 'box' as const,
        rotation: part.rotation ?? { x: 0, y: 0, z: 0 },
      })),
    ],
  };
}
