import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import type { BuilderStyle, MadBuilderProps } from './mad-builder-contract';
import type { BuilderReferenceImage } from '@workspace/api-client-react';
import { prepareBuilderReference } from '@/lib/builder-reference-image';
import './workspace-browser-menus.css';
import './mad-builder-menu.css';

const EXAMPLE = 'Build a small 3D house with four walls, a pitched roof, a front door, glass windows on each side, a ground plane around it and a warm point light inside.';
const CAR_REFERENCE_PROMPT = 'Use the uploaded car image as the source of truth. If it is a two-door muscle or sports coupe, use the dedicated vehicle tool (muscle-coupe) for a contoured body, wheel openings, shaped glass cabin and four detailed wheels, not a stack of boxes. Match its real-world proportions, paint, dark trim and visible paired racing stripes. Build one editable car only, without scenery or duplicate details. Explain which hidden details are estimated and any differences imposed by the coupe template. Do not force other vehicle styles into this template.';
const STYLE_STORAGE_KEY = 'madhorse-studio-mad-builder-style';
const DEFAULT_REFERENCE_STORAGE_KEY = 'madhorse-studio-mad-builder-default-reference';
const DEFAULT_REFERENCE_URL = `${import.meta.env.BASE_URL}references/default-style-coupe.webp`;
const BUILD_STYLES: { value: BuilderStyle; label: string }[] = [
  { value: 'polished-game-ready', label: 'Polished game-ready' },
  { value: 'realistic-game-ready', label: 'Realistic game asset' },
  { value: 'stylized-high-detail', label: 'Stylized high-detail' },
];

function readSavedStyle(): BuilderStyle {
  try {
    const saved = window.localStorage.getItem(STYLE_STORAGE_KEY);
    return BUILD_STYLES.find((style) => style.value === saved)?.value ?? 'polished-game-ready';
  } catch {
    return 'polished-game-ready';
  }
}

function readDefaultReferenceEnabled() {
  try { return window.localStorage.getItem(DEFAULT_REFERENCE_STORAGE_KEY) !== 'false'; }
  catch { return true; }
}

export function MadBuilderMenu(props: MadBuilderProps & { embedded?: boolean; onClose?: () => void }) {
  const { embedded = false } = props;
  const { history, plan, phase, error, readOnly, onPlan, onCancel, onDiscard, onApply } = props;
  const [prompt, setPrompt] = useState('');
  const [asPrefab, setAsPrefab] = useState(false);
  const [buildStyle, setBuildStyle] = useState<BuilderStyle>(readSavedStyle);
  const [defaultReferenceEnabled, setDefaultReferenceEnabled] = useState(readDefaultReferenceEnabled);
  const [defaultReferenceImage, setDefaultReferenceImage] = useState('');
  const [defaultReferenceError, setDefaultReferenceError] = useState('');
  const [preparingDefaultReference, setPreparingDefaultReference] = useState(false);
  const [referenceImage, setReferenceImage] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [referenceError, setReferenceError] = useState('');
  const [preparingImage, setPreparingImage] = useState(false);
  const len = prompt.trim().length;
  const hasReference = Boolean(referenceImage || (defaultReferenceEnabled && defaultReferenceImage));
  const valid = (len >= 3 || len === 0 && Boolean(referenceImage)) && prompt.length <= 2000 && hasReference;
  const busy = phase === 'planning' || phase === 'applying' || preparingImage || preparingDefaultReference;
  const canPlan = !readOnly && !busy && valid;
  const partCount = plan?.parts.length ?? 0;
  const canApply = !readOnly && phase === 'ready' && !!plan && partCount > 0;

  const close = (e: MouseEvent<HTMLButtonElement>) => { e.currentTarget.closest('details')?.removeAttribute('open'); };
  useEffect(() => {
    if (!defaultReferenceEnabled || defaultReferenceImage) return;
    const controller = new AbortController();
    setPreparingDefaultReference(true);
    setDefaultReferenceError('');
    void fetch(DEFAULT_REFERENCE_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('The shared default reference could not be loaded.');
        return response.blob();
      })
      .then((blob) => prepareBuilderReference(new File([blob], 'Orange coupe style reference.webp', {
        type: blob.type || 'image/webp',
      })))
      .then((image) => { if (!controller.signal.aborted) setDefaultReferenceImage(image); })
      .catch((failure) => {
        if (!controller.signal.aborted) setDefaultReferenceError(failure instanceof Error
          ? failure.message : 'The shared default reference could not be loaded.');
      })
      .finally(() => { if (!controller.signal.aborted) setPreparingDefaultReference(false); });
    return () => controller.abort();
  }, [defaultReferenceEnabled, defaultReferenceImage]);
  const requestReferences = (): BuilderReferenceImage[] => [
    ...(defaultReferenceEnabled && defaultReferenceImage
      ? [{ role: 'global-style' as const, dataUrl: defaultReferenceImage }] : []),
    ...(referenceImage ? [{ role: 'user-target' as const, dataUrl: referenceImage }] : []),
  ];
  const submit = () => {
    if (canPlan) void onPlan(prompt.trim() || 'Create the requested object using the default visual style reference.', asPrefab, buildStyle, requestReferences()).catch(() => undefined);
  };
  const uploadReference = async (file: File | undefined) => {
    if (!file) return;
    setPreparingImage(true); setReferenceError('');
    setReferenceImage(''); setReferenceName('');
    try {
      setReferenceImage(await prepareBuilderReference(file));
      setReferenceName(file.name);
    } catch (failure) {
      setReferenceError(failure instanceof Error ? failure.message : 'This image could not be read.');
    } finally { setPreparingImage(false); }
  };
  const updateBuildStyle = (value: string) => {
    const next = BUILD_STYLES.find((style) => style.value === value)?.value ?? 'polished-game-ready';
    setBuildStyle(next);
    try { window.localStorage.setItem(STYLE_STORAGE_KEY, next); } catch { /* Keep this choice for the current session. */ }
  };
  const updateDefaultReference = (enabled: boolean) => {
    setDefaultReferenceEnabled(enabled);
    try { window.localStorage.setItem(DEFAULT_REFERENCE_STORAGE_KEY, String(enabled)); } catch { /* Keep this choice for the current session. */ }
  };

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
            <details className="mb-settings-dropdown" data-testid="details-builder-settings">
              <summary data-testid="button-builder-settings"><span>Settings</span><span className="mb-settings-chevron" aria-hidden="true">⌄</span></summary>
              <div className="mb-settings-content">
                <label className="mb-check">
                  <input type="checkbox" checked={defaultReferenceEnabled} disabled={readOnly || busy}
                    onChange={(event) => updateDefaultReference(event.target.checked)} data-testid="checkbox-builder-default-reference" />
                  Use the shared coupe style reference on every request
                </label>
                <p className="mb-hint">This bundled image guides visual quality, not the subject or colors of unrelated builds. An uploaded target image is sent separately and takes priority for the requested object.</p>
                {preparingDefaultReference && <p className="mb-hint" role="status">Loading shared style reference…</p>}
                {defaultReferenceImage && <div className="mb-default-reference">
                  <img src={defaultReferenceImage} alt="Shared orange coupe style reference" data-testid="image-builder-default-reference" />
                  <span>Shared orange coupe reference · sent with every request while enabled</span>
                </div>}
                {defaultReferenceError && <p className="mb-error" role="alert" data-testid="text-builder-default-reference-error">{defaultReferenceError}</p>}
              </div>
            </details>
            <label className="mb-prompt-label" htmlFor="mad-builder-reference">Optional target image for this build</label>
            <input id="mad-builder-reference" type="file" accept="image/jpeg,image/png,image/webp"
              disabled={readOnly || busy} data-testid="input-builder-reference"
              onChange={(event) => { void uploadReference(event.target.files?.[0]); event.target.value = ''; }} />
            {preparingImage && <p className="mb-hint" role="status">Preparing reference image…</p>}
            {referenceImage && <div className="mb-reference-preview">
              <img src={referenceImage} alt={`Build reference: ${referenceName}`} data-testid="image-builder-reference" />
              <span>{referenceName}</span>
              <button type="button" disabled={busy} onClick={() => { setReferenceImage(''); setReferenceName(''); }}>Remove</button>
            </div>}
            {referenceError && <p className="mb-error" role="alert">{referenceError}</p>}
            <p className="mb-hint">An uploaded image guides the requested object's visible design. The shared style reference remains separate. Hidden sides are estimated; an exact 3D copy is not guaranteed.</p>
            <label className="mb-prompt-label" htmlFor="mad-builder-prompt">What should Mad Bot build?</label>
            <textarea
              id="mad-builder-prompt" className="mb-textarea" value={prompt} maxLength={2000} rows={4}
              disabled={readOnly || busy} autoFocus={embedded && Boolean(props.onClose)}
              placeholder="Describe what to build; an uploaded target image can be used without text."
              aria-invalid={prompt.length > 0 && !valid}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
              data-testid="input-builder-prompt"
            />
            <div className="mb-meta"><span>{len > 0 && len < 3 ? 'Min 3 characters, or leave blank' : !hasReference ? 'Enable the shared reference or upload a target image' : 'Tap Build in scene or press Ctrl+Enter'}</span><span data-testid="text-builder-char-count">{prompt.length}/2000</span></div>
            <label className="mb-style-row" htmlFor="mad-builder-style">
              <span>Build style</span>
              <select id="mad-builder-style" className="mb-style-select" value={buildStyle}
                disabled={readOnly || busy} onChange={(e) => updateBuildStyle(e.target.value)}
                data-testid="select-builder-style">
                {BUILD_STYLES.map((style) => <option key={style.value} value={style.value}>{style.label}</option>)}
              </select>
            </label>
            <p className="mb-hint mb-style-hint">Polished uses broad quality cues from your Meshy reference, not copied models or assets.</p>
            <label className="mb-check">
              <input type="checkbox" checked={asPrefab} disabled={readOnly || busy} onChange={(e) => setAsPrefab(e.target.checked)} data-testid="checkbox-builder-prefab" />
              Also save group as prefab
            </label>
            <div className="mb-row">
              <button type="button" className="mb-quiet" disabled={readOnly || busy} onClick={() => setPrompt(EXAMPLE)} data-testid="button-builder-example">Example: house</button>
              <button type="button" className="mb-quiet" disabled={readOnly || busy} onClick={() => setPrompt(CAR_REFERENCE_PROMPT)} data-testid="button-builder-car-reference-prompt">Example: car reference</button>
              {phase === 'planning' || phase === 'applying' ? (
                <button type="button" className="mb-danger mb-grow" onClick={onCancel} data-testid="button-builder-cancel">
                  {phase === 'planning' ? 'Cancel planning' : 'Cancel build'}
                </button>
              ) : (
                <button type="button" className="mb-grow" disabled={!canPlan} onClick={submit} data-testid="button-builder-plan">{error ? 'Retry build' : 'Build in scene'}</button>
              )}
            </div>
            {phase === 'planning' && <div className="mb-status" role="status" data-testid="status-builder-planning"><span className="mb-pulse" />Preparing your build...</div>}
            {phase === 'applying' && <div className="mb-status" role="status" data-testid="status-builder-applying"><span className="mb-pulse" />Building objects in Scene 1...</div>}
            {readOnly && <p className="mb-hint" data-testid="text-builder-readonly">This project is read-only. Planning and building are disabled.</p>}
            {error && <div className="mb-error" role="alert" data-testid="text-builder-error">{error}</div>}
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
                <div className="mb-row">
                  <button type="button" className="mb-grow" disabled={!canApply} onClick={() => onApply(asPrefab)} data-testid="button-builder-apply">Build saved plan in scene</button>
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
            <p className="mb-hint">Submitting a request automatically builds editable objects in Scene 1. Existing objects are kept; delete the generated group in the hierarchy to remove it. No code is run and no files or scripts are touched.</p>
          </details>
          <div className="mb-section">
            <p className="mb-fine" data-testid="text-builder-credits">Uses OpenAI via Replit AI Integrations. No API key needed; usage is billed to your Replit credits.</p>
            <p className="mb-fine" data-testid="text-builder-privacy">The shared style image, any optional target image, your request, selected object name and project asset names/types are sent to the existing OpenAI planner when you build. Images are transient input, not saved as project assets. The shared image is bundled with Studio; uploaded images must be selected again after closing this panel. Saved projects stay in this browser.</p>
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
