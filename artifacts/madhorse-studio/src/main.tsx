import { createRoot } from 'react-dom/client';

import StudioProjects from './components/studio-projects';
import HomePage from './components/home-page';
import VisionBoardPage from './components/vision-board-page';
import { ErrorBoundary } from '@/components/error-boundary';
import { installSystemDiagnostics } from '@/lib/system-diagnostics';

import './index.css';

const stopDiagnostics = installSystemDiagnostics();
if (import.meta.hot) import.meta.hot.dispose(stopDiagnostics);
const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
const artifactBase = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';
const isHomePage = currentPath === artifactBase || currentPath === '/';
const isVisionBoardPage = currentPath.endsWith('/vision-board');

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    {isHomePage ? <HomePage /> : isVisionBoardPage ? <VisionBoardPage /> : <StudioProjects />}
  </ErrorBoundary>,
);
