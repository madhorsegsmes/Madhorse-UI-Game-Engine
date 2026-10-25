import { useUser } from '@clerk/react';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Compass,
  Flame,
  Globe2,
  Layers3,
  Plus,
  ScanLine,
  Sparkles,
  Swords,
} from 'lucide-react';
import './hub-page.css';
import { createGameStarterKit, type GameStarterKitId } from '@/lib/scene-starter-kits';
import { createFightingPreviewCamera } from '@/lib/fighting-preview-camera';
import { createGameCamera } from '@/lib/game-camera';
import { getTransform } from '@/lib/scene-model';
import { DEFAULT_SCENE_RENDER_SETTINGS } from '@/hooks/use-scene-render-settings';
import { ScenePreview3D } from './scene-preview-3d';
import { SceneRenderFallback } from './scene-render-fallback';

const basePath = import.meta.env.BASE_URL;
const studioPath = `${basePath}editor/`;
const visionPath = `${basePath}editor/vision-board/`;

function getFirstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || 'Creator';
}

function EngineArtwork() {
  return (
    <div className="hub-artwork" aria-hidden="true">
      <div className="hub-artwork-topline">
        <span>WORLD / 001</span>
        <span>PREVIEW WINDOW</span>
        <span>2D · 3D</span>
      </div>
      <div className="hub-artwork-canvas">
        <div className="hub-grid-plane" />
        <div className="hub-orbit hub-orbit-one" />
        <div className="hub-orbit hub-orbit-two" />
        <div className="hub-art-sun" />
        <div className="hub-horizon" />
        <div className="hub-scene-silhouette">
          <span className="hub-tower tower-a" />
          <span className="hub-tower tower-b" />
          <span className="hub-tower tower-c" />
          <span className="hub-tower tower-d" />
          <span className="hub-groundline" />
        </div>
        <span className="hub-crosshair crosshair-a" />
        <span className="hub-crosshair crosshair-b" />
        <span className="hub-art-coordinate">X 048.2&nbsp; / &nbsp;Y 012.8</span>
        <span className="hub-art-number">01</span>
      </div>
      <div className="hub-artwork-footer">
        <span><i /> EDITORIAL PREVIEW</span>
        <span>BUILT IN MADHORSE ENGINE</span>
      </div>
    </div>
  );
}

const fightingFallbackSettings = {
  ...DEFAULT_SCENE_RENDER_SETTINGS,
  showGrid: false,
  background: '#333538',
};

type HubStarterKind = Extract<GameStarterKitId, 'fighting' | 'rts' | 'shooter' | 'third-person-shooter' | 'mmorpg' | 'pixel-rpg'>;

function templatePreviewCamera(kind: HubStarterKind, aspect: number, playerWorld: { x: number; z: number }) {
  if (kind === 'fighting') return createFightingPreviewCamera(aspect);
  if (kind === 'rts') {
    return {
      ...createGameCamera([]),
      placement: 'custom' as const,
      fov: 46,
      position: { x: 37, y: 37, z: -46 },
      target: { x: 0, y: 2, z: 0 },
    };
  }
  if (kind === 'third-person-shooter' || kind === 'mmorpg') {
    return {
      ...createGameCamera([]),
      placement: 'custom' as const,
      fov: 48,
      position: { x: playerWorld.x + 8, y: 8, z: playerWorld.z - 13 },
      target: { x: playerWorld.x, y: 1.2, z: playerWorld.z },
    };
  }
  const distance = Math.max(1, 1.6 / Math.max(.3, aspect));
  return {
    ...createGameCamera([]),
    placement: 'custom' as const,
    fov: 50,
    position: { x: 21 * distance, y: 20 * distance, z: -31 * distance },
    target: { x: 0, y: 1, z: 1 },
  };
}

function FightingGamePreview({ kind }: { kind: HubStarterKind }) {
  // Every card renders editable objects from the same starter users receive in Studio.
  const [starter] = useState(() => createGameStarterKit(kind, { x: -15, y: 50, z: 0 }));
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const stageRef = useRef<HTMLDivElement>(null);
  const generatedAssets = starter.generatedAssets ?? [];
  const player = starter.entities.find(entity => entity.id === starter.playerId);
  const playerTransform = player ? getTransform(player).position : { x: 50, y: 50, z: 0 };
  const playerWorld = { x: (playerTransform.x - 50) / 10, z: (playerTransform.y - 50) / 10 };
  const [camera, setCamera] = useState(() => templatePreviewCamera(kind, 16 / 9, playerWorld));
  const previewLabels: Record<HubStarterKind, [string, string]> = {
    'pixel-rpg': ['MOSSLIGHT TRAIL', 'EDITABLE 2D RPG'],
    fighting: ['3D FIGHTERS', 'SIDE-VIEW ARENA'],
    rts: ['SUNSTONE VALE', 'EDITABLE RTS WORLD'],
    shooter: ['IRONLIGHT FACILITY', 'FIRST-PERSON RANGE'],
    'third-person-shooter': ['IRONLIGHT OPS', 'THIRD-PERSON COMBAT'],
    mmorpg: ['SUNSTONE VALE', 'MMORPG ADVENTURE'],
  };
  const [sceneLabel, detailLabel] = previewLabels[kind];

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      if (stage.clientWidth && stage.clientHeight) {
        setCamera(templatePreviewCamera(kind, stage.clientWidth / stage.clientHeight, playerWorld));
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    fit();
    return () => observer.disconnect();
  }, [kind]);

  useEffect(() => {
    const urls = Object.fromEntries(generatedAssets.map(({ asset, file }) =>
      [asset.id, URL.createObjectURL(file)]));
    setAssetUrls(urls);
    return () => Object.values(urls).forEach(URL.revokeObjectURL);
  }, [starter, generatedAssets]);

  return (
    <div className="hub-fight-screen">
      <div className="hub-fight-toolbar">
        <span><i /> PLAY TEST</span>
        <span>{sceneLabel} <b>/</b> {detailLabel}</span>
        <span>TEMPLATE SCENE</span>
      </div>
      <div ref={stageRef} className="hub-fight-model-stage" data-testid={`hub-${kind}-model-preview`}>
        <ScenePreview3D
          projectName={starter.title}
          gameView
          staticPreview
          gameCamera={camera}
          primaryCamera={camera}
          entities={starter.entities}
          assets={generatedAssets.map(({ asset }) => asset)}
          assetUrls={assetUrls}
          selectedEntityId={null}
          playerPreviewPosition={{ x: playerTransform.x, y: playerTransform.y }}
          transformMode="translate"
          readOnly
          onSelectEntity={() => undefined}
          onTransformCommit={() => undefined}
          onTransformModeChange={() => undefined}
          graphicsFallback={
            <SceneRenderFallback
              gameView
              detail="full"
              entities={starter.entities}
              camera={camera}
              settings={fightingFallbackSettings}
              zoom={100}
              sceneFocus={null}
              selectedEntityId={null}
              onSelectEntity={() => undefined}
            />
          }
        />
      </div>
    </div>
  );
}

function RtsGamePreview() {
  return <FightingGamePreview kind="rts" />;
}

export default function HubPage() {
  const { user } = useUser();
  const firstName = getFirstName(user?.firstName ?? user?.fullName);
  const initials = (user?.firstName?.[0] || user?.fullName?.[0] || 'C').toUpperCase();

  return (
    <main className="madhorse-hub">
      <div className="hub-shell">
        <header className="hub-header">
          <a className="hub-brand" href={studioPath} aria-label="Open Madhorse Studio">
            <span className="hub-brand-mark"><img src={`${basePath}logo.svg`} alt="" /></span>
            <span className="hub-brand-wordmark">MADHORSE <em>ENGINE</em></span>
          </a>
          <div className="hub-header-center"><span className="hub-live-indicator" /> CREATOR WORKSPACE <span className="hub-header-slash">/</span> HOME</div>
          <div className="hub-profile" data-testid="profile-creator">
            <span className="hub-profile-copy">
              <strong>{user?.fullName || user?.username || 'Creator account'}</strong>
              <small>PERSONAL WORKSPACE</small>
            </span>
            {user?.imageUrl
              ? <img className="hub-avatar-image" src={user.imageUrl} alt="" />
              : <span className="hub-avatar-fallback">{initials}</span>}
          </div>
        </header>

        <section className="hub-hero" aria-labelledby="hub-title">
          <div className="hub-hero-copy">
            <div className="hub-kicker"><span className="hub-kicker-line" /> YOUR CREATION DESK <span className="hub-kicker-index">01 — 03</span></div>
            <h1 id="hub-title">Make a world<br /><span>worth playing.</span></h1>
            <p className="hub-welcome">Good to have you here, {firstName}.</p>
            <p className="hub-description">Start with a spark. Shape it into scenes, systems, and a world that feels like yours. Your next build begins in the Studio.</p>
            <div className="hub-hero-actions">
              <a className="hub-primary-action" href={studioPath} data-testid="link-open-studio">
                <span className="hub-action-icon"><Plus size={18} strokeWidth={2.1} /></span>
                <span><small>START BUILDING</small><strong>Open Madhorse Studio</strong></span>
                <ArrowUpRight size={18} className="hub-action-arrow" />
              </a>
              <a className="hub-text-action" href={visionPath} data-testid="link-open-vision-board">
                Explore the Vision Board <ArrowRight size={15} />
              </a>
            </div>
            <div className="hub-hero-meta">
              <span><ScanLine size={15} /> SCENES, OBJECTS &amp; PLAY</span>
              <i />
              <span>YOUR PROJECTS STAY IN THIS BROWSER</span>
            </div>
          </div>
          <div className="hub-hero-visual">
            <div className="hub-visual-label"><span>FIG. 01</span><span>AN IDEA IN MOTION</span></div>
            <EngineArtwork />
            <div className="hub-visual-side-note">WORLD BUILDING<br />STARTS HERE <ArrowDownRight size={15} /></div>
          </div>
          <div className="hub-hero-index" aria-hidden="true">M / 01</div>
        </section>

        <section className="hub-pathways" aria-labelledby="hub-pathways-title">
          <div className="hub-section-intro">
            <div>
              <div className="hub-kicker"><span className="hub-kicker-line" /> THREE WAYS INTO YOUR WORLD</div>
              <h2 id="hub-pathways-title">Choose your <span>next move.</span></h2>
            </div>
            <p>Choose a fighting game, an RTS world, a first-person range, or a third-person shooter, then edit the starter in Studio.</p>
          </div>
          <div className="hub-pathway-grid">
            <a className="hub-pathway-card hub-pathway-studio" href={`${studioPath}?starter=2d-fighting`} data-testid="card-studio">
              <div className="hub-card-top"><span>01 / FIGHTING STARTER</span><span className="hub-card-index"><Swords size={16} /></span></div>
              <div className="hub-card-graphic hub-graphic-fighting" aria-hidden="true">
                <FightingGamePreview kind="fighting" />
              </div>
              <div className="hub-card-copy">
                <h3>2D/3D Fighting Game</h3>
                <p>Make it yours: replace either fighter with a 2D sprite or 3D model; change the floor, backdrop, textures, sky, combat controls, and HUD in Studio.</p>
              </div>
              <span className="hub-card-link">CREATE FIGHTING PROJECT <ArrowUpRight size={15} /></span>
            </a>

            <a className="hub-pathway-card hub-pathway-rts" href={`${studioPath}?starter=rts`} data-testid="card-rts">
              <div className="hub-card-top"><span>02 / RTS STARTER</span><span className="hub-card-index"><Compass size={16} /></span></div>
              <div className="hub-card-graphic hub-graphic-rts" aria-hidden="true">
                <RtsGamePreview />
              </div>
              <div className="hub-card-copy">
                <h3>Strategy World</h3>
                <p>Customize the whole strategy world: terrain, sky, buildings, roads, trees, units, textures, resources, rules, and HUD. Every scene piece is editable in your project.</p>
              </div>
              <span className="hub-card-link">CREATE RTS PROJECT <ArrowUpRight size={15} /></span>
            </a>

            <a className="hub-pathway-card hub-pathway-studio" href={`${studioPath}?starter=fps`} data-testid="card-fps">
              <div className="hub-card-top"><span>03 / FPS STARTER</span><span className="hub-card-index"><ScanLine size={16} /></span></div>
              <div className="hub-card-graphic hub-graphic-fighting" aria-hidden="true"><FightingGamePreview kind="shooter" /></div>
              <div className="hub-card-copy">
                <h3>FPS · Ironlight Facility</h3>
                <p>A playable first-person range with mouse look, strafing, a modular carbine, shooting, reload, sprint, crouch, jump, and six targets. Edit the floor, walls, cover, textures, lighting, weapon, and HUD.</p>
              </div>
              <span className="hub-card-link">CREATE FPS GAME <ArrowUpRight size={15} /></span>
            </a>

            <a className="hub-pathway-card hub-pathway-studio" href={`${studioPath}?starter=third-person-shooter`} data-testid="card-third-person-shooter">
              <div className="hub-card-top"><span>04 / THIRD-PERSON SHOOTER</span><span className="hub-card-index"><ScanLine size={16} /></span></div>
              <div className="hub-card-graphic hub-graphic-fighting" aria-hidden="true">
                <FightingGamePreview kind="third-person-shooter" />
              </div>
              <div className="hub-card-copy">
                <h3>Third-Person Shooter</h3>
                <p>A detailed editable human fighter, over-the-shoulder camera, cover, shooting, reload, sprint, crouch, and multiplayer-ready player controls.</p>
              </div>
              <span className="hub-card-link">CREATE THIRD-PERSON GAME <ArrowUpRight size={15} /></span>
            </a>

            <a className="hub-pathway-card hub-pathway-studio" href={`${studioPath}?starter=mmorpg`} data-testid="card-mmorpg">
              <div className="hub-card-top"><span>05 / MMORPG</span><span className="hub-card-index"><Globe2 size={16} /></span></div>
              <div className="hub-card-graphic hub-graphic-rts" aria-hidden="true">
                <FightingGamePreview kind="mmorpg" />
              </div>
              <div className="hub-card-copy">
                <h3>MMORPG · Sunstone Vale</h3>
                <p>Explore a detailed fantasy settlement, meet quest NPCs, fight, cast spells, gather, craft, and switch between first- and third-person views.</p>
              </div>
              <span className="hub-card-link">CREATE MMORPG <ArrowUpRight size={15} /></span>
            </a>

            <a className="hub-pathway-card hub-pathway-workflow" href={`${studioPath}?starter=2d-rpg`} data-testid="card-pixel-rpg">
              <div className="hub-card-top"><span>06 / 2D RPG TEMPLATE</span><span className="hub-card-index"><Layers3 size={16} /></span></div>
              <FightingGamePreview kind="pixel-rpg" />
              <div className="hub-card-copy">
                <h3>2D RPG · Mosslight Trail</h3>
                <p>Original Game Boy Color–era pixel style: explore a town, talk to neighbors, battle and capture creatures, then complete your first quest. Edit the map, sprites and stats.</p>
              </div>
              <span className="hub-card-link">CREATE 2D RPG <ArrowUpRight size={15} /></span>
            </a>
          </div>
        </section>

        <section className="hub-bottom-note" aria-label="Project storage information">
          <div className="hub-bottom-mark"><Flame size={19} /></div>
          <div className="hub-bottom-copy">
            <span>YOUR SPACE, YOUR PACE</span>
            <p>Projects are saved in your browser. Open the Studio anytime to create a new project or continue one you’ve saved.</p>
          </div>
          <a href={studioPath} className="hub-bottom-link" data-testid="link-view-projects">Go to your projects <ChevronRight size={16} /></a>
        </section>

        <footer className="hub-footer">
          <a href={studioPath} className="hub-footer-brand"><img src={`${basePath}logo.svg`} alt="" /> MADHORSE ENGINE</a>
          <span>DESKTOP GAME CREATION WORKSPACE</span>
          <span className="hub-footer-version"><span /> READY WHEN YOU ARE</span>
        </footer>
      </div>
    </main>
  );
}
