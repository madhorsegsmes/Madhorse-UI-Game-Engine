import { useState, type FormEvent } from 'react';
import type { ProjectAsset, ScriptableObjectData, ScriptableObjectField } from '@/lib/scene-model';
import { isProjectAsset } from '@/lib/scene-model';
import './scriptable-object-editor.css';

type Props = {
  asset: ProjectAsset;
  onClose: () => void;
  onSave: (asset: ProjectAsset) => void;
};

function fieldValue(type: ScriptableObjectField['type']): string | number | boolean {
  if (type === 'number') return 0;
  if (type === 'boolean') return false;
  return '';
}

export function ScriptableObjectEditor({ asset, onClose, onSave }: Props) {
  const saveDraft = (draft: ProjectAsset) => {
    if (isProjectAsset(draft)) onSave(draft);
  };
  const currentData: ScriptableObjectData = asset.data ?? { schemaVersion: 1, fields: [] };
  const updateAsset = (name: string, data: ScriptableObjectData): ProjectAsset => {
    const next = {
      ...asset,
      name,
      data,
      size: JSON.stringify(data).length,
    };
    return next;
  };
  const [name, setName] = useState(asset.name);
  const [data, setData] = useState<ScriptableObjectData>(currentData);
  const [error, setError] = useState('');

  function addField() {
    if (data.fields.length >= 50) {
      setError('This asset can hold up to 50 fields.');
      return;
    }
    const baseName = 'newField';
    let uniqueName = baseName;
    let number = 2;
    while (data.fields.some(field => field.name.toLowerCase() === uniqueName.toLowerCase())) {
      uniqueName = `${baseName}${number++}`;
    }
    const field: ScriptableObjectField = {
      id: crypto.randomUUID(),
      name: uniqueName,
      type: 'text',
      value: '',
    };
    setData(current => ({ ...current, fields: [...current.fields, field] }));
    setError('');
  }

  function updateField(id: string, changes: Partial<ScriptableObjectField>) {
    setData(current => ({
      ...current,
      fields: current.fields.map(field => {
        if (field.id !== id) return field;
        const next = { ...field, ...changes };
        if (changes.type) next.value = fieldValue(changes.type);
        return next;
      }),
    }));
    setError('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Give this data asset a name.');
      return;
    }
    if (data.fields.some(field => !field.name.trim())) {
      setError('Each field needs a name.');
      return;
    }
    const fieldNames = data.fields.map(field => field.name.trim().toLocaleLowerCase());
    if (new Set(fieldNames).size !== fieldNames.length) {
      setError('Each field name must be unique.');
      return;
    }
    const next = updateAsset(trimmedName, data);
    if (!isProjectAsset(next)) {
      setError('Check field names and values. Text fields can be up to 5,000 characters.');
      return;
    }
    saveDraft(next);
  }

  return (
    <div className="scriptable-object-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className="scriptable-object-dialog" role="dialog" aria-modal="true"
        aria-labelledby="scriptable-object-title" onSubmit={submit} data-testid="scriptable-object-editor">
        <header className="scriptable-object-header">
          <div>
            <span>ASSET PLUGINS</span>
            <h2 id="scriptable-object-title">Scriptable Object</h2>
            <p>Reusable project data. Values save with this browser’s project.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Scriptable Object editor">×</button>
        </header>
        <label className="scriptable-object-name">
          Asset name
          <input autoFocus value={name} maxLength={80} required data-testid="scriptable-object-name"
            onChange={event => setName(event.currentTarget.value)} />
        </label>
        <div className="scriptable-object-fields-title">
          <h3>Reusable fields</h3>
          <button type="button" onClick={addField} disabled={data.fields.length >= 50} data-testid="scriptable-add-field">
            + Add field
          </button>
        </div>
        {data.fields.length === 0 ? <p className="scriptable-object-empty">Add a field to hold a name, number, or on/off value.</p> : (
          <div className="scriptable-object-fields">
            {data.fields.map(field => (
              <div className="scriptable-object-field" key={field.id} data-testid={`scriptable-field-${field.id}`}>
                <label>
                  Field name
                  <input value={field.name} maxLength={50} required
                    onChange={event => updateField(field.id, { name: event.currentTarget.value })} />
                </label>
                <label>
                  Type
                  <select value={field.type} onChange={event => updateField(field.id, {
                    type: event.currentTarget.value as ScriptableObjectField['type'],
                  })}>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">On / off</option>
                  </select>
                </label>
                <label className="scriptable-object-value">
                  Value
                  {field.type === 'boolean' ? (
                    <select value={String(field.value)} onChange={event => updateField(field.id, { value: event.currentTarget.value === 'true' })}>
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                  ) : field.type === 'number' ? (
                    <input type="number" value={Number(field.value)} step="any" min={-1_000_000_000} max={1_000_000_000}
                      onChange={event => updateField(field.id, { value: event.currentTarget.valueAsNumber })} />
                  ) : (
                    <input value={String(field.value)} maxLength={5000}
                      onChange={event => updateField(field.id, { value: event.currentTarget.value })} />
                  )}
                </label>
                <button type="button" className="scriptable-object-delete" aria-label={`Remove ${field.name || 'field'}`}
                  onClick={() => setData(current => ({ ...current, fields: current.fields.filter(item => item.id !== field.id) }))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        {error && <p className="scriptable-object-error" role="alert">{error}</p>}
        <footer className="scriptable-object-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="scriptable-object-save" data-testid="scriptable-save">Save data asset</button>
        </footer>
      </form>
    </div>
  );
}
