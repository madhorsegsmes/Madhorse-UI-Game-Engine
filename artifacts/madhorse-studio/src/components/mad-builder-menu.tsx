import { useState } from 'react';
import type { MouseEvent } from 'react';
import type { MadBuilderProps } from './mad-builder-contract';
import './workspace-browser-menus.css';
import './mad-builder-menu.css';

const EXAMPLE = 'Build a small 3D house with four walls, a pitched roof, a front door, glass windows on each side, a ground plane around it and a warm point light inside.';

export function MadBuilderMenu(props: MadBuilderProps & { embedded?: boolean; onClose?: () => void }) {
  const { embedded = false } = props;
  const { history, plan, phase, error, readOnly, onPlan, onCancel, onDiscard, onApply } = props;
  const [prompt, setPrompt] = useState('');
  const [asPrefab, setAsPrefab] = useState(false);
  const len = prompt.trim().length;
  const valid = len >= 3 && prompt.length <= 2000;
  const busy = phase === 'planning' || phase === 'applying';
  const canPlan = !readOnly && !busy && valid;
  const partCount = plan?.parts.length ?? 0;
  const canApply = !readOnly && phase === 'ready' && !!plan && partCount > 0;

  const close = (e: MouseEvent<HTMLButtonElement>) => { e.currentTarget.closest('details')?.removeAttribute('open'); };
  const submit = () => { if (canPlan) void onPlan(prompt.trim()).catch(() => undefined); };

  const panel = (
    <section className="workspace-browser-panel browser-builder-panel" aria-label="Mad Builder" data-testid="panel-mad-builder">
        <header className="browser-panel-heading">
          <div><span className="browser-eyebrow">AI SCENE ASSEMBLY</span><h2>Mad Builder</h2></div>
          <span className="browser-count" data-testid="status-builder-phase">{readOnly ? 'READ-ONLY' : phase.toUpperCase()}</span>
          {embedded && props.onClose ? (
            <button type="button" className="browser-panel-close" onClick={props.onClose} data-testid="button-close-mad-builder">Close</button>
          ) : !embedded ? (
            <button type="button" className="browser-panel-close" onClick={close} data-testid="button-close-mad-builder">Close</button>
          ) : null}
        </header>
        <div className="mb-body">
          <div className="mb-section">
            <div className="mb-title"><span className="mb-num">01</span>BUILD REQUEST<span className="mb-rule" /></div>
            <label className="mb-prompt-label" htmlFor="mad-builder-prompt">Tell Mad Bot what to build</label>
            <textarea
              id="mad-builder-prompt" className="mb-textarea" value={prompt} maxLength={2000} rows={4}
              disabled={readOnly || busy} autoFocus={embedded && Boolean(props.onClose)}
              placeholder="Example: Build a 3D house with windows, a red roof and a front door."
              aria-invalid={prompt.length > 0 && !valid}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
              data-testid="input-builder-prompt"
            />
            <div className="mb-meta"><span>{len > 0 && len < 3 ? 'Min 3 characters' : 'Ctrl+Enter to plan'}</span><span data-testid="text-builder-char-count">{prompt.length}/2000</span></div>
            <div className="mb-row">
              <button type="button" className="mb-quiet" disabled={readOnly || busy} onClick={() => setPrompt(EXAMPLE)} data-testid="button-builder-example">Example: house</button>
              {phase === 'planning' ? (
                <button type="button" className="mb-danger mb-grow" onClick={onCancel} data-testid="button-builder-cancel">Cancel planning</button>
              ) : (
                <button type="button" className="mb-grow" disabled={!canPlan} onClick={submit} data-testid="button-builder-plan">{error ? 'Retry plan' : 'Plan build'}</button>
              )}
            </div>
            {phase === 'planning' && <div className="mb-status" role="status" data-testid="status-builder-planning"><span className="mb-pulse" />Planning with AI...</div>}
            {phase === 'applying' && <div className="mb-status" role="status" data-testid="status-builder-applying"><span className="mb-pulse" />Adding objects to scene...</div>}
            {readOnly && <p className="mb-hint" data-testid="text-builder-readonly">This project is read-only. Planning and building are disabled.</p>}
            {error && <div className="mb-error" role="alert" data-testid="text-builder-error">{error} Adjust the request if needed and press Retry plan.</div>}
          </div>

          {plan && (
            <div className="mb-section">
              <div className="mb-title"><span className="mb-num">02</span>PLAN PREVIEW<span className="mb-rule" /></div>
              <div className="mb-plan" data-testid="card-builder-plan">
                <h3 data-testid="text-plan-title">{plan.title}</h3>
                <p data-testid="text-plan-summary">{plan.summary}</p>
                {plan.warnings.length > 0 && (
                  <ul className="mb-warn" data-testid="list-plan-warnings">
                    {plan.warnings.map((w, i) => <li key={i} data-testid={`text-plan-warning-${i}`}>{w}</li>)}
                  </ul>
                )}
                <span className="browser-count" data-testid="text-plan-part-count">{partCount} part{partCount === 1 ? '' : 's'}</span>
                {partCount === 0 ? (
                  <p className="mb-hint" data-testid="text-plan-no-parts">This plan contains no supported parts, so nothing can be built. Try rephrasing the request.</p>
                ) : (
                  <details className="mb-parts">
                    <summary data-testid="button-toggle-plan-parts">Show parts</summary>
                    <ul>
                      {plan.parts.map((p) => <li key={p.key} data-testid={`row-plan-part-${p.key}`}><span>{p.name}</span><code>{p.kind}{p.shape ? ` · ${p.shape}` : ''}</code></li>)}
                    </ul>
                  </details>
                )}
                <label className="mb-check">
                  <input type="checkbox" checked={asPrefab} disabled={!canApply} onChange={(e) => setAsPrefab(e.target.checked)} data-testid="checkbox-builder-prefab" />
                  Also save group as prefab
                </label>
                <div className="mb-row">
                  <button type="button" className="mb-grow" disabled={!canApply} onClick={() => onApply(asPrefab)} data-testid="button-builder-apply">Build in scene</button>
                  <button type="button" className="mb-danger" disabled={busy} onClick={onDiscard} data-testid="button-builder-discard">Discard</button>
                </div>
              </div>
            </div>
          )}

          <div className="mb-section">
            <div className="mb-title"><span className="mb-num">03</span>HISTORY<span className="mb-rule" /></div>
            {history.length === 0 ? (
              <div className="mb-empty" data-testid="text-builder-history-empty">No requests yet. Type your first build request above.</div>
            ) : (
              <ol className="mb-history" data-testid="list-builder-history">
                {history.map((m) => (
                  <li key={m.id} className={`mb-msg is-${m.role}`} data-testid={`text-builder-message-${m.id}`}>
                    <span className="mb-role">{m.role === 'user' ? 'You' : 'Builder'}</span>{m.text}
                  </li>
                ))}
              </ol>
            )}
          </div>
          <details className="mb-section mb-help">
            <summary>What Mad Bot can build</summary>
            <ul className="mb-caps" data-testid="text-builder-capabilities">
              <li>Boxes, planes and terrain with colour, size and rotation</li>
              <li>Sprites plus models and textures already in this project</li>
              <li>Point, directional and ambient lights; cameras</li>
              <li>UI panels, text, buttons and health bars</li>
              <li>Grouped objects, optionally saved as a prefab</li>
            </ul>
            <p className="mb-hint">Builds are additive real scene objects you can edit afterwards. Existing objects are never overwritten. No code is run and no files or scripts are touched.</p>
          </details>
          <div className="mb-section">
            <p className="mb-fine" data-testid="text-builder-credits">Uses OpenAI via Replit AI Integrations. No API key needed; usage is billed to your Replit credits.</p>
            <p className="mb-fine" data-testid="text-builder-privacy">Your request, selected object name and project asset names/types are sent to the AI. The saved project itself stays local in this browser.</p>
          </div>
        </div>
      </section>
  );

  if (embedded) {
    return <div className="mb-embedded-root" data-testid="mad-builder-panel">{panel}</div>;
  }

  return (
    <details className="workspace-browser-menu" name="workspace-browser" data-testid="menu-mad-builder">
      <summary className="control-button" data-testid="button-open-mad-builder">Mad Builder</summary>
      {panel}
    </details>
  );
}
