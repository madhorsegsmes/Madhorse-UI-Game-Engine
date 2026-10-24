import { useUser } from '@clerk/react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Compass,
  Eye,
  Flame,
  Layers3,
  Plus,
  ScanLine,
  Sparkles,
  Swords,
} from 'lucide-react';
import './hub-page.css';

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

function FightingGamePreview() {
  return (
    <div className="hub-fight-screen">
      <div className="hub-fight-toolbar">
        <span><i /> PLAY TEST</span>
        <span>2D ARENA <b>/</b> SCENE 01</span>
        <span>RUNNING</span>
      </div>
      <svg className="hub-fight-svg" viewBox="0 0 720 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="fight-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#141a26" />
            <stop offset="0.68" stopColor="#27222a" />
            <stop offset="1" stopColor="#171719" />
          </linearGradient>
          <linearGradient id="fight-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#45414a" />
            <stop offset="1" stopColor="#1b1a1e" />
          </linearGradient>
          <linearGradient id="fight-red" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#ed7259" />
            <stop offset="1" stopColor="#842b35" />
          </linearGradient>
          <linearGradient id="fight-blue" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#83b8d7" />
            <stop offset="1" stopColor="#31538a" />
          </linearGradient>
          <radialGradient id="fight-glow">
            <stop stopColor="#d74e43" stopOpacity=".58" />
            <stop offset="1" stopColor="#d74e43" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="720" height="320" fill="url(#fight-bg)" />
        <ellipse cx="355" cy="142" rx="275" ry="128" fill="url(#fight-glow)" opacity=".58" />
        <path d="M0 102h720M0 118h720" stroke="#c14f48" strokeOpacity=".22" />
        <path d="M0 104h60V51h35v53h44V69h38v35h46V44h45v60h43V58h32v46h48V65h42v39h47V45h42v59h43V68h47v36h40" fill="#17191f" stroke="#6b4140" strokeOpacity=".45" />
        <path d="M0 216h720v104H0z" fill="url(#fight-floor)" />
        <path d="M0 217h720M80 320l100-103m70 103 44-103m180 103-40-103m135 103-95-103" stroke="#d87962" strokeOpacity=".25" />
        <path d="M0 260h720M0 294h720" stroke="#bbb2aa" strokeOpacity=".1" />
        <path d="M49 197h622" stroke="#d35c50" strokeWidth="4" opacity=".8" />

        <g transform="translate(28 15)">
          <text x="0" y="13" fill="#e8e1dc" fontSize="11" fontWeight="700" letterSpacing="1.7">PLAYER 1</text>
          <text x="0" y="28" fill="#bcaeaa" fontSize="8" letterSpacing="1.1">MADHORSE FIGHTER</text>
          <path d="M0 37h250l-12 20H0z" fill="#101216" stroke="#6f5555" />
          <path d="M4 41h226l-9 12H4z" fill="url(#fight-red)" />
        </g>
        <g transform="translate(442 15)">
          <text x="250" y="13" textAnchor="end" fill="#e8e1dc" fontSize="11" fontWeight="700" letterSpacing="1.7">RIVAL</text>
          <text x="250" y="28" textAnchor="end" fill="#bcaeaa" fontSize="8" letterSpacing="1.1">TRAINING OPPONENT</text>
          <path d="M0 37h250v20H12z" fill="#101216" stroke="#6f5555" />
          <path d="M20 41h226v12H20z" fill="url(#fight-blue)" />
        </g>
        <g>
          <rect x="327" y="20" width="66" height="49" rx="4" fill="#171719" stroke="#70413d" />
          <text x="360" y="40" textAnchor="middle" fill="#f0eae6" fontSize="23" fontWeight="800">99</text>
          <text x="360" y="55" textAnchor="middle" fill="#c57a68" fontSize="7" letterSpacing="1.6">ROUND 01</text>
        </g>

        <g transform="translate(250 211)">
          <ellipse cx="0" cy="0" rx="35" ry="7" fill="#08090c" opacity=".55" />
          <path d="M-18-61l-14 36 8 22 16-2 6-34 8 34 16 2 8-22-14-36z" fill="#37333a" stroke="#111216" strokeWidth="3" />
          <path d="M-22-94q0-13 19-18 22 4 24 19l-3 35-38 1z" fill="url(#fight-red)" stroke="#191519" strokeWidth="3" />
          <path d="M-20-97q4-20 21-19 20 3 22 23l-8 1-6-10-25 8z" fill="#d7a17e" stroke="#21191a" strokeWidth="3" />
          <path d="M-25-84l-23 14 5 20 14 5 12-24M19-84l22 10 12 18-8 11-19-13-13-15" fill="url(#fight-red)" stroke="#20191a" strokeWidth="4" strokeLinejoin="round" />
          <path d="M-36-58l-13 8-2 14 18 2 9-12M38-57l12 6 4 14-17 4-10-11" fill="#e4b46f" stroke="#2a2021" strokeWidth="3" />
          <path d="M-15-19l12 2-5 29-16 3-5-5 7-10zM10-18l13-3 11 20 14 13-5 6-24-7-8-16z" fill="#aa3739" stroke="#1a1719" strokeWidth="3" strokeLinejoin="round" />
          <path d="M-27 13l17-3 4 9-22 5-8-4zM34 11l17 10-4 7-24-7-2-7z" fill="#d8d4d1" stroke="#19191d" strokeWidth="3" />
          <path d="M-15-83h11M10-82h10" stroke="#251c1d" strokeWidth="3" strokeLinecap="round" />
        </g>
        <g transform="translate(470 211) scale(-1 1)">
          <ellipse cx="0" cy="0" rx="35" ry="7" fill="#08090c" opacity=".55" />
          <path d="M-18-61l-14 36 8 22 16-2 6-34 8 34 16 2 8-22-14-36z" fill="#302f3a" stroke="#111216" strokeWidth="3" />
          <path d="M-22-94q0-13 19-18 22 4 24 19l-3 35-38 1z" fill="url(#fight-blue)" stroke="#191519" strokeWidth="3" />
          <path d="M-20-97q4-20 21-19 20 3 22 23l-8 1-6-10-25 8z" fill="#b87960" stroke="#21191a" strokeWidth="3" />
          <path d="M-25-84l-23 14 5 20 14 5 12-24M19-84l22 10 12 18-8 11-19-13-13-15" fill="url(#fight-blue)" stroke="#20191a" strokeWidth="4" strokeLinejoin="round" />
          <path d="M-36-58l-13 8-2 14 18 2 9-12M38-57l12 6 4 14-17 4-10-11" fill="#f0cd70" stroke="#2a2021" strokeWidth="3" />
          <path d="M-15-19l12 2-5 29-16 3-5-5 7-10zM10-18l13-3 11 20 14 13-5 6-24-7-8-16z" fill="#315998" stroke="#1a1719" strokeWidth="3" strokeLinejoin="round" />
          <path d="M-27 13l17-3 4 9-22 5-8-4zM34 11l17 10-4 7-24-7-2-7z" fill="#d8d4d1" stroke="#19191d" strokeWidth="3" />
          <path d="M-15-83h11M10-82h10" stroke="#251c1d" strokeWidth="3" strokeLinecap="round" />
        </g>
        <path d="M311 145l26-16 25 1" fill="none" stroke="#f3c777" strokeWidth="3" strokeLinecap="round" opacity=".9" />
        <circle cx="337" cy="130" r="3" fill="#fff3d7" />
        <text x="28" y="305" fill="#c6b9b3" fontSize="8" letterSpacing="1.3">A / D MOVE</text>
        <text x="125" y="305" fill="#c6b9b3" fontSize="8" letterSpacing="1.3">F LIGHT</text>
        <text x="212" y="305" fill="#c6b9b3" fontSize="8" letterSpacing="1.3">CTRL BLOCK</text>
        <text x="328" y="305" fill="#e5c889" fontSize="8" letterSpacing="1.3">J HEAVY · K SPECIAL</text>
      </svg>
      <span className="hub-fight-corner">2D SIDE VIEW</span>
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
            <p>Build a classic 1v1 fighter with editable characters, moves, rounds, and a stage you can shape in Studio.</p>
          </div>
          <div className="hub-pathway-grid">
            <a className="hub-pathway-card hub-pathway-studio" href={`${studioPath}?starter=2d-fighting`} data-testid="card-studio">
              <div className="hub-card-top"><span>01 / FIGHTING STARTER</span><span className="hub-card-index"><Swords size={16} /></span></div>
              <div className="hub-card-graphic hub-graphic-fighting" aria-hidden="true">
                <FightingGamePreview />
              </div>
              <div className="hub-card-copy">
                <h3>2D Fighting Game</h3>
                <p>Name a new Studio project with a side-view arena, two editable fighters, combat actions, and a Play Test HUD.</p>
              </div>
              <span className="hub-card-link">CREATE FIGHTING PROJECT <ArrowUpRight size={15} /></span>
            </a>

            <a className="hub-pathway-card hub-pathway-vision" href={visionPath} data-testid="card-vision-board">
              <div className="hub-card-top"><span>02 / VISION BOARD</span><span className="hub-card-index"><Eye size={16} /></span></div>
              <div className="hub-card-graphic hub-graphic-vision" aria-hidden="true">
                <div className="hub-board-pin pin-a"><i /></div>
                <div className="hub-board-pin pin-b"><i /></div>
                <div className="hub-board-pin pin-c"><i /></div>
                <div className="hub-board-note"><span>IDEA / 01</span><b>Begin with<br />a feeling.</b><i /></div>
                <div className="hub-board-swatch" />
                <div className="hub-board-line" />
              </div>
              <div className="hub-card-copy">
                <h3>Gather a vision</h3>
                <p>Arrange visual references and capture the look and mood of the world you want to make.</p>
              </div>
              <span className="hub-card-link">OPEN VISION BOARD <ArrowUpRight size={15} /></span>
            </a>

            <a className="hub-pathway-card hub-pathway-workflow" href={studioPath} data-testid="card-workflow">
              <div className="hub-card-top"><span>03 / THE WORKFLOW</span><span className="hub-card-index"><Layers3 size={16} /></span></div>
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
