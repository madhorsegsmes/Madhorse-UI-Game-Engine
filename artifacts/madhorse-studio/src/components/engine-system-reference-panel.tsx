import { useEffect, useState } from 'react';
import { getMadBuilderSystemReference } from '@workspace/api-client-react';

type EngineReference = Awaited<ReturnType<typeof getMadBuilderSystemReference>>;

export function EngineSystemReferencePanel() {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState<EngineReference | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || reference) return;
    let active = true;
    getMadBuilderSystemReference()
      .then(value => { if (active) setReference(value); })
      .catch(() => { if (active) setError('Protected system data could not be loaded. Reopen this section to retry.'); });
    return () => { active = false; };
  }, [open, reference]);

  return (
    <details className="fresh-game-type-library fresh-controller-reference engine-system-reference"
      data-testid="details-protected-engine-reference"
      onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="fresh-game-type-library-summary" data-testid="button-toggle-protected-engine-reference">
        <span>Protected Engine Reference · Read-only</span>
        <span className="engine-reference-lock" aria-hidden="true">LOCKED</span>
      </summary>
      <p className="fresh-game-type-library-note">
        System-owned guidance for Mad Builder and Ego. It is fetched read-only and is never saved with or changed by project data.
      </p>
      {error && <p role="alert" className="fresh-inspector-error">{error}</p>}
      {!reference && !error && <p role="status" className="fresh-game-type-library-note">Loading protected engine reference…</p>}
      {reference && <>
        <p className="engine-reference-policy">{reference.policy}</p>
        <div className="engine-reference-renderer">
          <strong>{reference.renderer.name} · {reference.renderer.target}</strong>
          <span>Default: {reference.renderer.qualityDefault} quality</span>
          <span>{reference.renderer.deviceTarget}</span>
          <span>{reference.renderer.fallback}</span>
        </div>
        <ul className="engine-reference-systems" data-testid="protected-engine-system-list">
          {reference.systems.map(system => (
            <li key={system.id}>
              <strong>{system.name}</strong>
              <span>{system.summary}</span>
            </li>
          ))}
        </ul>
      </>}
    </details>
  );
}
