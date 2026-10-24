import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, Show, SignIn, SignUp } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import type { ReactNode } from 'react';

import HomePage from './components/home-page';
import { ErrorBoundary } from '@/components/error-boundary';
import { installSystemDiagnostics } from '@/lib/system-diagnostics';

import './index.css';
import './components/auth-pages.css';

const StudioProjects = lazy(() => import('./components/studio-projects'));
const VisionBoardPage = lazy(() => import('./components/vision-board-page'));
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const editorPath = `${basePath}/editor/`;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY.');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: 'top' as const,
    socialButtonsVariant: 'blockButton' as const,
  },
  variables: {
    colorPrimary: '#f45127',
    colorForeground: '#f0efed',
    colorMutedForeground: '#aaa5a2',
    colorDanger: '#ff6247',
    colorBackground: '#111214',
    colorInput: '#18191b',
    colorInputForeground: '#f0efed',
    colorNeutral: '#64524c',
    fontFamily: 'Barlow Condensed, sans-serif',
    borderRadius: '3px',
  },
  elements: {
    rootBox: { width: '100%', display: 'flex', justifyContent: 'center' },
    cardBox: {
      width: '460px', maxWidth: '100%', overflow: 'hidden',
      border: '1px solid #463630', borderRadius: '3px',
      backgroundColor: '#111214', boxShadow: '0 24px 85px rgba(0,0,0,.58)',
    },
    card: { backgroundColor: 'transparent', border: '0', boxShadow: 'none' },
    footer: { backgroundColor: 'transparent', border: '0', boxShadow: 'none' },
    headerTitle: { color: '#f4f1ee', fontSize: '27px', fontWeight: '800', letterSpacing: '.01em' },
    headerSubtitle: { color: '#aaa5a2', fontSize: '14px' },
    formFieldLabel: { color: '#e4dfdb', fontWeight: '600' },
    formFieldInput: { minHeight: '43px', color: '#f6f3f0', backgroundColor: '#171719', border: '1px solid #443732', borderRadius: '2px' },
    formButtonPrimary: { minHeight: '42px', color: '#fff', background: 'linear-gradient(110deg,#dd482c,#f26534 60%,#f88943)', borderRadius: '2px', fontWeight: '800' },
    socialButtonsBlockButton: { minHeight: '42px', color: '#f0efed', backgroundColor: '#1a1a1d', border: '1px solid #443732', borderRadius: '2px' },
    socialButtonsBlockButtonText: { color: '#f0efed', fontWeight: '600' },
    dividerLine: { backgroundColor: '#403633' },
    dividerText: { color: '#98918d' },
    footerActionText: { color: '#aaa5a2' },
    footerActionLink: { color: '#ff9764', fontWeight: '700' },
    identityPreviewEditButton: { color: '#ff9764' },
    alertText: { color: '#ffd4cb' },
    formFieldSuccessText: { color: '#a6e3bd' },
  },
};

function AuthFrame({ children, eyebrow, title, description }: {
  children: ReactNode; eyebrow: string; title: string; description: string;
}) {
  return (
    <div className="madhorse-auth">
      <aside className="madhorse-auth-brand">
        <a className="madhorse-auth-logo" href={`${basePath}/`}>
          <img src={`${basePath}/logo.svg`} alt="" />
          <span>MADHORSE <small>ENGINE</small></span>
        </a>
        <div className="madhorse-auth-pitch">
          <div className="madhorse-auth-kicker"><span /> BUILD THE BLAZING-FAST FUTURE</div>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="madhorse-auth-callout"><span>01</span>{eyebrow}</div>
        </div>
        <span className="madhorse-auth-footer">MADHORSE UI ENGINE · YOUR IDEAS, YOUR WORLD</span>
      </aside>
      <main className="madhorse-auth-form">
        <a className="madhorse-auth-back" href={`${basePath}/`}>← Back to home</a>
        <div className="madhorse-auth-card">{children}</div>
        <span className="madhorse-auth-secure">SECURE ACCOUNT ACCESS</span>
      </main>
    </div>
  );
}

function PublicHomeRoute() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/editor/" /></Show>
      <Show when="signed-out"><HomePage /></Show>
    </>
  );
}

function ProtectedEditorRoute() {
  return (
    <>
      <Show when="signed-in">
        <Suspense fallback={<div className="madhorse-route-loading">Opening Madhorse Studio…</div>}>
          <StudioProjects />
        </Suspense>
      </Show>
      <Show when="signed-out"><Redirect to="/sign-in" /></Show>
    </>
  );
}

function ProtectedVisionBoardRoute() {
  return (
    <>
      <Show when="signed-in">
        <Suspense fallback={<div className="madhorse-route-loading">Opening Vision Board…</div>}>
          <VisionBoardPage />
        </Suspense>
      </Show>
      <Show when="signed-out"><Redirect to="/sign-in" /></Show>
    </>
  );
}

function LegacyVisionBoardRoute() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/editor/vision-board/" /></Show>
      <Show when="signed-out"><Redirect to="/sign-in" /></Show>
    </>
  );
}

function SignInRoute() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/editor/" /></Show>
      <Show when="signed-out">
        <AuthFrame eyebrow="PICK UP WHERE YOU LEFT OFF" title="Welcome back." description="Sign in to return to your projects, scenes, and saved ideas.">
          <SignIn
            routing="path"
            path={`${basePath}/sign-in`}
            signUpUrl={`${basePath}/sign-up`}
            forceRedirectUrl={editorPath}
            fallbackRedirectUrl={editorPath}
            signUpForceRedirectUrl={editorPath}
            signUpFallbackRedirectUrl={editorPath}
          />
        </AuthFrame>
      </Show>
    </>
  );
}

function SignUpRoute() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/editor/" /></Show>
      <Show when="signed-out">
        <AuthFrame eyebrow="YOUR NEXT WORLD STARTS HERE" title="Make room for your ideas." description="Create a Madhorse account to start building and keep your projects in reach.">
          <SignUp
            routing="path"
            path={`${basePath}/sign-up`}
            signInUrl={`${basePath}/sign-in`}
            forceRedirectUrl={editorPath}
            fallbackRedirectUrl={editorPath}
          />
        </AuthFrame>
      </Show>
    </>
  );
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your Madhorse projects' } },
        signUp: { start: { title: 'Create your account', subtitle: 'Start building with Madhorse' } },
      }}
      routerPush={to => setLocation(stripBase(to))}
      routerReplace={to => setLocation(stripBase(to), { replace: true })}
    >
      <Switch>
        <Route path="/" component={PublicHomeRoute} />
        <Route path="/sign-in/*?" component={SignInRoute} />
        <Route path="/sign-up/*?" component={SignUpRoute} />
        <Route path="/editor/vision-board/*?" component={ProtectedVisionBoardRoute} />
        <Route path="/editor/*?" component={ProtectedEditorRoute} />
        <Route path="/vision-board/*?" component={LegacyVisionBoardRoute} />
        <Route><Redirect to="/" /></Route>
      </Switch>
    </ClerkProvider>
  );
}

const stopDiagnostics = installSystemDiagnostics();
if (import.meta.hot) import.meta.hot.dispose(stopDiagnostics);

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <WouterRouter base={basePath}>
      <ClerkRoutes />
    </WouterRouter>
  </ErrorBoundary>,
);
