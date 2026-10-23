import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  primitiveShapes,
  uiElementKinds,
  type PrimitiveShape,
  type ProjectAsset,
  type TerrainSettings,
  type UIElementKind,
} from '@/lib/scene-model';

export type HierarchyMenuPoint = { x: number; y: number };
export type PlaneSettings = { size: number; width: number; depth: number };

type Props = {
  point: HierarchyMenuPoint;
  assets: ProjectAsset[];
  onClose: () => void;
  onCreateShape: (shape: PrimitiveShape) => void;
  onCreatePlane: (settings: PlaneSettings) => void;
  onCreateTerrain: (settings: TerrainSettings & { size: number }) => void;
  onImportAsset: () => void;
  onUploadTexture: () => void;
  onUseAsset: (asset: ProjectAsset) => void;
  onCreateCamera: () => void;
  onCreateLight: () => void;
  onCreateEffect: () => void;
  onCreateUI: (kind: UIElementKind) => void;
  onCreateScript: () => void;
  onCreateTexture: () => void;
  onOpenTimeline: () => void;
  onCreateEmpty: () => void;
};

const menuEntries = [
  ['plane', 'Create Plane'],
  ['terrain', 'Create Terrain'],
  ['import', 'Import Asset'],
  ['camera', 'Create Camera'],
  ['light', 'Create Light'],
  ['effect', 'Create Effect'],
  ['ui', 'Create UI'],
  ['script', 'Create Script'],
  ['texture', 'Create Texture'],
  ['upload-texture', 'Upload 2D Texture'],
  ['timeline', 'Timeline Your Animation'],
  ['empty', 'Create Empty Object'],
] as const;

export function HierarchyContextMenu(props: Props) {
  const [showShapes, setShowShapes] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const [showUIOptions, setShowUIOptions] = useState(false);
  const [dialog, setDialog] = useState<'plane' | 'terrain' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(props.point);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const bounds = menu.getBoundingClientRect();
    const left = Math.max(8, Math.min(props.point.x, window.innerWidth - bounds.width - 8));
    const top = Math.max(8, Math.min(props.point.y, window.innerHeight - bounds.height - 8));
    setPosition(current => current.x === left && current.y === top ? current : { x: left, y: top });
  }, [props.point, showShapes, showAssets, showUIOptions]);

  function run(action: () => void) {
    props.onClose();
    action();
  }

  return (
    <>
      <button
        type="button"
        className="fresh-context-scrim"
        aria-label="Close hierarchy menu"
        onClick={props.onClose}
      />
      <div
        ref={menuRef}
        className="fresh-context-menu"
        style={{ left: position.x, top: position.y }}
        role="menu"
        aria-label="Hierarchy actions"
        onContextMenu={event => event.preventDefault()}
        onKeyDown={event => {
          if (event.key === 'Escape') props.onClose();
        }}
      >
        <button
          type="button"
          role="menuitem"
          className="fresh-context-action"
          aria-expanded={showShapes}
          onClick={() => setShowShapes(value => !value)}
        >
          <span>Create Object</span><span aria-hidden="true">{showShapes ? '−' : '›'}</span>
        </button>
        {showShapes && (
          <div className="fresh-shape-picker" aria-label="Choose a 3D shape">
            {primitiveShapes.map(shape => (
              <button
                type="button"
                key={shape.value}
                onClick={() => {
                  if (shape.value === 'plane') setDialog('plane');
                  else run(() => props.onCreateShape(shape.value));
                }}
              >
                {shape.label}
              </button>
            ))}
          </div>
        )}
        {menuEntries.map(([key, label]) => key === 'ui' ? (
          <div
            className="fresh-context-group"
            key={key}
            onMouseEnter={() => setShowUIOptions(true)}
            onMouseLeave={() => setShowUIOptions(false)}
          >
            <button
              type="button"
              role="menuitem"
              className="fresh-context-action"
              aria-haspopup="menu"
              aria-expanded={showUIOptions}
              onFocus={() => setShowUIOptions(true)}
              onClick={() => setShowUIOptions(true)}
            >
              <span>{label}</span><span aria-hidden="true">{showUIOptions ? '⌄' : '›'}</span>
            </button>
            {showUIOptions && (
              <div className="fresh-ui-submenu" role="menu" aria-label="Choose a UI element">
                {uiElementKinds.map(kind => (
                  <button
                    type="button"
                    role="menuitem"
                    key={kind.value}
                    onClick={() => run(() => props.onCreateUI(kind.value))}
                  >
                    {kind.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            role="menuitem"
            className="fresh-context-action"
            key={key}
            onClick={() => {
              if (key === 'plane' || key === 'terrain') {
                setDialog(key);
                return;
              }
              if (key === 'import') return run(props.onImportAsset);
              if (key === 'upload-texture') return run(props.onUploadTexture);
              if (key === 'camera') return run(props.onCreateCamera);
              if (key === 'light') return run(props.onCreateLight);
               if (key === 'effect') return run(props.onCreateEffect);
              if (key === 'script') return run(props.onCreateScript);
              if (key === 'texture') return run(props.onCreateTexture);
              if (key === 'timeline') return run(props.onOpenTimeline);
              if (key === 'empty') return run(props.onCreateEmpty);
            }}
          >
            <span>{label}</span>
            {(key === 'plane' || key === 'terrain') && <span aria-hidden="true">›</span>}
          </button>
        ))}
        <button
          type="button"
          role="menuitem"
          className="fresh-context-action"
          aria-expanded={showAssets}
          onClick={() => setShowAssets(value => !value)}
        >
          <span>My Assets ({props.assets.length})</span><span aria-hidden="true">{showAssets ? '−' : '›'}</span>
        </button>
        {showAssets && (
          <div className="fresh-asset-picker" aria-label="Previously imported assets">
            {props.assets.length === 0
              ? <span className="fresh-context-empty">No saved assets on this device yet.</span>
              : props.assets.slice().sort((a, b) => b.addedAt.localeCompare(a.addedAt)).map(asset => (
                <button
                  type="button"
                  key={asset.id}
                  title={`${asset.name} · ${asset.kind}`}
                  onClick={() => run(() => props.onUseAsset(asset))}
                >
                  <span>{asset.name}</span><small>{asset.kind}</small>
                </button>
              ))}
          </div>
        )}
      </div>
      {dialog === 'plane' && (
        <PlaneDialog onCancel={() => { setDialog(null); props.onClose(); }} onCreate={settings => {
          setDialog(null); props.onClose(); props.onCreatePlane(settings);
        }} />
      )}
      {dialog === 'terrain' && (
        <TerrainDialog onCancel={() => { setDialog(null); props.onClose(); }} onCreate={settings => {
          setDialog(null); props.onClose(); props.onCreateTerrain(settings);
        }} />
      )}
    </>
  );
}

function PlaneDialog({ onCancel, onCreate }: {
  onCancel: () => void;
  onCreate: (settings: PlaneSettings) => void;
}) {
  const [size, setSize] = useState(1);
  const [width, setWidth] = useState(10);
  const [depth, setDepth] = useState(10);
  return (
    <SettingsDialog title="Create Plane" onCancel={onCancel} onSubmit={event => {
      event.preventDefault();
      onCreate({ size, width, depth });
    }}>
      <NumberSetting label="Size" value={size} min={0.1} max={100} step={0.1} onChange={setSize} />
      <NumberSetting label="Width" value={width} min={1} max={500} onChange={setWidth} />
      <NumberSetting label="Depth" value={depth} min={1} max={500} onChange={setDepth} />
    </SettingsDialog>
  );
}

function TerrainDialog({ onCancel, onCreate }: {
  onCancel: () => void;
  onCreate: (settings: TerrainSettings & { size: number }) => void;
}) {
  const [size, setSize] = useState(1);
  const [width, setWidth] = useState(40);
  const [depth, setDepth] = useState(40);
  const [height, setHeight] = useState(12);
  const [mountainHeight, setMountainHeight] = useState(24);
  const [riverDepth, setRiverDepth] = useState(5);
  const [riverCount, setRiverCount] = useState(1);
  return (
    <SettingsDialog title="Create Terrain" onCancel={onCancel} onSubmit={event => {
      event.preventDefault();
      onCreate({ size, width, depth, height, mountainHeight, riverDepth, riverCount });
    }}>
      <NumberSetting label="Size" value={size} min={0.1} max={100} step={0.1} onChange={setSize} />
      <NumberSetting label="Width" value={width} min={1} max={500} onChange={setWidth} />
      <NumberSetting label="Depth" value={depth} min={1} max={500} onChange={setDepth} />
      <NumberSetting label="Terrain height" value={height} min={0} max={100} onChange={setHeight} />
      <NumberSetting label="Mountain height" value={mountainHeight} min={0} max={100} onChange={setMountainHeight} />
      <NumberSetting label="River depth" value={riverDepth} min={0} max={50} onChange={setRiverDepth} />
      <NumberSetting label="Number of rivers" value={riverCount} min={0} max={10} onChange={setRiverCount} />
    </SettingsDialog>
  );
}

function NumberSetting({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void;
}) {
  return (
    <label className="fresh-setting">
      <span>{label}</span>
      <input type="number" min={min} max={max} step={step} value={value}
        onChange={event => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} />
    </label>
  );
}

function SettingsDialog({ title, children, onCancel, onSubmit }: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fresh-dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <form
        className="fresh-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fresh-dialog-title"
        onSubmit={onSubmit}
        onKeyDown={event => {
          if (event.key === 'Escape') onCancel();
        }}
      >
        <h3 id="fresh-dialog-title">{title}</h3>
        {children}
        <div className="fresh-dialog-actions">
          <button type="button" className="is-quiet" onClick={onCancel}>Cancel</button>
          <button type="submit">Create</button>
        </div>
      </form>
    </div>
  );
}
