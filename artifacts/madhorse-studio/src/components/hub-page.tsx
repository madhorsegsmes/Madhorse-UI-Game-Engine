import { useUser } from '@clerk/react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Blocks,
  ChevronRight,
  Compass,
  Eye,
  Flame,
  Layers3,
  Plus,
  ScanLine,
  Sparkles,
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
              <div className="hub-kicker"><span className="hub-kicker-line" /> TWO WAYS INTO YOUR WORLD</div>
              <h2 id="hub-pathways-title">Choose your <span>next move.</span></h2>
            </div>
            <p>Build directly in the editor, or gather references before you begin.</p>
          </div>
          <div className="hub-pathway-grid">
            <a className="hub-pathway-card hub-pathway-studio" href={studioPath} data-testid="card-studio">
              <div className="hub-card-top"><span>01 / STUDIO</span><span className="hub-card-index"><Blocks size={16} /></span></div>
              <div className="hub-card-graphic hub-graphic-studio" aria-hidden="true">
                <div className="hub-mini-window"><span /><span /><span /></div>
                <div className="hub-mini-scene"><i /><i /><i /><b /></div>
                <div className="hub-mini-inspector"><span /><span /><span /><span /></div>
              </div>
              <div className="hub-card-copy">
                <h3>Build in Studio</h3>
                <p>Create a project, author scenes, and make your idea playable in one workspace.</p>
              </div>
              <span className="hub-card-link">OPEN THE STUDIO <ArrowUpRight size={15} /></span>
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
