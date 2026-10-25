import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import type { BuilderBuildCategory, BuilderStyle, MadBuilderProps } from './mad-builder-contract';
import type { BuilderReferenceImage } from '@workspace/api-client-react';
import { prepareBuilderReference } from '@/lib/builder-reference-image';
import { getMadBuilderModules, type MadBuilderModuleCategory, type MadBuilderModuleId } from '@/lib/mad-builder-modules';
import './workspace-browser-menus.css';
import './mad-builder-menu.css';

const EXAMPLE = 'Build a small 3D house with four walls, a pitched roof, a front door, glass windows on each side, a ground plane around it and a warm point light inside.';
const CAR_REFERENCE_PROMPT = 'Use the uploaded car image as the source of truth. If it is a two-door muscle or sports coupe, use the dedicated vehicle tool (muscle-coupe) for a contoured body, wheel openings, shaped glass cabin and four detailed wheels, not a stack of boxes. Match its real-world proportions, paint, dark trim and visible paired racing stripes. Build one editable car only, without scenery or duplicate details. Explain which hidden details are estimated and any differences imposed by the coupe template. Do not force other vehicle styles into this template.';
const RTS_REFERENCE_PROMPT = 'Build an editable isometric RTS settlement inspired by the selected reference: a central fortified keep, connected winding paths, smaller homes and outposts, crop plots, forest clusters, visible resource sites, and clear routes for squads. Use warm earth and foliage colors, readable spacing, and grouped details.';
const STYLE_STORAGE_KEY = 'madhorse-studio-mad-builder-style';
const DEFAULT_REFERENCE_STORAGE_KEY = 'madhorse-studio-mad-builder-default-reference';
const BUILD_CATEGORY_STORAGE_KEY = 'madhorse-studio-mad-builder-build-category';
const DEFAULT_REFERENCE_URLS = {
  vehicle: `${import.meta.env.BASE_URL}references/default-style-coupe.webp`,
  house: `${import.meta.env.BASE_URL}references/default-style-house.webp`,
  'rts-world': `${import.meta.env.BASE_URL}references/default-rts-world.webp`,
};
const BUILD_CATEGORIES: { value: BuilderBuildCategory; label: string }[] = [
  { value: 'auto', label: 'Automatic — follow the prompt' },
  { value: 'vehicle', label: 'Vehicle — orange coupe reference' },
  { value: 'house', label: 'House — Victorian reference' },
  { value: 'rts-world', label: 'RTS world — isometric settlement reference' },
];
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

function readSavedBuildCategory(): BuilderBuildCategory {
  try {
    const saved = window.localStorage.getItem(BUILD_CATEGORY_STORAGE_KEY);
    return BUILD_CATEGORIES.find((category) => category.value === saved)?.value ?? 'vehicle';
  } catch {
    return 'vehicle';
  }
}

export function MadBuilderMenu(props: MadBuilderProps & {
  embedded?: boolean;
  onClose?: () => void;
  onAddModule?: (moduleId: MadBuilderModuleId) => void;
}) {
  const { embedded = false } = props;
  const { history, plan, phase, error, readOnly, onPlan, onCancel, onDiscard, onApply } = props;
  const [prompt, setPrompt] = useState('');
  const [asPrefab, setAsPrefab] = useState(false);
  const [buildStyle, setBuildStyle] = useState<BuilderStyle>(readSavedStyle);
  const [buildCategory, setBuildCategory] = useState<BuilderBuildCategory>(readSavedBuildCategory);
  const [moduleCategory, setModuleCategory] = useState<MadBuilderModuleCategory>(() =>
    buildCategory === 'house' ? 'house' : 'vehicle');
  const [moduleId, setModuleId] = useState<MadBuilderModuleId>(() =>
    getMadBuilderModules(buildCategory === 'house' ? 'house' : 'vehicle')[0].id);
  const [defaultReferenceEnabled, setDefaultReferenceEnabled] = useState(readDefaultReferenceEnabled);
  const [defaultReferenceImage, setDefaultReferenceImage] = useState('');
  const [defaultReferenceLoadedFor, setDefaultReferenceLoadedFor] = useState<BuilderBuildCategory | ''>('');
  const [defaultReferenceError, setDefaultReferenceError] = useState('');
  const [preparingDefaultReference, setPreparingDefaultReference] = useState(false);
  const [referenceImage, setReferenceImage] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [referenceError, setReferenceError] = useState('');
  const [preparingImage, setPreparingImage] = useState(false);
  const defaultReferenceReady = defaultReferenceEnabled && !!defaultReferenceImage &&
    defaultReferenceLoadedFor === buildCategory;
  const defaultReferenceName = buildCategory === 'house' ? 'Victorian house'
    : buildCategory === 'rts-world' ? 'isometric RTS settlement' : 'orange coupe';
  const defaultReferenceUrl = DEFAULT_REFERENCE_URLS[buildCategory === 'auto' ? 'vehicle' : buildCategory];
  const defaultReferenceRole = buildCategory === 'auto' ? 'global-style' as const : 'category-default' as const;
  const moduleOptions = getMadBuilderModules(moduleCategory);
  const selectedModule = moduleOptions.find((module) => module.id === moduleId) ?? moduleOptions[0];
  const len = prompt.trim().length;
  const hasReference = Boolean(referenceImage || defaultReferenceReady);
  const canBuildFromReferenceOnly = Boolean(referenceImage || (defaultReferenceReady && buildCategory !== 'auto'));
  const valid = (len >= 3 || len === 0 && canBuildFromReferenceOnly) && prompt.length <= 2000 && hasReference;
  const busy = phase === 'planning' || phase === 'applying' || preparingImage || preparingDefaultReference;
  const canPlan = !readOnly && !busy && valid;
  const partCount = plan?.parts.length ?? 0;
  const canApply = !readOnly && phase === 'ready' && !!plan && partCount > 0;

  const close = (e: MouseEvent<HTMLButtonElement>) => { e.currentTarget.closest('details')?.removeAttribute('open'); };
  useEffect(() => {
    if (!defaultReferenceEnabled) {
      setPreparingDefaultReference(false);
      return;
    }
    const controller = new AbortController();
    setPreparingDefaultReference(true);
    setDefaultReferenceError('');
    void fetch(defaultReferenceUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('The selected default reference could not be loaded.');
        return response.blob();
      })
      .then((blob) => prepareBuilderReference(new File([blob], `${defaultReferenceName} default reference.webp`, {
        type: blob.type || 'image/webp',
      })))
      .then((image) => {
        if (!controller.signal.aborted) {
          setDefaultReferenceImage(image);
          setDefaultReferenceLoadedFor(buildCategory);
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setDefaultReferenceError(failure instanceof Error
          ? failure.message : 'The selected default reference could not be loaded.');
      })
      .finally(() => { if (!controller.signal.aborted) setPreparingDefaultReference(false); });
    return () => controller.abort();
  }, [defaultReferenceEnabled, buildCategory, defaultReferenceName, defaultReferenceUrl]);
  const requestReferences = (): BuilderReferenceImage[] => [
    ...(defaultReferenceReady
      ? [{ role: defaultReferenceRole, dataUrl: defaultReferenceImage }] : []),
    ...(referenceImage ? [{ role: 'user-target' as const, dataUrl: referenceImage }] : []),
  ];
  const submit = () => {
    const fallbackPrompt = buildCategory === 'house'
      ? 'Build a Victorian-style house based on the selected House reference.'
      : buildCategory === 'vehicle'
        ? 'Build a vehicle based on the selected Vehicle reference.'
        : buildCategory === 'rts-world'
          ? 'Build an editable isometric RTS settlement from the selected world reference: terrain, roads, a central keep, smaller bases, resource sites, crop plots, forests, and a few unit groups.'
          : 'Build the object shown in the uploaded target reference.';
    if (canPlan) void onPlan(prompt.trim() || fallbackPrompt, asPrefab, buildStyle, buildCategory, requestReferences()).catch(() => undefined);
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
  const updateBuildCategory = (value: string) => {
    const next = BUILD_CATEGORIES.find((category) => category.value === value)?.value ?? 'vehicle';
    setBuildCategory(next);
    setDefaultReferenceImage('');
    setDefaultReferenceLoadedFor('');
    if (next === 'vehicle' || next === 'house') {
      setModuleCategory(next);
      setModuleId(getMadBuilderModules(next)[0].id);
    }
    try { window.localStorage.setItem(BUILD_CATEGORY_STORAGE_KEY, next); } catch { /* Keep this choice for the current session. */ }
  };
  const updateModuleCategory = (value: string) => {
    const next: MadBuilderModuleCategory = value === 'house' ? 'house' : 'vehicle';
    const nextModule = getMadBuilderModules(next)[0];
    setModuleCategory(next);
    setModuleId(nextModule.id);
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
                <label className="mb-style-row" htmlFor="mad-builder-category">
                  <span>Build category</span>
                  <select id="mad-builder-category" className="mb-style-select" value={buildCategory}
                    disabled={readOnly || busy} onChange={(event) => updateBuildCategory(event.target.value)}
                    data-testid="select-builder-category">
                    {BUILD_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                  </select>
                </label>
                <p className="mb-hint">Vehicle selects the coupe, House the Victorian home, and RTS world the isometric settlement. Automatic follows your prompt.</p>
                <label className="mb-check">
                  <input type="checkbox" checked={defaultReferenceEnabled} disabled={readOnly || busy}
                    onChange={(event) => updateDefaultReference(event.target.checked)} data-testid="checkbox-builder-default-reference" />
                  Use the selected default reference on every request
                </label>
                <p className="mb-hint">The selected reference guides that subject or world layout. Automatic uses the coupe for finish only. Your uploaded target takes priority.</p>
                {preparingDefaultReference && defaultReferenceEnabled && <p className="mb-hint" role="status">Loading selected reference…</p>}
                {defaultReferenceReady && <div className="mb-default-reference">
                  <img src={defaultReferenceImage} alt={`${defaultReferenceName} default reference`} data-testid="image-builder-default-reference" />
                  <span>{buildCategory === 'auto'
                    ? 'Orange coupe finish reference · subject follows your prompt'
                    : `${defaultReferenceName} · sent with each request`}</span>
                </div>}
                {defaultReferenceError && <p className="mb-error" role="alert" data-testid="text-builder-default-reference-error">{defaultReferenceError}</p>}
                <div className="mb-module-tools" data-testid="section-builder-modules">
                  <div className="mb-module-tools-title">MODULAR TOOLS</div>
                  <label className="mb-style-row" htmlFor="mad-builder-module-kit">
                    <span>Module kit</span>
                    <select id="mad-builder-module-kit" className="mb-style-select" value={moduleCategory}
                      disabled={readOnly || busy} onChange={(event) => updateModuleCategory(event.target.value)}
                      data-testid="select-builder-module-kit">
                      <option value="vehicle">Vehicle</option>
                      <option value="house">House</option>
                    </select>
                  </label>
                  <label className="mb-style-row" htmlFor="mad-builder-module">
                    <span>Reusable part</span>
                    <select id="mad-builder-module" className="mb-style-select" value={selectedModule?.id ?? ''}
                      disabled={readOnly || busy} onChange={(event) => setModuleId(event.target.value as MadBuilderModuleId)}
                      data-testid="select-builder-module">
                      {moduleOptions.map((module) => <option key={module.id} value={module.id}>{module.label}</option>)}
                    </select>
                  </label>
                  <p className="mb-hint">{selectedModule?.description} Parts remain individually editable. The first insert saves a reusable prefab; later inserts use that saved module.</p>
                  <button type="button" className="mb-module-add" disabled={readOnly || busy || !selectedModule || !props.onAddModule}
                    onClick={() => selectedModule && props.onAddModule?.(selectedModule.id)}
                    data-testid="button-builder-add-module">
                    Add module to scene and library
                  </button>
                </div>
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
            <p className="mb-hint">An uploaded target image guides its design or world layout and takes priority over the default reference. The builder creates editable geometry, not an exact 3D copy or complete RTS logic.</p>
            <label className="mb-prompt-label" htmlFor="mad-builder-prompt">What should Mad Bot build?</label>
            <textarea
              id="mad-builder-prompt" className="mb-textarea" value={prompt} maxLength={2000} rows={4}
              disabled={readOnly || busy} autoFocus={embedded && Boolean(props.onClose)}
              placeholder="Describe the world or object to build; a selected reference can guide the layout."
              aria-invalid={prompt.length > 0 && !valid}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
              data-testid="input-builder-prompt"
            />
            <div className="mb-meta"><span>{len > 0 && len < 3 ? 'Min 3 characters, or leave blank' : !hasReference ? 'Enable the selected reference or upload a target image' : len === 0 && buildCategory === 'auto' && !referenceImage ? 'Enter a request or upload a target image' : 'Tap Build in scene or press Ctrl+Enter'}</span><span data-testid="text-builder-char-count">{prompt.length}/2000</span></div>
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
              <button type="button" className="mb-quiet" disabled={readOnly || busy} onClick={() => {
                updateBuildCategory('rts-world');
                setPrompt(RTS_REFERENCE_PROMPT);
              }} data-testid="button-builder-rts-reference-prompt">Example: RTS world</button>
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
              <li>Editable vehicle and Victorian-house construction systems</li>
              <li>Reusable vehicle and house modules saved into project prefabs</li>
            </ul>
            <p className="mb-hint">Submitting a request automatically builds editable objects in Scene 1. Existing objects are kept; delete the generated group in the hierarchy to remove it. No code is run and no files or scripts are touched.</p>
          </details>
          <div className="mb-section">
            <p className="mb-fine" data-testid="text-builder-credits">Uses OpenAI via Replit AI Integrations. No API key needed; usage is billed to your Replit credits.</p>
            <p className="mb-fine" data-testid="text-builder-privacy">The selected bundled reference, any optional target image, your request, build category, selected object name and project asset names/types are sent to the existing OpenAI planner when you build. Images are transient input, not saved as project assets. The bundled references are included with Studio; uploaded images must be selected again after closing this panel. Saved projects stay in this browser.</p>
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
