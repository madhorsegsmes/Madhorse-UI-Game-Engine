import { usePhysicsDebugSettings } from '@/hooks/use-physics-debug-settings';
import { MAX_PHYSICS_DEBUG_BOXES, physicsDebugColors } from '@/lib/physics-debug-shapes';

export function PhysicsDebugOptions({ available = true }: { available?: boolean }) {
  const [settings, setSettings] = usePhysicsDebugSettings();
  return <fieldset style={{ display: 'grid', gap: 6, border: '1px solid #594365', padding: 8, margin: '10px 0' }}>
    <legend>Physics collision view</legend>
    <label><input type="checkbox" aria-label="Show physics boxes" checked={settings.enabled} disabled={!available}
      onChange={event => setSettings(current => ({ ...current, enabled: event.target.checked }))} /> Show physics boxes</label>
    <label><input type="checkbox" aria-label="Selected physics object only" checked={settings.selectedOnly} disabled={!settings.enabled || !available}
      onChange={event => setSettings(current => ({ ...current, selectedOnly: event.target.checked }))} /> Selected object only</label>
    <label><input type="checkbox" aria-label="See physics boxes through models" checked={settings.seeThrough} disabled={!settings.enabled || !available}
      onChange={event => setSettings(current => ({ ...current, seeThrough: event.target.checked }))} /> See through models</label>
    {!available && <p className="mh-scene3d__render-note">Available in the 3D Scene view. This template uses a separate 2D view.</p>}
    {settings.enabled && available && <>
      <p className="mh-scene3d__render-note">
        <span style={{ color: physicsDebugColors.static }}>Static</span>{' · '}
        <span style={{ color: physicsDebugColors.dynamic }}>Dynamic</span>{' · '}
        <span style={{ color: physicsDebugColors.kinematic }}>Kinematic</span>{' · '}
        <span style={{ color: physicsDebugColors.selected }}>Selected</span>
      </p>
      <p className="mh-scene3d__render-note">
        3D Scene view only, including Scene view during Play. Shows the shared solver’s axis-aligned boxes—not model outlines,
        controller capsules or terrain contours. Inactive and disabled colliders are skipped; while editing, hidden objects are skipped too.
        Up to {MAX_PHYSICS_DEBUG_BOXES} boxes per view. Select an object to isolate its box.
      </p>
    </>}
  </fieldset>;
}
