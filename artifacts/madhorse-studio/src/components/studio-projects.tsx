import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import BlankWorkspace from './blank-workspace';
import { loadStudioProjects, saveStudioProjects, validateProjectName, type StudioProjectRegistry } from '@/lib/studio-projects';
import { exportStudioProject } from '@/lib/project-file';
import { WebGameExportDialog } from './web-game-export-dialog';
import type { FreshWorkspaceSnapshot } from '@/lib/fresh-workspace-storage';
import './studio-projects.css';
import { getSystemActivity, subscribeSystemActivity } from '@/lib/system-activity';
import { createEgoUiKit } from '@/lib/ego-ui-kit';
import { createGameCamera } from '@/lib/game-camera';
import { createGameStarterKit } from '@/lib/scene-starter-kits';
import { FPS_CONTROLS, THIRD_PERSON_SHOOTER_CONTROLS } from '@/lib/fps-starter-kit';
import { removeFreshWorkspace, saveFreshWorkspace } from '@/lib/fresh-workspace-storage';
import { deleteLocalAsset, saveLocalAsset } from '@/lib/asset-vault';
import { getTransform, type ProjectAsset } from '@/lib/scene-model';
import { useSceneRenderSettings } from '@/hooks/use-scene-render-settings';
import { defaultFightingAppearancePair, type FightingAppearancePair } from '@/lib/fighter-appearance';
import { FightingCharacterCustomization } from './fighting-character-customization';
import { PIXEL_RPG_CONTROLS } from '@/lib/pixel-rpg-starter';

const fightingStarterVision = 'A fixed side-view 3D fighting game with detailed human fighters, editable combat actions and HUD, plus imported FBX fighters and high-resolution stage assets.';
const rtsStarterVision = 'An editable isometric medieval RTS settlement in Sunstone Vale: a fortified keep, terracotta cottages, market roads, crop farms, wooded edges, resource sites, human squads, and an eastern outpost.';

type StarterChoice = '2d-fighting' | 'rts' | 'fps' | 'third-person-shooter' | 'mmorpg' | '2d-rpg';

function readStarterChoice(): StarterChoice | null {
  const requested = new URLSearchParams(window.location.search).get('starter');
  return requested === 'rts' || requested === '2d-fighting' || requested === '2d-rpg' || requested === 'fps' ||
    requested === 'third-person-shooter' || requested === 'mmorpg'
    ? requested
    : null;
}

function createStarterSnapshot(projectName: string, choice: StarterChoice, fighterAppearances: FightingAppearancePair): {
  snapshot: FreshWorkspaceSnapshot;
  generatedAssets: Array<{ asset: ProjectAsset; file: File }>;
} {
  const isRts = choice === 'rts';
  const isFps = choice === 'fps';
  const isThirdPerson = choice === 'third-person-shooter';
  const isMmorpg = choice === 'mmorpg';
  const isPixelRpg = choice === '2d-rpg';
  const starter = createGameStarterKit(
    isPixelRpg ? 'pixel-rpg' : isFps ? 'shooter' : isRts ? 'rts' : isThirdPerson ? 'third-person-shooter' : isMmorpg ? 'mmorpg' : 'fighting',
    { x: -15, y: 50, z: 0 },
    fighterAppearances,
  );
  const player = starter.entities.find(entity => entity.id === starter.playerId);
  const playerPosition = player ? getTransform(player).position : { x: 50, y: 50, z: 0 };
  const playerWorld = {
    x: (playerPosition.x - 50) / 10,
    y: playerPosition.z / 10,
    z: (playerPosition.y - 50) / 10,
  };
  const camera = createGameCamera(starter.entities);
  camera.position = isFps ? { x: playerWorld.x, y: playerWorld.y + 1.6, z: playerWorld.z }
    : isRts ? { x: 8, y: 32, z: 36 }
      : isThirdPerson || isMmorpg ? { x: playerWorld.x + 3, y: playerWorld.y + 5, z: playerWorld.z - 10 }
        : { x: 0, y: 1.2, z: -17 };
  camera.target = isFps ? { x: playerWorld.x, y: playerWorld.y + 1.6, z: playerWorld.z + 12 }
    : isRts ? { x: 0, y: 0, z: 0 }
      : isThirdPerson || isMmorpg ? { x: playerWorld.x, y: playerWorld.y + 1.2, z: playerWorld.z + 2 }
        : { x: 0, y: 1.2, z: 0 };
  camera.fov = isFps ? 70 : isRts ? 43 : isThirdPerson || isMmorpg ? 55 : 42;
  camera.placement = 'custom';
  const uiControls = isPixelRpg ? [] : createEgoUiKit([isFps || isThirdPerson ? 'shooter' : isRts ? 'rts' : 'fighting'], 0);
  return {
    snapshot: {
      projectName,
      egoGameVision: isPixelRpg ? 'An original color-handheld-style 2D pixel RPG: Mosslight Trail village, grid exploration, talking neighbors, healing, wild creature encounters, turn-based combat, capture orbs, an editable companion and a first capture-and-return quest.'
        : isMmorpg ? 'A multiplayer fantasy role-playing world with a detailed third-person hero, first-person view toggle, settlement, quests, NPCs, melee combat, spells, health, inventory, gathering, crafting, and editable story progression.'
        : isFps ? 'First-person industrial training facility with editable cover, lighting, modular carbine, six targets, collision-aware shooting, ammo, reload, sprint, crouch and jump.'
        : isThirdPerson ? 'Third-person tactical shooter with a detailed human operative, an over-the-shoulder camera, editable cover, a modular carbine, targets, collision-aware shooting, ammo, reload, sprint, crouch, jump, and multiplayer movement.'
          : isRts ? rtsStarterVision : fightingStarterVision,
      egoGameFlow: 'undecided',
      egoGameNotes: isPixelRpg ? PIXEL_RPG_CONTROLS : isMmorpg
        ? 'MMORPG starter controls: WASD to move, F to fight, Q to cast, H to heal, G to gather, K to craft, U to recruit a companion, Shift to run, C to crouch, E to interact, and V to switch between first- and third-person views. Use Multiplayer Tools to host or join a room (up to 32 players). This is an editable multiplayer starter, not a persistent MMO service.'
        : isFps ? FPS_CONTROLS : isThirdPerson ? THIRD_PERSON_SHOOTER_CONTROLS : isRts
        ? 'RTS starter controls: move with WASD; press T to order nearby allied NPCs to the Market Gate beacon, G to gather a nearby resource cache, K to craft planks, and B to place a temporary construction block. The starting scene is assembled from editable keep, cottage, farm, road, well, forest, resource, and squad pieces. Edit the mission, terrain, buildings, units, and HUD in Studio. This starter is a playable prototype, not a complete commercial RTS: squad selection, pathfinding, and a full economy are not included yet.'
        : 'Use A/D to move, F/G for attacks, Control to block, Shift to run, and C to crouch. Import a fighter image or FBX/GLB model through Hierarchy → Import asset. Double-click Player Fighter or Training Rival, choose Character type and its asset under Replace fighter · 2D / 3D, then Save Changes. This changes appearance without removing combat or movement. Import FBX or GLB stage models and their image textures for high-resolution environments. Edit health bars and action buttons in the UI builder.',
      entities: starter.entities,
      camera,
      assets: starter.generatedAssets?.map(({ asset }) => asset) ?? [],
      animations: [],
      animationControllers: [],
      builderHistory: [],
      builderDraft: null,
      builderDraftRequest: '',
      builderBuildLogs: [],
      prefabs: [],
      uiControls,
      scripts: [],
    },
    generatedAssets: starter.generatedAssets ?? [],
  };
}

function clearStarterRequestFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('starter');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export default function StudioProjects() {
  const [initial] = useState(() => {
    try { return { registry: loadStudioProjects(), error: '' }; }
    catch { return { registry: null, error: 'Could not read the saved project list. No project data was changed. Check browser storage before continuing.' }; }
  });
  const [registry, setRegistry] = useState<StudioProjectRegistry | null>(initial.registry);
  const active = registry?.projects.find(project => project.id === registry.activeId);
  const [templateChoice, setTemplateChoice] = useState<StarterChoice | null>(() => readStarterChoice());
  const [fighterAppearances, setFighterAppearances] = useState<FightingAppearancePair>(() => ({
    player: { ...defaultFightingAppearancePair.player },
    rival: { ...defaultFightingAppearancePair.rival },
  }));
  const [, setRenderSettings] = useSceneRenderSettings();
  const [mode, setMode] = useState<'name' | 'new' | 'rename' | 'template' | null>(() => {
    if (readStarterChoice()) return 'template';
    return active?.name ? null : 'name';
  });
  const [draft, setDraft] = useState(() =>
    templateChoice === 'fps' ? 'My FPS Game'
      : templateChoice === 'third-person-shooter' ? 'My Third-Person Shooter'
        : templateChoice === 'mmorpg' ? 'My MMORPG'
        : templateChoice === 'rts' ? 'My RTS Game'
          : templateChoice === '2d-fighting' ? 'My 2D/3D Fighting Game' : '',
  );
  const [error, setError] = useState(initial.error);
  const [savingProject, setSavingProject] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ kind: 'progress' | 'success' | 'error'; message: string } | null>(null);
  const [webExport, setWebExport] = useState<{ projectId: string; name: string; snapshot: FreshWorkspaceSnapshot } | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const wasWebExportOpen = useRef(false);
  useEffect(() => {
    if (!webExport && wasWebExportOpen.current) {
      menu.current?.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
    }
    wasWebExportOpen.current = webExport !== null;
  }, [webExport]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && menu.current) menu.current.open = false;
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  const activity = useSyncExternalStore(subscribeSystemActivity, getSystemActivity, getSystemActivity);
  if (!registry || !active) return <main className="studio-project-error" role="alert">{error}</main>;
  function persist(next: StudioProjectRegistry) {
    try { saveStudioProjects(next); setRegistry(next); setError(''); return true; }
    catch { setError('Could not save the project list in this browser. No project was switched or replaced. Check available storage.'); return false; }
  }
  function open(next: 'new' | 'rename') {
    if (menu.current) menu.current.open = false;
    setDraft(next === 'rename' ? active!.name : ''); setError(''); setMode(next);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    let name: string;
    try { name = validateProjectName(draft); } catch (cause) { setError((cause as Error).message); return; }
    if (!registry || !active) return;
    if (mode === 'template') {
      if (registry.projects.length >= 200) {
        setError('This browser has reached the 200-project limit. Remove or export a project before creating another.');
        return;
      }
      const id = crypto.randomUUID();
      setSavingProject(true);
      let generatedAssetIds: string[] = [];
      try {
        const starterChoice = templateChoice ?? '2d-fighting';
        const { snapshot, generatedAssets } = createStarterSnapshot(name, starterChoice, fighterAppearances);
        generatedAssetIds = generatedAssets.map(({ asset }) => asset.id);
        await Promise.all(generatedAssets.map(({ asset, file }) => saveLocalAsset(id, asset.id, file)));
        saveFreshWorkspace(snapshot, id);
        const next: StudioProjectRegistry = {
          activeId: id,
          projects: [...registry.projects, { id, name }],
        };
        if (!persist(next)) {
          removeFreshWorkspace(id);
          await Promise.all(generatedAssets.map(({ asset }) => deleteLocalAsset(id, asset.id)));
          return;
        }
        if (starterChoice === 'rts' || starterChoice === 'fps' || starterChoice === 'mmorpg') {
          setRenderSettings(current => ({ ...current, quality: 'high' }));
        }
        clearStarterRequestFromUrl();
        setTemplateChoice(null);
        setMode(null);
        setDraft('');
        setExportStatus(null);
      } catch (cause) {
        try { removeFreshWorkspace(id); } catch { /* Storage may be unavailable. Existing project data stays untouched. */ }
        await Promise.allSettled(generatedAssetIds.map(assetId => deleteLocalAsset(id, assetId)));
        const kindLabel = templateChoice === 'mmorpg' ? 'MMORPG' : templateChoice === 'fps' ? 'FPS'
          : (templateChoice ?? '2d-fighting') === 'rts' ? 'RTS' : 'fighting-game';
        setError(cause instanceof Error
          ? `The ${kindLabel} starter could not be saved. Existing projects were left untouched. ${cause.message}`
          : `The ${kindLabel} starter could not be saved. Existing projects were left untouched.`);
      } finally {
        setSavingProject(false);
      }
      return;
    }
    if (mode === 'new' && activity.pending > 0) { setError('Wait for the current operation to finish before creating another project.'); return; }
    const id = mode === 'new' ? crypto.randomUUID() : active.id;
    const next = mode === 'new'
      ? { activeId: id, projects: [...registry.projects, { id, name }] }
      : { ...registry, projects: registry.projects.map(project => project.id === id ? { ...project, name } : project) };
    if (persist(next)) { setMode(null); setDraft(''); setExportStatus(null); }
  }
  async function saveProjectFile(snapshot: FreshWorkspaceSnapshot) {
    if (savingProject || activity.pending > 0 || !active) return;
    setSavingProject(true);
    setExportStatus({ kind: 'progress', message: 'Preparing the project file…' });
    try {
      const archive = await exportStudioProject(active.id, active.name, snapshot, message => setExportStatus({ kind: 'progress', message }));
      const url = URL.createObjectURL(archive.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = archive.fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setExportStatus({
        kind: 'success',
        message: `Saved ${archive.fileName} with ${archive.attachmentCount} imported file${archive.attachmentCount === 1 ? '' : 's'} and this project's scene data.`,
      });
    } catch (cause) {
      setExportStatus({ kind: 'error', message: cause instanceof Error ? cause.message : 'Could not save the project file.' });
    } finally {
      setSavingProject(false);
    }
  }
  return <>
    <BlankWorkspace key={active.id} projectId={active.id} projectName={active.name}
      projectControls={(readOnly, snapshot) => {
        const disabled = readOnly || activity.pending > 0 || savingProject;
        return <>
        <details className="studio-project-menu" ref={menu} onKeyDown={event => {
          if (event.key === 'Escape') {
            event.stopPropagation(); event.preventDefault();
            if (menu.current) menu.current.open = false;
            menu.current?.querySelector('summary')?.focus();
          }
        }}>
        <summary tabIndex={0} data-testid="button-project">Project</summary>
        <div className="studio-project-menu-body">
          <button type="button" onClick={() => {
            if (menu.current) menu.current.open = false;
            void saveProjectFile(snapshot);
          }} disabled={disabled} title="Download your editable project and imported files"
            aria-label={savingProject ? 'Saving project file' : 'Save project file'} data-testid="button-save-project">
            <Save size={12} aria-hidden="true" /> {savingProject ? 'Saving…' : 'Save'}
          </button>
          <button type="button" disabled={disabled} onClick={() => {
            if (menu.current) menu.current.open = false;
            if (active) setWebExport({ projectId: active.id, name: active.name, snapshot });
          }} data-testid="button-export-web-game">Export Web Game</button>
          <button type="button" disabled title="Android compilation is not configured. This option cannot generate an APK yet."
            data-testid="button-export-apk">Export APK <small>Not configured</small></button>
          <button type="button" disabled={disabled || registry.projects.length >= 200} onClick={() => open('new')}>New project</button>
          <button type="button" disabled={disabled} onClick={() => open('rename')}>Rename project</button>
          <button type="button" disabled={disabled} data-testid="button-exit-hub" onClick={() => {
            try {
              saveFreshWorkspace(snapshot, active.id);
              window.location.assign(`${import.meta.env.BASE_URL}hub/`);
            } catch (cause) {
              setExportStatus({ kind: 'error', message: `Could not save before exiting: ${cause instanceof Error ? cause.message : 'storage unavailable'}. Your project is still open.` });
            }
          }}>Exit to Hub</button>
          <span>Open saved project</span>
          {registry.projects.map(project => <button key={project.id} type="button" title={project.name}
            disabled={disabled} aria-current={project.id === active.id ? 'true' : undefined}
            onClick={() => {
              if (persist({ ...registry, activeId: project.id }) && menu.current) menu.current.open = false;
            }}>{project.name || 'Name your project'}</button>)}
        </div>
        </details>
        </>;
      }} />
    {exportStatus && <div className={`studio-project-notice studio-export-notice is-${exportStatus.kind}`}
      role={exportStatus.kind === 'error' ? 'alert' : 'status'}>{exportStatus.message}</div>}
    {webExport && <WebGameExportDialog {...webExport} onClose={() => setWebExport(null)} />}
    {error && !mode && <div className="studio-project-notice" role="alert">{error}</div>}
    {mode && <div className="studio-project-backdrop">
      <form className="studio-project-dialog" role="dialog" aria-modal="true" aria-labelledby="project-name-heading"
        onSubmit={submit} onKeyDown={event => {
          if (event.key === 'Escape' && mode !== 'name' && !savingProject) {
            event.stopPropagation();
            if (mode === 'template') {
              clearStarterRequestFromUrl();
              setTemplateChoice(null);
            }
            setMode(null);
            setError('');
          }
          if (event.key === 'Tab') {
            const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('input, button')];
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
          }
        }}>
        <h2 id="project-name-heading">{mode === 'template'
          ? templateChoice === '2d-rpg' ? 'Name your 2D RPG'
            : templateChoice === 'mmorpg' ? 'Name your MMORPG'
            : templateChoice === 'fps' ? 'Name your FPS game'
            : templateChoice === 'third-person-shooter' ? 'Name your third-person shooter'
              : templateChoice === 'rts' ? 'Name your RTS project' : 'Name your 2D/3D fighting game'
          : mode === 'new' ? 'New project' : mode === 'rename' ? 'Rename project' : 'Name your project'}</h2>
        <p>{mode === 'template'
          ? templateChoice === '2d-rpg' ? 'Create Mosslight Trail: an original color-handheld-style 2D RPG with an editable pixel town, sprites, talking neighbors, healing, creature battles, capture orbs and a first quest. Use WASD/arrows, E to talk and battle keys 1–3. Your other projects remain untouched.'
            : templateChoice === 'mmorpg' ? 'Create an editable fantasy MMORPG starter with a detailed hero, quest guide, settlement, combat, spells, inventory, gathering, crafting, and a V key to switch between first- and third-person views. Multiplayer rooms support up to 32 players. This is a playable starter, not a persistent MMO service; your other projects remain untouched.'
            : templateChoice === 'fps' ? 'Create an editable first-person training facility with a modular weapon, six targets, colliding walls and cover, PBR surfaces, lighting, shooting, reload, sprint, crouch, jump, and a HUD. Press Play Test to begin. Your other projects remain untouched.'
            : templateChoice === 'third-person-shooter' ? 'Create an editable tactical shooter with a detailed human operative, shoulder camera, cover, moving target operatives, shooting, reload, sprint, crouch, jump, and multiplayer movement. Your other projects remain untouched.'
              : templateChoice === 'rts'
            ? 'This creates a separate RTS project with an editable strategy map, two bases, squads, resource caches, a rally objective, and a mission HUD. Studio will start with its High render preset; you can change it later. Existing projects stay untouched.'
            : 'This creates a separate project with a fighting arena, two editable fighters, combat controls, and a Play Test HUD. Change the floor, backdrop, sky, textures, objects, controls, and HUD in Studio. Your other saved projects stay untouched.'
          : mode === 'new'
            ? 'Your current project stays saved in this browser.'
            : 'This name will appear above the scene view. Your scene and files will be kept.'}</p>
        <label>Project name
          <input autoFocus required maxLength={80} value={draft} onChange={event => setDraft(event.target.value)}
            aria-describedby={error ? 'project-name-error' : undefined} />
        </label>
        {mode === 'template' && templateChoice === '2d-fighting' &&
          <FightingCharacterCustomization value={fighterAppearances} onChange={setFighterAppearances} />}
        {error && <p id="project-name-error" role="alert">{error}</p>}
        <footer>
          {mode !== 'name' && <button type="button" disabled={savingProject} onClick={() => {
            if (mode === 'template') {
              clearStarterRequestFromUrl();
              setTemplateChoice(null);
            }
            setMode(null);
            setError('');
          }}>Cancel</button>}
          <button type="submit" disabled={savingProject}>{savingProject ? 'Creating…'
            : mode === 'template' ? templateChoice === 'mmorpg' ? 'Create MMORPG'
              : templateChoice === 'fps' ? 'Create FPS game'
              : templateChoice === 'third-person-shooter' ? 'Create third-person shooter'
                : templateChoice === 'rts' ? 'Create RTS project' : 'Create fighting game'
              : mode === 'new' ? 'Create project' : 'Save name'}</button>
        </footer>
      </form>
    </div>}
  </>;
}
