import { createRoot } from 'react-dom/client';

import BlankWorkspace from './components/blank-workspace';
import { ErrorBoundary } from '@/components/error-boundary';
import { installSystemDiagnostics } from '@/lib/system-diagnostics';

import './index.css';

const stopDiagnostics = installSystemDiagnostics();
if (import.meta.hot) import.meta.hot.dispose(stopDiagnostics);

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <BlankWorkspace />
  </ErrorBoundary>,
);
