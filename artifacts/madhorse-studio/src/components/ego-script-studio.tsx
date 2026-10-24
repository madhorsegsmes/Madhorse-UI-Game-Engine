import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Code2, FileCode2, Plus, Save, Trash2 } from 'lucide-react';
import type { GameCamera } from '@/lib/game-camera';
import type { SceneEntity } from '@/lib/scene-model';
import { getTransform } from '@/lib/scene-model';
import { maxScriptSize, movementLanguages, sourceSize, type ScriptFile } from '@/lib/project-scripts';
import { createEgoScript, createEgoScriptFromSource, egoEngineKnowledge, reviewEgoScript, type EgoScriptReview } from '@/lib/ego-script-core';

type EgoScriptStudioProps = {
  scripts: ScriptFile[];
  entities: SceneEntity[];
  camera: GameCamera;
  selectedEntityId: string | null;
  onCreate: (script: ScriptFile) => string;
  onUpdate: (script: ScriptFile) => string;
  onDelete: (id: string) => void;
};

export function EgoScriptStudio({
  scripts, entities, camera, selectedEntityId, onCreate, onUpdate, onDelete,
}: EgoScriptStudioProps) {
  const [language, setLanguage] = useState<string>('JavaScript');
  const [request, setRequest] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(scripts[0]?.id ?? null);
  const [draft, setDraft] = useState('');
  const [review, setReview] = useState<EgoScriptReview | null>(null);
  const [status, setStatus] = useState('');
  const selectedScript = scripts.find((script) => script.id === selectedId) ?? null;
  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId) ?? null;
  const selectedTransform = selectedEntity ? getTransform(selectedEntity) : null;
  const recentScripts = useMemo(() => [...scripts].slice(-5).reverse(), [scripts]);

  useEffect(() => {
    if (!selectedScript) {
      setSelectedId(scripts[0]?.id ?? null);
      setDraft(scripts[0]?.content ?? '');
      setReview(null);
      return;
    }
    setDraft(selectedScript.content);
    setLanguage(selectedScript.language);
    setReview(null);
  }, [selectedScript?.id, scripts]);

  const createScript = () => {
    try {
      const template = createEgoScript(language, request, scripts);
      const script: ScriptFile = { ...template, id: crypto.randomUUID() };
      const error = onCreate(script);
      if (error) {
        setStatus(error);
        return;
      }
      setSelectedId(script.id);
      setDraft(script.content);
      setReview(reviewEgoScript(script.content, script.language));
      setStatus(`Created ${script.name}. Review or edit it before using it.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not create this script.');
    }
  };

  const importScriptFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > maxScriptSize) {
      setStatus('Scripts must be 256 KB or smaller. The file was not read.');
      return;
    }
    const lowerName = file.name.toLowerCase();
    const detectedLanguage = lowerName.endsWith('.py') ? 'Python'
      : lowerName.endsWith('.c') ? 'C'
        : ['.cpp', '.cc', '.cxx'].some((extension) => lowerName.endsWith(extension)) ? 'C++'
          : ['.js', '.mjs'].some((extension) => lowerName.endsWith(extension)) ? 'JavaScript'
            : lowerName.endsWith('.ts') ? 'TypeScript'
              : lowerName.endsWith('.lua') ? 'Lua'
                : lowerName.endsWith('.cs') ? 'C#'
                  : null;
    if (!detectedLanguage) {
      setStatus('Choose a text script in Python, C, C++, JavaScript, TypeScript, Lua, or C#.');
      return;
    }
    try {
      const content = await file.text();
      const imported = createEgoScriptFromSource(detectedLanguage, file.name, content, scripts);
      const script: ScriptFile = { ...imported, id: crypto.randomUUID() };
      const error = onCreate(script);
      if (error) {
        setStatus(error);
        return;
      }
      setLanguage(detectedLanguage);
      setSelectedId(script.id);
      setDraft(script.content);
      setReview(reviewEgoScript(script.content, script.language));
      setStatus(`Imported ${file.name} as editable project data. Ego did not execute it.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not read this script file.');
    }
  };

  const saveScript = () => {
    if (!selectedScript) return;
    const error = onUpdate({ ...selectedScript, content: draft, size: sourceSize(draft) });
    setStatus(error || `Saved ${selectedScript.name} in this browser project.`);
    if (!error) setReview(null);
  };

  const analyzeScript = () => {
    const result = reviewEgoScript(draft, selectedScript?.language ?? language);
    setReview(result);
    setStatus(result.summary);
  };

  const removeScript = () => {
    if (!selectedScript) return;
    const remaining = scripts.filter((script) => script.id !== selectedScript.id);
    onDelete(selectedScript.id);
    setSelectedId(remaining[0]?.id ?? null);
    setDraft(remaining[0]?.content ?? '');
    setReview(null);
    setStatus(`Removed ${selectedScript.name} from this browser project.`);
  };

  return (
    <section className="ego-script-studio" data-testid="ego-script-studio">
      <div className="ego-script-heading">
        <div><Code2 size={16} aria-hidden="true" /><div><h3>Ego Script Workshop</h3><p>Make, review, and edit project-local script examples.</p></div></div>
        <span>{scripts.length} saved</span>
      </div>

      <div className="ego-script-context" data-testid="ego-script-context">
        <strong>What Ego can see</strong>
        <span>Scene 1 · {entities.length} objects · camera at ({camera.position.x.toFixed(1)}, {camera.position.y.toFixed(1)}, {camera.position.z.toFixed(1)})</span>
        <span>{selectedEntity && selectedTransform
          ? `Selected: ${selectedEntity.name} · ${selectedEntity.components.map((component) => component.type).join(', ') || 'no components'}`
          : 'Selected: none'}</span>
        <div className="ego-script-scene-list" aria-label="Scene object summary">
          {entities.slice(0, 5).map((entity) => (
            <span key={entity.id}>{entity.name} · {entity.components.map((component) => component.type).join(', ') || 'object'}</span>
          ))}
          {entities.length > 5 && <span>+ {entities.length - 5} more scene objects</span>}
        </div>
        <small>Ego reads saved scene data and camera values; it does not inspect rendered viewport pixels.</small>
      </div>

      <div className="ego-script-create">
        <label className="ego-field">
          <span>Script language</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)} data-testid="ego-script-language">
            {movementLanguages.map((entry) => <option key={entry.language} value={entry.language}>{entry.language}</option>)}
          </select>
        </label>
        <label className="ego-field">
          <span>Describe a supported movement</span>
          <input
            value={request}
            onChange={(event) => setRequest(event.target.value)}
            placeholder="Try: move right by 8, or move to 70, 35"
            maxLength={200}
            data-testid="ego-script-request"
          />
        </label>
        <button type="button" className="ego-script-primary" onClick={createScript} data-testid="ego-create-script">
          <Plus size={14} aria-hidden="true" /> Create safe starter
        </button>
        <small>Current generated scripts use Madhorse’s validated move/set-position command. Other engine systems use editable native components.</small>
        <label className="ego-script-import">
          <span>Import source as editable text</span>
          <input
            type="file"
            accept=".py,.c,.cpp,.cc,.cxx,.js,.mjs,.ts,.lua,.cs,text/plain"
            onChange={importScriptFile}
            data-testid="ego-import-script"
          />
          <small>Supported languages: Python, C, C++, JavaScript, TypeScript, Lua, and C#. Maximum 256 KB. Imported code is stored, never run by Ego.</small>
        </label>
      </div>

      <div className="ego-script-editor">
        <label className="ego-field">
          <span>Saved script</span>
          <select
            value={selectedScript?.id ?? ''}
            onChange={(event) => {
              const next = scripts.find((script) => script.id === event.target.value);
              setSelectedId(next?.id ?? null);
              setDraft(next?.content ?? '');
              setLanguage(next?.language ?? language);
              setReview(null);
            }}
            data-testid="ego-script-selection"
          >
            {!scripts.length && <option value="">Create a starter script first</option>}
            {scripts.map((script) => <option key={script.id} value={script.id}>{script.name} · {script.language}</option>)}
          </select>
        </label>
        <label className="ego-field">
          <span>Source · {selectedScript?.language ?? language}</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            disabled={!selectedScript}
            data-testid="ego-script-source"
          />
        </label>
        <div className="ego-script-actions">
          <button type="button" onClick={saveScript} disabled={!selectedScript} data-testid="ego-save-script">
            <Save size={13} aria-hidden="true" /> Save edits
          </button>
          <button type="button" onClick={analyzeScript} disabled={!draft.trim()} data-testid="ego-review-script">
            <FileCode2 size={13} aria-hidden="true" /> Review commands
          </button>
          <button type="button" className="danger" onClick={removeScript} disabled={!selectedScript} data-testid="ego-delete-script">
            <Trash2 size={13} aria-hidden="true" /> Remove
          </button>
        </div>
        {status && <p className="ego-script-status" role="status">{status}</p>}
        {review && (
          <div className="ego-script-review" role="status" data-testid="ego-script-review-result">
            <strong>{review.summary}</strong>
            {review.finalPosition && <span>Last valid preview position: x {review.finalPosition.x}, y {review.finalPosition.y}</span>}
            {review.notes.map((note, index) => <small key={`${index}-${note}`}>{note}</small>)}
            {!review.notes.some((note) => note.includes('did not execute')) && <small>Ego never runs source during review.</small>}
          </div>
        )}
      </div>

      <div className="ego-script-learning">
        <div className="ego-script-heading">
          <div><BookOpen size={15} aria-hidden="true" /><div><h3>Engine knowledge</h3><p>Concepts mapped to Madhorse’s current tools.</p></div></div>
          <span>Local reference</span>
        </div>
        <div className="ego-engine-knowledge">
          {egoEngineKnowledge.map((entry) => (
            <article key={entry.name}>
              <strong>{entry.name}</strong>
              <p>{entry.concept}</p>
              <small>{entry.madhorse}</small>
            </article>
          ))}
        </div>
        <div className="ego-script-saved-examples">
          <strong>Reusable project examples</strong>
          {recentScripts.length
            ? recentScripts.map((script) => <button key={script.id} type="button" onClick={() => {
              setSelectedId(script.id);
              setDraft(script.content);
              setLanguage(script.language);
              setReview(null);
            }}>{script.name} · {script.language}</button>)
            : <small>Saved and edited scripts stay in this browser project for you to reuse. This is project memory, not automatic model training.</small>}
        </div>
      </div>
    </section>
  );
}
