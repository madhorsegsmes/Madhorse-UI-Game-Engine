import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

function HorseMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-labelledby="horse-mark-title"
    >
      <title id="horse-mark-title">A fire horse encircling a flame</title>
      <circle cx="24" cy="24" r="11.5" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M24 17c1.8 3-.3 4.1 1.2 6.2 1.1 1.4 3.4 2 2.6 4.6-.6 2-2.7 3.1-4.8 2.4-2.5-.8-3.2-3.3-1.8-5.3.8-1.2 1.9-1.9 1.8-3.8-.1-1.4.3-2.7 1-4.1Z"
        fill="currentColor"
      />
      <path
        d="M12.4 20.2c1.4-7.2 7.8-12.4 15.5-12.4 8.8 0 15.9 7.1 15.9 15.9 0 7.2-4.8 13.3-11.4 15.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="m13.2 17.8 1.1-5.1 4.1 2.7 3.5-5.6 2.2 4.1 4.1-1.2 3.4 3.9 4.4 1.3 2.2 4.1-2.2 2.2-4.4.2-1.7 4.1-4.8 2.9-1.1 5.1-3.2-.4.8-6.2-4 3.4-2.7 4.2-3-.8 1.5-6.1-2.2-5.1 2-7.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Home() {
  return (
    <main className="workspace" aria-label="Madhorse game creation workspace">
      <div className="shell">
        <header className="topbar">
          <div className="brand" aria-label="Madhorse UI">
            <HorseMark />
            <span className="brand-name">MADHORSE<span>UI</span></span>
          </div>
          <div className="utility-mark" aria-hidden="true"><i /><i /><i /></div>
        </header>

        <section className="stage" aria-label="Empty game workspace">
          <div className="frame-lines" aria-hidden="true" />
          <span className="stage-corner tl" aria-hidden="true" />
          <span className="stage-corner tr" aria-hidden="true" />
          <span className="stage-corner bl" aria-hidden="true" />
          <span className="stage-corner br" aria-hidden="true" />
        </section>

        <div className="statusbar" role="group" aria-label="Workspace status and actions">
          <div className="status-segment" aria-hidden="true"><span className="status-diamond" /></div>
          <div className="status-center" aria-hidden="true"><span /><span /><span /></div>
          <div className="status-segment" aria-hidden="true"><span className="status-diamond" /></div>
        </div>

        <section className="panel-row" aria-label="Empty workspace panels">
          <div className="panel" aria-hidden="true" />
          <div className="panel" aria-hidden="true" />
          <div className="panel" aria-hidden="true" />
        </section>

        <div className="shell-footer" aria-hidden="true">
          <span className="footer-line" />
          <span className="footer-center"><i /><i /><i /></span>
          <span className="footer-line" />
        </div>
      </div>
    </main>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
