import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { createStoryboardComponent, type SceneEntity, type StoryboardBeat } from '@/lib/scene-model';

function getBoard(entity: SceneEntity) {
  return entity.components.find(component => component.type === 'storyboard');
}

export function StoryboardEditor({ entities, onCreate, onSave, onClose }: {
  entities: SceneEntity[];
  onCreate: () => string;
  onSave: (entity: SceneEntity) => void;
  onClose: () => void;
}) {
  const boards = entities.filter(entity => Boolean(getBoard(entity)));
  const [selectedId, setSelectedId] = useState(boards[0]?.id ?? '');
  const selected = boards.find(entity => entity.id === selectedId) ?? boards[0];
  const component = selected ? getBoard(selected) : undefined;
  const [title, setTitle] = useState(component?.title ?? '');
  const [beats, setBeats] = useState<StoryboardBeat[]>(component?.beats ?? []);

  useEffect(() => {
    setTitle(component?.title ?? '');
    setBeats(component?.beats ?? []);
  }, [selected?.id]);

  const addBoard = () => {
    const id = onCreate();
    setSelectedId(id);
  };
  const save = () => {
    if (!selected || !component) return;
    onSave({
      ...selected,
      components: selected.components.map(item => item.id === component.id
        ? { ...component, title: title.trim() || 'New Storyboard', beats }
        : item),
    });
  };
  const updateBeat = (id: string, patch: Partial<StoryboardBeat>) =>
    setBeats(current => current.map(beat => beat.id === id ? { ...beat, ...patch } : beat));

  return (
    <div className="fresh-game-tools-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="fresh-storyboard-dialog" role="dialog" aria-modal="true" aria-label="Storyboard Editor" data-testid="storyboard-editor">
        <header className="fresh-game-tools-heading">
          <div><small>GAME GURU–STYLE MISSION PLANNING</small><h2>Storyboard</h2></div>
          <button type="button" aria-label="Close storyboard editor" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="fresh-storyboard-content">
          <div className="fresh-storyboard-topline">
            <label className="fresh-setting"><span>Scene storyboard</span>
              <select value={selected?.id ?? ''} onChange={event => setSelectedId(event.currentTarget.value)}>
                {!boards.length && <option value="">No storyboards yet</option>}
                {boards.map(board => <option key={board.id} value={board.id}>{getBoard(board)?.title ?? board.name}</option>)}
              </select>
            </label>
            <button type="button" className="fresh-storyboard-action" onClick={addBoard}><Plus size={13} /> New storyboard</button>
          </div>
          {selected && component ? <>
            <label className="fresh-setting"><span>Storyboard title</span>
              <input type="text" value={title} maxLength={100} onChange={event => setTitle(event.currentTarget.value)} />
            </label>
            <div className="fresh-storyboard-beats">
              {beats.map((beat, index) => (
                <article className="fresh-storyboard-beat" key={beat.id} data-testid={`storyboard-beat-${index}`}>
                  <div className="fresh-storyboard-beat-head">
                    <span>STEP {String(index + 1).padStart(2, '0')}</span>
                    <button type="button" aria-label={`Remove ${beat.title}`} onClick={() =>
                      setBeats(current => current.filter(item => item.id !== beat.id))}><Trash2 size={12} /></button>
                  </div>
                  <label className="fresh-setting"><span>Mission step</span>
                    <input type="text" value={beat.title} maxLength={100} onChange={event => updateBeat(beat.id, { title: event.currentTarget.value })} />
                  </label>
                  <label className="fresh-setting"><span>What happens next</span>
                    <textarea value={beat.note} maxLength={300} rows={2} onChange={event => updateBeat(beat.id, { note: event.currentTarget.value })} />
                  </label>
                  <label className="fresh-setting fresh-storyboard-check"><span>Mark step complete</span>
                    <input type="checkbox" checked={beat.complete} onChange={event => updateBeat(beat.id, { complete: event.currentTarget.checked })} />
                  </label>
                </article>
              ))}
              {!beats.length && <p className="fresh-logic-empty">Start with a mission step. Storyboards are saved with this scene.</p>}
            </div>
            <button type="button" className="fresh-storyboard-action" disabled={beats.length >= 30}
              onClick={() => setBeats(current => [...current, {
                id: crypto.randomUUID(), title: `New step ${current.length + 1}`, note: '', complete: false,
              }])}><Plus size={13} /> Add mission step</button>
            <div className="fresh-storyboard-footer">
              <span>{beats.length}/30 mission steps · Saved with Scene 1</span>
              <button type="button" className="fresh-storyboard-action primary" onClick={save}><Save size={13} /> Save storyboard</button>
            </div>
          </> : (
            <div className="fresh-storyboard-empty">
              <p>Storyboards are saved as scene data and appear in Hierarchy.</p>
              <button type="button" className="fresh-storyboard-action primary" onClick={addBoard}><Plus size={13} /> Create storyboard</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
