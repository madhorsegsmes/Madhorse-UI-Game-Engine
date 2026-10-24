import { type ProjectAsset, type SceneEntity } from './scene-model';
import type { GameCamera } from './game-camera';
import { PRIMARY_CAMERA_ID, primaryCameraEntity } from './camera-editor';

type EgoWorkspaceProject = {
  entities: SceneEntity[];
  assets: ProjectAsset[];
  uiControls?: unknown[];
};

export type EgoInterfaceContext = {
  projectName: string;
  view: 'scene' | 'canvas' | 'play';
  toolset: 'world' | 'model';
  activeTool: string | null;
  inspectorName: string | null;
};

export type EgoWorkspaceContext = {
  interfaceSummary: string | null;
  selectedName: string | null;
  activeObjectCount: number;
  visibleNames: string[];
  cameraSummary: string;
  assets: Array<Pick<ProjectAsset, 'id' | 'name' | 'kind'>>;
  steps: string[];
  plannerSummary: string;
};

function shortName(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 48);
}

function vector(value: { x: number; y: number; z: number }) {
  return `${value.x.toFixed(1)}, ${value.y.toFixed(1)}, ${value.z.toFixed(1)}`;
}

export function createEgoWorkspaceContext(
  project: EgoWorkspaceProject,
  selectedEntityId: string | null,
  camera: GameCamera,
  ui?: EgoInterfaceContext,
): EgoWorkspaceContext {
  const selected = selectedEntityId === PRIMARY_CAMERA_ID
    ? primaryCameraEntity(camera)
    : project.entities.find(entity => entity.id === selectedEntityId) ?? null;
  const activeEntities = project.entities.filter(entity => entity.active);
  const assets = project.assets
    .filter(asset => asset.kind === 'image' || asset.kind === 'model')
    .slice(0, 8)
    .map(({ id, name, kind }) => ({ id, name, kind }));
  const visibleNames = activeEntities.slice(0, 8).map(entity => shortName(entity.name));
  const cameraSummary = `Position ${vector(camera.position)} · looking at ${vector(camera.target)} · ${camera.fov}°`;
  const components = selected?.components.map(component => component.type).filter((value, index, all) =>
    all.indexOf(value) === index).slice(0, 5) ?? [];
  const viewName = ui?.view === 'play' ? 'Play Test' : ui?.view === 'canvas' ? 'Canvas / Game Camera' : 'Scene view';
  const interfaceSummary = ui
    ? `Project: ${shortName(ui.projectName)}. View: ${viewName}. Panel 3: ${ui.inspectorName ? `editing ${shortName(ui.inspectorName)}` : 'Settings'}. Panel 5: ${ui.toolset === 'world' ? 'World Building' : '3D Modeling'}${ui.activeTool ? ` / ${shortName(ui.activeTool)}` : ''}.`
    : null;
  const steps = [
    ...(ui ? [
      ui.view === 'play' ? 'Top toolbar · Stop Play Test before editing your scene.'
        : ui.view === 'canvas' ? 'Top toolbar · Canvas is showing the Game Camera. Press Canvas again to return to Scene view.'
          : 'Panel 1 · Scene view is active. Select an object to move, rotate, or scale it.',
      ui.inspectorName
        ? `Panel 3 · You are editing “${shortName(ui.inspectorName)}”. Press Settings to return to the tools and Ego box.`
        : 'Panel 3 · Ego is below Vision Board. Open Ego for help with the current scene or your game vision.',
    ] : []),
    selected
      ? `Panel 2 · Hierarchy: “${shortName(selected.name)}” is selected${components.length ? ` (${components.join(', ')})` : ''}.`
      : 'Panel 2 · Hierarchy: select an object to edit, or right-click to create one.',
    selected
      ? 'Panel 3 · Settings: edit this object’s settings; open Functions & Controls to add a supported behavior.'
      : 'Panel 3 · Settings: this panel shows settings after you select an object in the Hierarchy.',
    assets.length
      ? `Panel 2 · Assets: ${assets.slice(0, 3).map(asset => asset.name).join(', ')}${assets.length > 3 ? ', and more' : ''}. Tell Ego the asset name or add it from Assets.`
      : 'Panel 2 · Assets: import a model or image first if you want Mad Builder to reuse your own art.',
    'Panel 1 · Scene View: inspect the selected object and frame the scene; the Game Camera is shown separately in its camera view.',
    'Panel 4 · Mad Builder: use it for a focused build or ask Ego to add a scene, functions, and a starter UI.',
    'Panel 5 · World Building / 3D Modeling: choose a tool, then edit the created object in the Hierarchy.',
    'Use Play/Test above Panel 2 to try the current supported controls.',
  ];
  const plannerSummary = [
    ...(interfaceSummary ? [interfaceSummary] : []),
    `Scene: ${activeEntities.length} active objects (${visibleNames.slice(0, 3).join(', ') || 'empty'}).`,
    `Selected: ${selected ? shortName(selected.name) : 'none'}.`,
    `Game Camera: ${vector(camera.position)} to ${vector(camera.target)}, ${camera.fov}°.`,
    `Project image/model asset IDs and names are supplied separately; choose a matching existing asset and never invent IDs.`,
  ].join(' ').slice(0, 650);

  return {
    interfaceSummary,
    selectedName: selected?.name ?? null,
    activeObjectCount: activeEntities.length,
    visibleNames,
    cameraSummary,
    assets,
    steps,
    plannerSummary,
  };
}
