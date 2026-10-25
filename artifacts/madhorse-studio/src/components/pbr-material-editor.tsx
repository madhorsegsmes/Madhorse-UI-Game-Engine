import { useMemo, useState, type ChangeEvent } from 'react';
import {
  createPbrMaterialAsset,
  createPbrMaterialDefinition,
  createPbrMaterialExchange,
  isPbrMaterialDefinition,
  parsePbrMaterialExchange,
  pbrMapSlots,
  pbrTextureSlotForFilename,
  type PbrMapSlot,
  type PbrMaterialDefinition,
} from '@/lib/pbr-material';
import type { ProjectAsset } from '@/lib/scene-model';

const mapLabels: Record<PbrMapSlot, string> = {
  baseColor: 'Base color (sRGB)',
  normal: 'Normal (linear)',
  roughness: 'Roughness',
  metalness: 'Metalness',
  ambientOcclusion: 'Ambient occlusion',
  emissive: 'Emissive (sRGB)',
};

export function PbrMaterialEditor({
  asset,
  imageAssets,
  onImportMaps,
  onSave,
  onClose,
}: {
  asset: ProjectAsset | null;
  imageAssets: ProjectAsset[];
  onImportMaps: (files: File[]) => Promise<ProjectAsset[]>;
  onSave: (asset: ProjectAsset) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(asset?.name ?? 'New PBR Material');
  const [material, setMaterial] = useState<PbrMaterialDefinition>(
    asset?.pbrMaterial ?? createPbrMaterialDefinition(),
  );
  const [error, setError] = useState('');
  const sortedImages = useMemo(() => [...imageAssets].sort((a, b) => a.name.localeCompare(b.name)), [imageAssets]);

  function update(values: Partial<PbrMaterialDefinition>) {
    setMaterial(current => ({ ...current, ...values }));
    setError('');
  }

  async function importBundle(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.currentTarget.files ?? [])];
    event.currentTarget.value = '';
    if (!files.length) return;
    try {
      const descriptorFile = files.find(file => /\.mhpbr\.json$/i.test(file.name));
      if (files.some(file => /\.json$/i.test(file.name)) && !descriptorFile) {
        throw new Error('Choose a .mhpbr.json material file, not an unrelated JSON file.');
      }
      if (descriptorFile && descriptorFile.size > 1_000_000) {
        throw new Error('The material settings file must be smaller than 1 MB.');
      }
      const parsed = descriptorFile
        ? parsePbrMaterialExchange(JSON.parse(await descriptorFile.text()))
        : null;
      let imported: ProjectAsset[] = [];
      const imageFiles = files.filter(file => file !== descriptorFile);
      if (imageFiles.length) imported = await onImportMaps(imageFiles);

      if (parsed) {
        const allImages = [...imported, ...sortedImages];
        const maps = Object.fromEntries(pbrMapSlots.map(slot => {
          const requestedName = parsed.material.maps[slot];
          const match = typeof requestedName === 'string'
            ? allImages.find(image => image.name.toLowerCase() === requestedName.toLowerCase())
            : undefined;
          return [slot, match?.id ?? null];
        })) as PbrMaterialDefinition['maps'];
        setName(parsed.name);
        setMaterial({ ...parsed.material, maps });
        setError(Object.entries(parsed.material.maps).some(([slot, requested]) => Boolean(requested) && !maps[slot as PbrMapSlot])
          ? 'Material settings loaded. Add matching image files to restore its texture maps.' : '');
        return;
      }

      const next = { ...material, maps: { ...material.maps } };
      for (const image of imported) {
        const slots = pbrTextureSlotForFilename(image.name);
        const detected = slots.length ? slots : imported.length === 1 ? ['baseColor' as const] : [];
        for (const slot of detected) next.maps[slot] = image.id;
      }
      if (!imported.length) throw new Error('Choose image maps or a .mhpbr.json material file.');
      setMaterial(next);
      setError(imported.some(image => !pbrTextureSlotForFilename(image.name).length) && imported.length > 1
        ? 'Imported image maps. Pick a map slot for any files that could not be identified from their names.' : '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not import this PBR material.');
    }
  }

  function importExchangeFile() {
    const value = createPbrMaterialExchange(name.trim(), material, sortedImages);
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name.trim().replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 64) || 'material'}.mhpbr.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  function save() {
    if (!name.trim() || name.trim().length > 100 || !isPbrMaterialDefinition(material)) {
      setError('Enter a material name and valid supported PBR values.');
      return;
    }
    const base = asset ?? createPbrMaterialAsset();
    onSave({
      ...base,
      name: name.trim(),
      kind: 'pbr-material',
      mimeType: 'application/x-madhorse-pbr-material+json',
      size: JSON.stringify(material).length,
      pbrMaterial: material,
      data: undefined,
    });
  }

  return (
    <div className="fresh-timeline-backdrop pbr-material-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="fresh-timeline-dialog pbr-material-dialog" role="dialog" aria-modal="true"
        aria-labelledby="pbr-material-title" data-testid="pbr-material-editor">
        <header>
          <div>
            <span className="fresh-dialog-kicker">PROJECT ASSET · PBR</span>
            <h2 id="pbr-material-title">{asset ? 'Edit PBR Material' : 'Create PBR Material'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close PBR material editor">×</button>
        </header>
        <form className="pbr-material-editor-form" onSubmit={event => { event.preventDefault(); save(); }}>
          <label>Material name<input data-testid="pbr-material-name" value={name}
            maxLength={100} onChange={event => setName(event.currentTarget.value)} /></label>
          <div className="pbr-material-value-grid">
            <label>Base color<input data-testid="pbr-base-color" type="color" value={material.baseColor}
              onChange={event => update({ baseColor: event.currentTarget.value })} /></label>
            <label>Roughness · {material.roughness.toFixed(2)}<input data-testid="pbr-roughness" type="range"
              min="0" max="1" step=".01" value={material.roughness}
              onChange={event => update({ roughness: Number(event.currentTarget.value) })} /></label>
            <label>Metalness · {material.metalness.toFixed(2)}<input data-testid="pbr-metalness" type="range"
              min="0" max="1" step=".01" value={material.metalness}
              onChange={event => update({ metalness: Number(event.currentTarget.value) })} /></label>
            <label>Opacity · {material.opacity.toFixed(2)}<input type="range" min=".05" max="1" step=".01"
              value={material.opacity} onChange={event => update({ opacity: Number(event.currentTarget.value) })} /></label>
            <label>Normal strength · {material.normalScale.toFixed(2)}<input type="range" min="0" max="4" step=".05"
              value={material.normalScale} onChange={event => update({ normalScale: Number(event.currentTarget.value) })} /></label>
            <label>AO strength · {material.ambientOcclusionIntensity.toFixed(2)}<input type="range" min="0" max="2" step=".05"
              value={material.ambientOcclusionIntensity} onChange={event => update({ ambientOcclusionIntensity: Number(event.currentTarget.value) })} /></label>
            <label>Emissive color<input type="color" value={material.emissiveColor}
              onChange={event => update({ emissiveColor: event.currentTarget.value })} /></label>
            <label>Emissive strength · {material.emissiveIntensity.toFixed(2)}<input type="range" min="0" max="10" step=".1"
              value={material.emissiveIntensity} onChange={event => update({ emissiveIntensity: Number(event.currentTarget.value) })} /></label>
          </div>
          <fieldset className="pbr-material-map-list">
            <legend>Texture maps</legend>
            <p>Color and emissive maps use sRGB; normal, roughness, metalness, and AO maps use linear data.</p>
            {pbrMapSlots.map(slot => (
              <label key={slot}>{mapLabels[slot]}
                <select data-testid={`pbr-map-${slot}`} value={material.maps[slot] ?? ''}
                  onChange={event => update({ maps: { ...material.maps, [slot]: event.currentTarget.value || null } })}>
                  <option value="">No map</option>
                  {sortedImages.map(image => <option key={image.id} value={image.id}>{image.name}</option>)}
                </select>
              </label>
            ))}
          </fieldset>
          <label className="pbr-material-import">
            Import PBR material or texture maps
            <input data-testid="pbr-import-files" type="file" multiple
              accept=".mhpbr.json,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp,application/json"
              onChange={event => { void importBundle(event); }} />
            <small>Import a .mhpbr.json and its named images together, or select image maps. Common map names, including packed ORM, are recognized automatically.</small>
          </label>
          {error && <p className="fresh-object-inspector-error" role="alert">{error}</p>}
          <footer className="pbr-material-actions">
            <button type="button" onClick={importExchangeFile}>Export .mhpbr.json</button>
            <span />
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" data-testid="pbr-save-material">Save material</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
