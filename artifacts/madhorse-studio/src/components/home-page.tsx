import { ArrowRight, ArrowUpRight, Flame, Gamepad2, Layers3, Sparkles, UserRound, Zap } from 'lucide-react';
import './home-page.css';

const basePath = import.meta.env.BASE_URL;
const editorPath = `${basePath}editor/`;
const signInPath = `${basePath}sign-in`;
const signUpPath = `${basePath}sign-up`;
const heroReference = new URL('../../../../attached_assets/0_207_1792882288217.jpg', import.meta.url).href;

const features = [
  {
    number: '01',
    icon: Layers3,
    title: 'Build your world',
    body: 'Shape scenes with terrain, objects, lighting, cameras, and the pieces of your game.',
  },
  {
    number: '02',
    icon: Gamepad2,
    title: 'Make it playable',
    body: 'Bring characters, controls, and game systems together in one workspace.',
  },
  {
    number: '03',
    icon: Sparkles,
    title: 'Build with Mad Builder',
    body: 'Start with a plain-language idea, then edit what the builder creates.',
  },
];

export default function HomePage() {
  return (
    <main className="madhorse-home">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-photo" aria-hidden="true">
          <svg className="home-hero-photo-desktop" viewBox="300 125 724 387" preserveAspectRatio="xMidYMid slice">
            <image href={heroReference} x="0" y="0" width="1024" height="512" preserveAspectRatio="none" />
          </svg>
          <svg className="home-hero-photo-mobile" viewBox="310 125 520 387" preserveAspectRatio="xMinYMid slice">
            <image href={heroReference} x="0" y="0" width="1024" height="512" preserveAspectRatio="none" />
          </svg>
        </div>
        <div className="home-hero-art" aria-hidden="true" />
        <header className="home-header">
          <a className="home-brand" href={basePath} aria-label="Madhorse Engine home">
            <span className="home-brand-mark"><Flame size={23} strokeWidth={2.4} /></span>
            <span className="home-brand-name">MADHORSE<span>ENGINE</span></span>
          </a>
          <nav className="home-nav-links" aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#documentation">How it works</a>
          </nav>
          <div className="home-account-actions">
            <a className="home-nav-login" href={signInPath}>Log in</a>
            <a className="home-nav-cta" href={signUpPath}>Sign up <ArrowUpRight size={15} /></a>
          </div>
        </header>

        <div className="home-hero-inner">
          <div className="home-hero-copy">
            <div className="home-kicker"><span /> THE GAME-CREATION WORKSPACE</div>
            <h1 id="home-title">MADHORSE<br /><span>UI ENGINE</span></h1>
            <p className="home-tagline">Build the blazing-fast future.</p>
            <p className="home-description">
              Bring your ideas to life in a game-building workspace made for bold worlds, detailed scenes, and playable experiences.
            </p>
            <div className="home-hero-actions">
              <a className="home-button home-button-primary" href={signUpPath}>Create account <ArrowRight size={17} /></a>
              <a className="home-button home-button-quiet" href={signInPath}><UserRound size={16} /> Log in</a>
            </div>
            <div className="home-proof">
              <span><Zap size={14} /> One connected workspace</span>
              <span className="home-proof-divider" />
              <span>2D &amp; 3D projects</span>
            </div>
          </div>
          <div className="home-image-caption"><span className="home-caption-dot" /> YOUR NEXT WORLD STARTS HERE</div>
          <a className="home-scroll-cue" href="#features" aria-label="Scroll to features"><span /> SCROLL TO EXPLORE</a>
        </div>
      </section>

      <section id="features" className="home-features">
        <div className="home-section-heading">
          <span className="home-section-eyebrow">ALL THE TOOLS, ONE PLACE</span>
          <h2>From first idea to <span>playable world.</span></h2>
          <p>A clear place to build, edit, and shape what you imagine.</p>
        </div>
        <div className="home-feature-grid">
          {features.map(({ number, icon: Icon, title, body }) => (
            <article className="home-feature-card" key={number}>
              <div className="home-feature-top"><span>{number}</span><Icon size={19} strokeWidth={1.8} /></div>
              <h3>{title}</h3>
              <p>{body}</p>
              <a href={editorPath}>Explore in Studio <ArrowUpRight size={14} /></a>
            </article>
          ))}
        </div>
      </section>

      <section id="documentation" className="home-how">
        <div className="home-how-mark"><Flame size={21} /></div>
        <div className="home-how-copy">
          <span className="home-section-eyebrow">A SIMPLE PLACE TO START</span>
          <h2>Bring an idea.<br /><span>Build it step by step.</span></h2>
          <p>Open the Studio to explore your scene, tools, and built-in guidance. You can shape every project as you go.</p>
        </div>
        <a className="home-button home-button-primary" href={signUpPath}>Create your account <ArrowRight size={17} /></a>
      </section>

      <footer className="home-footer">
        <a className="home-footer-brand" href={basePath}><Flame size={16} /> MADHORSE ENGINE</a>
        <span>Build the blazing-fast future.</span>
        <a href={editorPath}>Open Studio <ArrowUpRight size={13} /></a>
      </footer>
    </main>
  );
}
