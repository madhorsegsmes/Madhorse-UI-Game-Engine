import { useEffect, useState, useSyncExternalStore } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { beginSystemActivity, getSystemActivity, subscribeSystemActivity } from '@/lib/system-activity';
import { useScreenAwake } from '@/hooks/use-screen-awake';
import './system-status.css';

export function SystemStatus() {
  const activity = useSyncExternalStore(subscribeSystemActivity, getSystemActivity, getSystemActivity);
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const wake = useScreenAwake();
  const [refreshing, setRefreshing] = useState(true);
  const [visibleBusy, setVisibleBusy] = useState(true);

  useEffect(() => {
    let first = 0;
    let second = 0;
    const loaded = () => {
      first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setRefreshing(false));
      });
    };
    if (document.readyState === 'complete') loaded();
    else window.addEventListener('load', loaded, { once: true });
    let finishUpdate: (() => void) | undefined;
    const beforeUpdate = () => {
      finishUpdate?.();
      finishUpdate = beginSystemActivity('Refreshing system');
    };
    const afterUpdate = () => { finishUpdate?.(); finishUpdate = undefined; };
    import.meta.hot?.on('vite:beforeUpdate', beforeUpdate);
    import.meta.hot?.on('vite:afterUpdate', afterUpdate);
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      window.removeEventListener('load', loaded);
      import.meta.hot?.off('vite:beforeUpdate', beforeUpdate);
      import.meta.hot?.off('vite:afterUpdate', afterUpdate);
      finishUpdate?.();
    };
  }, []);

  const pending = activity.pending + fetching + mutating + Number(refreshing);
  const busy = pending > 0;
  useEffect(() => {
    setVisibleBusy(true);
    if (busy) return;
    // Make short disk operations perceptible without inventing a percentage.
    const timer = setTimeout(() => setVisibleBusy(false), 250);
    return () => clearTimeout(timer);
  }, [busy, activity.started]);

  const label = refreshing ? 'Refreshing system' : activity.pending ? activity.label
    : fetching || mutating ? 'Updating data' : visibleBusy ? 'Finishing' : 'Ready';
  const wakeLabel = wake.status === 'active' ? 'Screen awake'
    : wake.status === 'unsupported' ? 'Wake unavailable'
    : wake.status === 'requesting' ? 'Requesting wake' : 'Keep screen awake';

  return (
    <div className="system-status" data-testid="system-status" data-busy={visibleBusy} data-pending={pending}>
      <svg className="system-status-cog" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" data-testid="system-status-cog">
        <path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h6l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <div className="system-loading-bar" role="progressbar" aria-label="System data activity"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={visibleBusy ? undefined : 100}
        aria-valuetext={label} aria-busy={visibleBusy} data-testid="system-loading-bar">
        <span />
      </div>
      <span className="system-status-label" role="status" aria-live="polite" data-testid="system-activity-label">{label}</span>
      <button type="button" className="system-wake-status" data-testid="screen-wake-status" data-status={wake.status}
        onClick={wake.retry} disabled={wake.status === 'unsupported' || wake.status === 'active' || wake.status === 'requesting'}
        title={wake.status === 'unsupported' ? 'This browser does not support Screen Wake Lock. Device sleep settings still apply.'
          : 'Keep the screen awake while Madhorse is visible. Your browser or device may release this lock.'}>
        {wakeLabel}
      </button>
    </div>
  );
}
