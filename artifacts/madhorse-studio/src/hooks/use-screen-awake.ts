import { useEffect, useRef, useState } from 'react';

type WakeStatus = 'requesting' | 'active' | 'released' | 'blocked' | 'unsupported';

export function useScreenAwake() {
  const [status, setStatus] = useState<WakeStatus>('requesting');
  const retry = useRef<() => void>(() => {});

  useEffect(() => {
    let mounted = true;
    let pageActive = true;
    let pending = false;
    let lock: WakeLockSentinel | null = null;
    if (!navigator.wakeLock) {
      setStatus('unsupported');
      return;
    }
    const request = async () => {
      if (!mounted || !pageActive || pending || lock && !lock.released || document.visibilityState !== 'visible') return;
      pending = true;
      setStatus('requesting');
      try {
        const acquired = await navigator.wakeLock.request('screen');
        if (!mounted || !pageActive || document.visibilityState !== 'visible') {
          await acquired.release();
          return;
        }
        lock = acquired;
        setStatus('active');
        acquired.addEventListener('release', () => {
          if (lock === acquired) {
            lock = null;
            if (mounted) setStatus('released');
          }
        }, { once: true });
      } catch {
        if (mounted) setStatus('blocked');
      } finally {
        pending = false;
      }
    };
    const release = () => {
      const current = lock;
      lock = null;
      if (current && !current.released) void current.release().catch(() => {});
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') void request();
      else {
        release();
        if (mounted) setStatus('released');
      }
    };
    const interact = () => { if (!lock) void request(); };
    const pageHide = () => {
      pageActive = false;
      release();
      if (mounted) setStatus('released');
    };
    const pageShow = () => { pageActive = true; visibility(); };
    retry.current = () => { void request(); };
    void request();
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('pointerdown', interact);
    document.addEventListener('keydown', interact);
    window.addEventListener('pageshow', pageShow);
    window.addEventListener('pagehide', pageHide);
    return () => {
      mounted = false;
      retry.current = () => {};
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('pointerdown', interact);
      document.removeEventListener('keydown', interact);
      window.removeEventListener('pageshow', pageShow);
      window.removeEventListener('pagehide', pageHide);
      release();
    };
  }, []);

  return { status, retry: () => retry.current() };
}
