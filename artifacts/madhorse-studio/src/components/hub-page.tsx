import { useUser } from '@clerk/react';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Compass,
  Flame,
  Layers3,
  Plus,
  ScanLine,
  Sparkles,
  Swords,
} from 'lucide-react';
import './hub-page.css';
import { createGameStarterKit } from '@/lib/scene-starter-kits';
import { createFightingPreviewCamera } from '@/lib/fighting-preview-camera';
import { createGameCamera } from '@/lib/game-camera';
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

function templatePreviewCamera(fps: boolean, aspect: number) {
  if (!fps) return createFightingPreviewCamera(aspect);
  const distance = Math.max(1, 1.6 / Math.max(.3, aspect));
  return {
    ...createGameCamera([]), rotation: undefined, placement: 'custom' as const, fov: 50,
    position: { x: 21 * distance, y: 20 * distance, z: -31 * distance },
    target: { x: 0, y: 1, z: 1 },
  };
}

function FightingGamePreview({ fps = false }: { fps?: boolean }) {
  // The card renders the same editable fighter geometry used by the Studio starter.
  const [starter] = useState(() => createGameStarterKit(fps ? 'shooter' : 'fighting', { x: -15, y: 50, z: 0 }));
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [camera, setCamera] = useState(() => templatePreviewCamera(fps, 16 / 9));
  const stageRef = useRef<HTMLDivElement>(null);
  const generatedAssets = starter.generatedAssets ?? [];

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      if (stage.clientWidth && stage.clientHeight) {
        setCamera(templatePreviewCamera(fps, stage.clientWidth / stage.clientHeight));
      }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    fit();
    return () => observer.disconnect();
  }, [fps]);

  useEffect(() => {
    const urls = Object.fromEntries(generatedAssets.map(({ asset, file }) =>
      [asset.id, URL.createObjectURL(file)]));
    setAssetUrls(urls);
    return () => Object.values(urls).forEach(URL.revokeObjectURL);
  }, [starter]);

  return (
    <div className="hub-fight-screen">
      <div className="hub-fight-toolbar">
        <span><i /> PLAY TEST</span>
        <span>{fps ? 'FPS FACILITY' : '3D FIGHTERS'} <b>/</b> {fps ? 'EDITABLE LEVEL' : 'SIDE VIEW'}</span>
        <span>TEMPLATE SCENE</span>
      </div>
      <div ref={stageRef} className="hub-fight-model-stage" data-testid={fps ? 'hub-fps-model-preview' : 'hub-fighting-model-preview'}>
        <ScenePreview3D
          projectName={fps ? 'Ironlight FPS Starter' : '2D/3D Fighting Starter'}
          gameView
          staticPreview
          gameCamera={camera}
          primaryCamera={camera}
          entities={starter.entities}
          assets={generatedAssets.map(({ asset }) => asset)}
          assetUrls={assetUrls}
          selectedEntityId={null}
          playerPreviewPosition={{ x: 0, y: 0 }}
          transformMode="translate"
          readOnly
          onSelectEntity={() => undefined}
          onTransformCommit={() => undefined}
          onTransformModeChange={() => undefined}
          graphicsFallback={
            <SceneRenderFallback
              gameView
              detail="thumbnail"
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
        {fps && <div className="hub-fight-hud" aria-hidden="true" style={{ justifyContent: 'space-between', fontSize: 8 }}>
          <span>HEALTH 100</span><b>FPS</b><span>12 / 96 · TARGETS 0/6</span>
        </div>}
        <div className="hub-fight-hud" aria-hidden="true" style={fps ? { display: 'none' } : undefined}>
          <span className="hub-fight-player-label">PLAYER</span>
          <span className="hub-fight-health hub-fight-health-player"><i /></span>
          <b>99</b>
          <span className="hub-fight-health hub-fight-health-rival"><i /></span>
          <span className="hub-fight-rival-label">RIVAL</span>
        </div>
        <span className="hub-fight-corner">3D MODEL TEMPLATE</span>
      </div>
    </div>
  );
}

function RtsGamePreview() {
  return (
    <div className="hub-rts-screen">
      <div className="hub-rts-toolbar">
        <span><i /> SUNSTONE VALE · RTS TEMPLATE</span>
        <span>EDITABLE SETTLEMENT</span>
        <span>BUILD IN STUDIO</span>
      </div>
      <div className="hub-rts-art">
        <img className="hub-rts-art-backdrop" src={`${basePath}references/default-rts-world.webp`} alt="" />
        <img className="hub-rts-art-image" src={`${basePath}references/default-rts-world.webp`} alt="" />
      </div>
      <svg className="hub-rts-svg" viewBox="0 0 720 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="rts-sky" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#253a4b" />
            <stop offset="1" stopColor="#768b73" />
          </linearGradient>
          <linearGradient id="rts-ground" x1="0" y1="0" x2="0.8" y2="1">
            <stop stopColor="#82915c" />
            <stop offset="1" stopColor="#394a3e" />
          </linearGradient>
          <linearGradient id="rts-river" x1="0" y1="0" x2="0.8" y2="1">
            <stop stopColor="#83c0c2" />
            <stop offset="1" stopColor="#387c91" />
          </linearGradient>
          <linearGradient id="rts-stone" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#d1c3a1" />
            <stop offset="1" stopColor="#655d53" />
          </linearGradient>
          <linearGradient id="rts-glass" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#e4ffff" stopOpacity=".82" />
            <stop offset=".5" stopColor="#65b7c2" stopOpacity=".64" />
            <stop offset="1" stopColor="#1e6274" stopOpacity=".9" />
          </linearGradient>
          <pattern id="rts-map-grid" width="36" height="24" patternUnits="userSpaceOnUse" patternTransform="skewY(-24)">
            <path d="M36 0H0V24" fill="none" stroke="#e9dfba" strokeOpacity=".12" strokeWidth="1" />
          </pattern>
          <filter id="rts-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect width="720" height="320" fill="url(#rts-sky)" />
        <path d="M0 132 75 77l62 39 72-76 88 87 63-55 72 54 79-72 86 78 62-43 61 49v84H0z" fill="#33464a" opacity=".82" />
        <path d="M0 169 91 105l84 54 93-81 100 91 72-58 97 61 71-79 112 88v139H0z" fill="#566950" opacity=".9" />
        <path d="m0 200 198-43 169 51 143-50 210 42v120H0z" fill="url(#rts-ground)" />
        <path d="M310 160c35 24 49 47 73 65 33 24 66 39 104 55l-16 40c-51-22-94-41-133-72-34-27-49-50-75-68z" fill="url(#rts-river)" opacity=".95" />
        <path d="M311 178c34 25 51 47 75 65 28 21 63 39 91 50" fill="none" stroke="#d5e7db" strokeOpacity=".44" strokeWidth="3" />
        <path d="m0 225 198-43 169 51 143-50 210 42v95H0z" fill="url(#rts-map-grid)" />
        <path d="M70 258 198 224l131 40 83-25M411 239l98-35 126 25" fill="none" stroke="#cfbb8e" strokeWidth="8" opacity=".54" />
        <path d="m70 253 128-34 131 39m82-24 83-30 126 23" fill="none" stroke="#ead9af" strokeWidth="2" opacity=".6" />
        <g transform="translate(111 189)">
          <path d="m0 20 37-13 35 14-37 15z" fill="#a65f48" />
          <path d="M0 20v34l35 16V36z" fill="#815243" />
          <path d="M35 36 72 21v34L35 70z" fill="#543b38" />
          <path d="m-7 18 44-16 42 17-43 17z" fill="url(#rts-stone)" />
          <path d="m12 13 25-9 24 10-26 9z" fill="#c3a46a" />
          <path d="M19 54v-15l11 4v16z" fill="#263238" />
          <path d="M50 30v-12l7-2v12" fill="#d0b46f" />
          <path d="M58 15V1" stroke="#d8c89c" strokeWidth="2" />
          <path d="m58 2 13 4-13 4z" fill="#bd5d46" />
        </g>
        <g transform="translate(532 199) scale(.83)">
          <path d="m0 20 37-13 35 14-37 15z" fill="#657a8f" />
          <path d="M0 20v34l35 16V36z" fill="#485766" />
          <path d="M35 36 72 21v34L35 70z" fill="#303a45" />
          <path d="m-7 18 44-16 42 17-43 17z" fill="url(#rts-stone)" />
          <path d="m12 13 25-9 24 10-26 9z" fill="#8896a0" />
          <path d="M19 54v-15l11 4v16z" fill="#1f292d" />
          <path d="M50 30v-12l7-2v12" fill="#e3d2a0" />
          <path d="M58 15V1" stroke="#d8c89c" strokeWidth="2" />
          <path d="m58 2 13 4-13 4z" fill="#6689ae" />
        </g>
        <g fill="#345b43" stroke="#9db577" strokeOpacity=".55">
          <path d="m53 213 8-33 10 34-9 7z" /><path d="m72 213 9-40 12 43-12 5z" />
          <path d="m635 191 9-35 11 38-10 4z" /><path d="m654 197 11-44 13 47-12 5z" />
          <path d="m271 221 7-30 9 32-8 4z" /><path d="m446 223 8-33 10 36-9 4z" />
        </g>
        <g opacity=".94">
          <g transform="translate(240 201)">
            <ellipse cx="0" cy="33" rx="34" ry="9" fill="#1b3438" opacity=".58" />
            <path d="M-31 32a31 31 0 0 1 62 0z" fill="url(#rts-glass)" stroke="#b8e8df" strokeWidth="2" />
            <path d="M-31 31h62M0 2v31M-18 8l11 24M18 8 7 32" fill="none" stroke="#d9eee2" strokeOpacity=".74" strokeWidth="2" />
            <path d="M-37 33h74" stroke="#d9c38b" strokeWidth="4" />
            <circle cx="0" cy="18" r="6" fill="#a5e9bd" filter="url(#rts-glow)" />
            <path d="M-20 24q20-8 40 0" fill="none" stroke="#cbefc3" strokeWidth="3" opacity=".68" />
          </g>
          <g transform="translate(477 207) scale(.82)">
            <ellipse cx="0" cy="33" rx="34" ry="9" fill="#1b3438" opacity=".58" />
            <path d="M-31 32a31 31 0 0 1 62 0z" fill="url(#rts-glass)" stroke="#b8e8df" strokeWidth="2" />
            <path d="M-31 31h62M0 2v31M-18 8l11 24M18 8 7 32" fill="none" stroke="#d9eee2" strokeOpacity=".74" strokeWidth="2" />
            <path d="M-37 33h74" stroke="#d9c38b" strokeWidth="4" />
            <circle cx="0" cy="18" r="6" fill="#87c9ee" filter="url(#rts-glow)" />
          </g>
        </g>
        <g fill="#739363" stroke="#d7d39a" strokeOpacity=".38">
          <path d="m18 235 10-31 12 34-11 4z" /><path d="m39 240 8-27 12 30-11 4z" />
          <path d="m584 227 10-33 13 37-12 4z" /><path d="m608 232 8-27 13 30-11 4z" />
          <path d="m186 240 7-24 10 26-9 3z" /><path d="m504 237 8-29 11 32-10 4z" />
        </g>
        <g filter="url(#rts-glow)" fill="#9debc0">
          <circle cx="242" cy="218" r="2.8" /><circle cx="478" cy="221" r="2.8" />
          <circle cx="373" cy="210" r="4.2" fill="#eed18b" />
        </g>
        <g transform="translate(356 205)" fill="#d6c79b" stroke="#f1e7ce" strokeWidth="1.2" opacity=".96">
          <path d="m0 0 3-13 4 13 4 3-4 3-1 10h-5l-1-10-4-3z" />
          <path d="m-13 8 2-9 4 9 4 3-4 2-1 7h-4l-1-7-3-2z" fill="#a85a48" />
          <path d="m16 10 2-9 4 9 4 3-4 2-1 7h-4l-1-7-3-2z" fill="#607d9c" />
        </g>
        <g opacity=".72" fill="none" stroke="#c7efec">
          <path d="M302 235q19-9 39 0t39 0t39 0" strokeWidth="2" />
          <path d="M314 245q17-7 33 0t35 0" strokeWidth="1.2" opacity=".7" />
        </g>
        <g filter="url(#rts-glow)">
          <circle cx="304" cy="214" r="8" fill="#efcf71" />
          <circle cx="335" cy="218" r="6" fill="#d77a56" />
          <circle cx="364" cy="233" r="6" fill="#d77a56" />
          <circle cx="434" cy="247" r="7" fill="#8ab4d4" />
        </g>
        <g fontFamily="monospace" fontSize="9" letterSpacing="1.4" fill="#efe7d3">
          <text x="18" y="24">SUNSTONE VALE / SCULPTED HIGHLANDS</text>
          <text x="18" y="300" fill="#d7cba9">TERRAIN · BIODOMES · SQUADS · VFX</text>
          <text x="568" y="300" fill="#d4b875">HIGH · SHADOWS · PLAY</text>
        </g>
      </svg>
    </div>
  );
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
            <p>Choose an RTS world, a fighting arena, or a first-person training facility, then make it your own in Studio.</p>
          </div>
          <div className="hub-pathway-grid">
            <a className="hub-pathway-card hub-pathway-studio" href={`${studioPath}?starter=2d-fighting`} data-testid="card-studio">
              <div className="hub-card-top"><span>01 / FIGHTING STARTER</span><span className="hub-card-index"><Swords size={16} /></span></div>
              <div className="hub-card-graphic hub-graphic-fighting" aria-hidden="true">
                <FightingGamePreview />
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
              <div className="hub-card-graphic hub-graphic-fighting" aria-hidden="true"><FightingGamePreview fps /></div>
              <div className="hub-card-copy">
                <h3>FPS · Ironlight Facility</h3>
                <p>A playable first-person range with mouse look, strafing, a modular carbine, shooting, reload, sprint, crouch, jump, and six targets. Edit the floor, walls, cover, textures, lighting, weapon, and HUD.</p>
              </div>
              <span className="hub-card-link">CREATE FPS GAME <ArrowUpRight size={15} /></span>
            </a>

            <a className="hub-pathway-card hub-pathway-workflow" href={studioPath} data-testid="card-workflow">
              <div className="hub-card-top"><span>04 / THE WORKFLOW</span><span className="hub-card-index"><Layers3 size={16} /></span></div>
              <div className="hub-card-graphic hub-graphic-workflow" aria-hidden="true">
                <span className="hub-workflow-step step-idea"><Sparkles size={15} /><b>IDEA</b></span>
                <span className="hub-workflow-connector connector-one" />
                <span className="hub-workflow-step step-scene"><Layers3 size={15} /><b>SCENE</b></span>
                <span className="hub-workflow-connector connector-two" />
                <span className="hub-workflow-step step-world"><Compass size={15} /><b>WORLD</b></span>
                <span className="hub-workflow-caption">A clear path from thought to play.</span>
              </div>
              <div className="hub-card-copy">
                <h3>Idea to playable</h3>
                <p>Move from a first concept into authored scenes and a playable experience, step by step.</p>
              </div>
              <span className="hub-card-link">START YOUR WORKFLOW <ArrowUpRight size={15} /></span>
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
