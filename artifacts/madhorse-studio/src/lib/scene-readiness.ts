import type { SceneEditState } from './scene-edit-history';
import { isAssetCollection, isSceneEntity, type ProjectAsset } from './scene-model';
import { isGameAnimationCollection } from './game-api';
import { isEgoAnimationControllerCollection } from './ego-animation-controller';
import { isUIControlCollection } from './ui-controls';
import { isGameCamera } from './game-camera';
import { MAX_WEB_GAME_ASSET_BYTES, MAX_WEB_GAME_TOTAL_BYTES } from './web-game-limits';

export type SceneFinding = {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  fix: string;
  entityId?: string;
};
export type SceneCheckReport = {
  format: 'madhorse-scene-checks';
  version: 1;
  projectName: string;
  checkedAt: string;
  coverage: string;
  summary: { objects: number; assets: number; errors: number; warnings: number; information: number };
  files: { total: number; checked: number; missing: number; bytes: number; complete: boolean };
  findings: SceneFinding[];
  omittedFindings: number;
};
const MAX_FINDINGS = 200;
const MAX_FILES = 2000;
const fileAssets = (assets: ProjectAsset[]) => assets.filter(asset => asset.kind !== 'data' && asset.kind !== 'pbr-material');
function add(report: SceneCheckReport, finding: SceneFinding) {
  const counter = finding.severity === 'error' ? 'errors' : finding.severity === 'warning' ? 'warnings' : 'information';
  report.summary[counter]++;
  if (report.findings.length < MAX_FINDINGS) report.findings.push({ ...finding, message: finding.message.slice(0, 600), fix: finding.fix.slice(0, 600) });
  else report.omittedFindings++;
}

function readWithDeadline(
  read: (id: string) => Promise<{ size: number } | null>, id: string, signal?: AbortSignal,
): Promise<{ size: number } | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (work: () => void) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel); work();
    };
    const cancel = () => finish(() => reject(new DOMException('Scene check cancelled.', 'AbortError')));
    const timer = setTimeout(() => finish(() => reject(new Error('Browser asset read timed out.'))), 5000);
    if (signal?.aborted) { cancel(); return; }
    signal?.addEventListener('abort', cancel, { once: true });
    Promise.resolve().then(() => {
      if (signal?.aborted) throw new DOMException('Scene check cancelled.', 'AbortError');
      return read(id);
    }).then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
  });
}

/** Read-only metadata analysis. Findings are not an FPS test or an AAA-quality certification. */
export function analyzeScene(source: SceneEditState, projectName: string): SceneCheckReport {
  const report: SceneCheckReport = {
    format: 'madhorse-scene-checks', version: 1, projectName: projectName.slice(0, 80),
    checkedAt: new Date().toISOString(),
    coverage: 'Scene metadata, direct component/PBR asset links, hierarchy, animation targets and current-browser Studio file presence. No scripts are executed. GPU speed, visual quality, binary decoding and external GLTF dependencies are not tested. Final web export also needs space for its player and scene data.',
    summary: { objects: source.entities.length, assets: source.assets.length, errors: 0, warnings: 0, information: 0 },
    files: { total: fileAssets(source.assets).length, checked: 0, missing: 0, bytes: 0, complete: false },
    findings: [], omittedFindings: 0,
  };
  const entities = source.entities.slice(0, 10_000);
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  const entityIds = new Set(source.entities.map(entity => entity.id));
  const assets = new Map(source.assets.map(asset => [asset.id, asset]));
  const scripts = new Set(source.scripts.map(script => script.id));
  const clips = new Set(source.animations.map(clip => clip.id));
  const error = (code: string, message: string, fix: string, entityId?: string) => add(report, { severity: 'error', code, message, fix, entityId });
  if (!projectName.trim()) error('project-name', 'This project has no name.', 'Name the project before export.');
  if (!isAssetCollection(source.assets)) error('asset-data', 'Some asset metadata is invalid.', 'Restore valid asset data or reimport the affected assets.');
  if (!isGameAnimationCollection(source.animations) || !isEgoAnimationControllerCollection(source.animationControllers)) error('animation-data', 'Some saved animation/controller data is invalid or exceeds its supported limits.', 'Review animation settings before saving or exporting.');
  if (!isUIControlCollection(source.uiControls)) error('ui-data', 'Some UI definitions contain invalid saved settings.', 'Review the affected UI controls before exporting.');
  if (source.entities.length > 10_000) error('object-limit', 'This scene exceeds the current web exporter’s 10,000-object limit. Only the first 10,000 objects were checked.', 'Split the scene into smaller projects or reduce object count before web export.');
  if (!source.entities.some(entity => entity.active)) error('empty-scene', 'There are no active scene objects.', 'Create or enable an object in Hierarchy.');
  if (!isGameCamera(source.camera)) error('camera-invalid', 'The Game Camera contains invalid settings.', 'Open Game Camera settings and apply a valid position, aim and field of view.');
  if (byId.size !== entities.length) error('duplicate-object-id', 'Some scene objects share an internal identifier.', 'Restore a valid project copy; do not edit internal IDs manually.');
  if (assets.size !== source.assets.length) error('duplicate-asset-id', 'Some assets share an internal identifier.', 'Restore or reimport the affected assets.');
  function checkAsset(id: string | null | undefined, label: string, entityId?: string, expected?: ProjectAsset['kind']) {
    if (!id) return;
    const asset = assets.get(id);
    if (!asset) error('missing-asset', `${label} refers to an asset that is not in the project.`, 'Reimport the asset or choose a replacement in object/material settings.', entityId);
    else if (expected && asset.kind !== expected) error('asset-kind', `${label} needs a ${expected} asset, but uses ${asset.kind}.`, 'Choose an asset of the correct type.', entityId);
  }
  const completed = new Set<string>();
  for (const entity of entities) {
    const { name: entityName, id: entityId } = entity;
    if (!isSceneEntity(entity)) error('object-data', `${entityName} contains invalid object/component settings.`, 'Review this object’s settings or restore a valid copy.', entityId);
    if (entity.parentId && !entityIds.has(entity.parentId)) error('missing-parent', `${entity.name} has a missing parent.`, 'Unlink this object or restore its parent.', entity.id);
    const path = new Set<string>();
    let current: typeof entity | undefined = entity;
    while (current && !completed.has(current.id)) {
      if (path.has(current.id)) {
        error('hierarchy-cycle', `${entity.name} belongs to a circular object hierarchy.`, 'Unlink the affected objects so a parent is never its own descendant.', entity.id);
        break;
      }
      path.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    path.forEach(id => completed.add(id));
    for (const component of entity.components) {
      for (const [field, value] of Object.entries(component)) {
        if (!/assetId$/i.test(field) || typeof value !== 'string') continue;
        const expected = field === 'materialAssetId' ? 'pbr-material' : field === 'textureAssetId' ? 'image'
          : field === 'clipAssetId' ? 'audio' : field === 'assetId' && component.type === 'modelRenderer' ? 'model'
          : field === 'assetId' && component.type === 'spriteRenderer' ? 'image' : undefined;
        checkAsset(value, `${entity.name} / ${field}`, entity.id, expected);
      }
      if (component.type === 'triggerZone' && component.enabled) {
        const targets = [component.targetEntityId, ...(component.logicNodes ?? []).flatMap(node => 'targetEntityId' in node ? [node.targetEntityId] : [])];
        for (const target of new Set(targets)) if (target && !entityIds.has(target)) error('trigger-target', `${entity.name} targets an object that no longer exists.`, 'Choose a new trigger target or remove that action.', entity.id);
      }
      if (component.type === 'script' && component.enabled) add(report, {
        severity: 'warning', code: scripts.has(component.scriptId) ? 'offline-script' : 'missing-script',
        message: scripts.has(component.scriptId) ? `${entity.name} uses an imported script; standalone web games do not execute imported scripts.` : `${entity.name} has an enabled script component without saved source.`,
        fix: 'Use supported built-in actions/visual logic for portable web builds, or add the source for isolated Studio testing.', entityId: entity.id,
      });
      if (component.type === 'multiplayerPlugin' && component.enabled) add(report, { severity: 'warning', code: 'offline-network',
        message: `${entity.name} uses multiplayer; the current web exporter produces an offline game.`,
        fix: 'Test this build as single-player; online rooms and persistence need a separate supported deployment.', entityId: entity.id });
    }
  }
  for (const asset of source.assets) {
    if (asset.kind === 'pbr-material') for (const [slot, id] of Object.entries(asset.pbrMaterial?.maps ?? {})) {
      checkAsset(id, `${asset.name} / ${slot}`, undefined, 'image');
    }
  }
  for (const clip of source.animations) if (!entityIds.has(clip.targetEntityId)) error('animation-target', `${clip.name} has a missing animation target.`, 'Choose a scene object for this animation.');
  for (const controller of source.animationControllers) {
    if (!entityIds.has(controller.targetEntityId)) error('controller-target', `${controller.name} has a missing character/object target.`, 'Choose a valid controller target.');
    for (const clipId of new Set(Object.values(controller.states).flatMap(ids => ids ?? []))) {
      if (!clips.has(clipId)) error('controller-clip', `${controller.name} refers to an animation that is not saved.`, 'Choose an existing animation for this state.', entityIds.has(controller.targetEntityId) ? controller.targetEntityId : undefined);
    }
  }
  if (entities.length >= 1000) add(report, { severity: 'warning', code: 'many-objects', message: `${entities.length} scene objects may increase update and rendering costs.`, fix: 'Use the live performance stats on your target gaming PC. Object count is not an FPS measurement.' });
  const lights = entities.reduce((count, entity) => count + entity.components.filter(component => component.type === 'light' && component.enabled).length, 0);
  if (lights > 8) add(report, { severity: 'warning', code: 'many-lights', message: `${lights} enabled scene lights may be expensive.`, fix: 'Check the target GPU and reduce unnecessary lights. Cost depends on range, shadows and visible geometry.' });
  if (source.animations.length > 100 || source.animationControllers.length > 100) error('animation-limit', 'Animations or controllers exceed the saved-project limit of 100 per collection.', 'Reduce the collection before saving or exporting.');
  return report;
}

/** Pass a fresh analyzeScene result. Four read-only lookups at a time; no decoding, migration or writes. */
export async function checkSceneFiles(
  report: SceneCheckReport,
  assets: ProjectAsset[],
  read: (assetId: string) => Promise<{ size: number } | null>,
  signal?: AbortSignal,
  progress?: (done: number, total: number) => void,
): Promise<SceneCheckReport> {
  const result: SceneCheckReport = { ...report, summary: { ...report.summary }, findings: [...report.findings], files: { ...report.files } };
  const files = fileAssets(assets).slice(0, MAX_FILES);
  let next = 0, done = 0;
  const abort = () => { if (signal?.aborted) throw new DOMException('Scene check cancelled.', 'AbortError'); };
  await Promise.all(Array.from({ length: Math.min(4, files.length) }, async () => {
    while (next < files.length) {
      abort();
      const asset = files[next++];
      let file: { size: number } | null;
      try { file = await readWithDeadline(read, asset.id, signal); }
      catch {
        abort();
        add(result, { severity: 'warning', code: 'file-unverified', message: `${asset.name} could not be checked in browser storage.`, fix: 'Check browser storage permissions and retry. A read failure is not proof that the file is missing.' });
        done++; if (done % 25 === 0 || done === files.length) progress?.(done, files.length);
        continue;
      }
      abort(); result.files.checked++;
      if (!file) {
        result.files.missing++;
        add(result, { severity: 'error', code: 'file-missing', message: `${asset.name} is listed, but its file is missing from this browser’s Studio asset vault.`, fix: 'Restore or reimport this asset before export.' });
      } else {
        result.files.bytes += file.size;
        if (!file.size) add(result, { severity: 'error', code: 'file-empty', message: `${asset.name} contains no file data.`, fix: 'Reimport a non-empty file.' });
        if (file.size > MAX_WEB_GAME_ASSET_BYTES) add(result, { severity: 'error', code: 'file-limit', message: `${asset.name} exceeds the current web exporter’s 100 MiB per-file limit.`, fix: 'Optimize or replace the file before web export.' });
      }
      done++; if (done % 25 === 0 || done === files.length) progress?.(done, files.length);
    }
  }));
  abort();
  result.files.complete = result.files.checked === result.files.total;
  if (result.files.total > MAX_FILES) add(result, { severity: 'warning', code: 'scan-limit', message: `Only the first ${MAX_FILES} imported files were scanned.`, fix: 'This report is partial; additional files still require checking.' });
  if (result.files.bytes > MAX_WEB_GAME_TOTAL_BYTES) add(result, { severity: 'error', code: 'total-file-limit', message: 'Verified source files exceed the current 256 MiB web-export budget.', fix: 'Reduce source file sizes. The exported player also needs space within that budget.' });
  else if (result.files.bytes > MAX_WEB_GAME_TOTAL_BYTES * .8) add(result, { severity: 'warning', code: 'export-headroom', message: 'Source files are close to the current web-export size budget.', fix: 'Leave space for the player and scene data. The final exporter checks the complete package size.' });
  return result;
}
