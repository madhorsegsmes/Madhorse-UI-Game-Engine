import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { SceneEntity, TriggerZoneComponent, VisualLogicNode } from '@/lib/scene-model';

const nodeTitles: Record<VisualLogicNode['type'], string> = {
  'condition-item': 'CHECK · Player has an item',
  message: 'ACTION · Show a message',
  'enable-target': 'ACTION · Enable an object',
  'disable-target': 'ACTION · Disable an object',
  'toggle-target': 'ACTION · Toggle an object',
};

export function VisualLogicEditor({ zone, entity, entities, onChange }: {
  zone: TriggerZoneComponent;
  entity: SceneEntity;
  entities: SceneEntity[];
  onChange: (nodes: VisualLogicNode[]) => void;
}) {
  const nodes = zone.logicNodes ?? [];
  const candidates = useMemo(() => entities.filter(candidate =>
    candidate.id !== entity.id && !candidate.isGroup && candidate.components.some(component =>
      component.type === 'primitive' || component.type === 'modelRenderer' || component.type === 'light',
    ),
  ), [entities, entity.id]);
  const append = (node: VisualLogicNode) => {
    if (nodes.length < 16) onChange([...nodes, node]);
  };
  const update = (index: number, next: VisualLogicNode) =>
    onChange(nodes.map((node, nodeIndex) => nodeIndex === index ? next : node));

  return (
    <div className="fresh-logic-builder" data-testid="visual-logic-builder">
      <p className="fresh-inspector-note">Build a safe, no-code flow. It runs when a player enters this zone. Steps run from top to bottom; failed checks stop the remaining steps. This does not run script files.</p>
      <div className="fresh-logic-node fresh-logic-event" data-testid="logic-event-node">
        <small>EVENT · START</small>
        <strong>Player enters this zone</strong>
      </div>
      {nodes.length === 0 && <p className="fresh-logic-empty">Add a check or action to start your flow.</p>}
      {nodes.map((node, index) => (
        <article className="fresh-logic-node" key={node.id} data-testid={`logic-node-${index}`}>
          <header>
            <strong>{nodeTitles[node.type]}</strong>
            <button type="button" onClick={() => onChange(nodes.filter((_, nodeIndex) => nodeIndex !== index))}
              aria-label={`Remove step ${index + 1}`} data-testid={`logic-remove-${index}`}><Trash2 size={12} /></button>
          </header>
          {node.type === 'condition-item' && <>
            <label className="fresh-setting"><span>Item to check</span>
              <select value={node.item} onChange={event => update(index, { ...node, item: event.currentTarget.value as typeof node.item })}>
                <option value="keys">Keys</option><option value="coins">Coins</option>
                <option value="wood">Wood</option><option value="planks">Planks</option>
              </select>
            </label>
            <label className="fresh-setting"><span>Minimum amount</span>
              <input type="number" min="1" max="999" step="1" value={node.minimum}
                onChange={event => update(index, { ...node, minimum: Math.max(1, Math.min(999, Number(event.currentTarget.value) || 1)) })} />
            </label>
            <label className="fresh-setting"><span>If missing</span>
              <input type="text" maxLength={160} value={node.failMessage}
                onChange={event => update(index, { ...node, failMessage: event.currentTarget.value })} />
            </label>
          </>}
          {node.type === 'message' && (
            <label className="fresh-setting"><span>Message</span>
              <input type="text" maxLength={160} value={node.message}
                onChange={event => update(index, { ...node, message: event.currentTarget.value })} />
            </label>
          )}
          {node.type !== 'condition-item' && node.type !== 'message' && (
            <label className="fresh-setting"><span>Target object</span>
              <select value={node.targetEntityId ?? ''} onChange={event =>
                update(index, { ...node, targetEntityId: event.currentTarget.value || null })}>
                <option value="">Choose an object…</option>
                {candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
              </select>
            </label>
          )}
          {index < nodes.length - 1 && <div className="fresh-logic-connector" aria-hidden="true">THEN ↓</div>}
        </article>
      ))}
      <div className="fresh-logic-add-row" role="group" aria-label="Add visual logic step">
        <button type="button" disabled={nodes.length >= 16} onClick={() => append({
          id: crypto.randomUUID(), type: 'condition-item', item: 'keys', minimum: 1, failMessage: 'You need a key.',
        })}><Plus size={12} /> Check item</button>
        <button type="button" disabled={nodes.length >= 16} onClick={() => append({
          id: crypto.randomUUID(), type: 'message', message: 'You made it!',
        })}><Plus size={12} /> Show message</button>
        <button type="button" disabled={nodes.length >= 16} onClick={() => append({
          id: crypto.randomUUID(), type: 'enable-target', targetEntityId: null,
        })}><Plus size={12} /> Enable object</button>
        <button type="button" disabled={nodes.length >= 16} onClick={() => append({
          id: crypto.randomUUID(), type: 'disable-target', targetEntityId: null,
        })}><Plus size={12} /> Disable object</button>
        <button type="button" disabled={nodes.length >= 16} onClick={() => append({
          id: crypto.randomUUID(), type: 'toggle-target', targetEntityId: null,
        })}><Plus size={12} /> Toggle object</button>
      </div>
      <p className="fresh-inspector-note">Visual flow · {nodes.length}/16 steps · Saved with this scene.</p>
    </div>
  );
}
