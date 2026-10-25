import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import * as THREE from 'three';
import { ModelLodController } from '../../src/lib/model-lod-controller';
import { DEFAULT_MODEL_LOD } from '../../src/lib/model-lod-settings';
import { getModelLodReport } from '../../src/lib/model-lod-report';
import { createModelRendererComponent, createTransformComponent, type SceneEntity } from '../../src/lib/scene-model';
import { SceneObjectInspector } from '../../src/components/scene-object-inspector';

const status = document.getElementById('verification')!;
async function verify() {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshStandardMaterial());
  const controller = new ModelLodController(mesh, 'lod-worker-verification', 'synthetic-sphere');
  await controller.prepare();
  const report = getModelLodReport('lod-worker-verification');
  if (report?.phase !== 'ready' || report.lowTriangles >= report.fullTriangles) {
    throw new Error(`Browser worker did not produce a reduction: ${report?.message}`);
  }
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 10000);
  camera.position.z = 1000; camera.updateMatrixWorld();
  controller.update(camera, DEFAULT_MODEL_LOD, false);
  if (mesh.geometry.index!.count / 3 !== report.lowTriangles) throw new Error('Camera-based switching did not select generated geometry.');
  controller.update(camera, DEFAULT_MODEL_LOD, true);
  if (mesh.geometry.index!.count / 3 !== report.fullTriangles) throw new Error('Selection did not restore original geometry.');

  const renderer = createModelRendererComponent();
  renderer.enabled = false;
  delete renderer.lod; // Exercise legacy defaults and opting in through the actual UI.
  const entity: SceneEntity = { id: 'lod-inspector-verification', name: 'Static model LOD settings',
    parentId: null, active: true, components: [createTransformComponent(), renderer] };
  let saved: SceneEntity | null = null;
  flushSync(() => createRoot(document.getElementById('root')!).render(createElement(SceneObjectInspector, {
    entity, entities: [entity], assets: [], assetUrls: {}, embedded: true,
    onClose() {}, onSave(value) { saved = value; },
  })));
  document.querySelectorAll('details').forEach(details => { details.open = true; });
  const label = (prefix: string) => Array.from(document.querySelectorAll('label')).find(item => item.textContent?.trim().startsWith(prefix))!;
  flushSync(() => (label('Automatic model detail').querySelector('input') as HTMLInputElement).click());
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  for (const [name, value] of [['Medium detail below', '22'], ['Low detail below', '4']]) {
    const input = label(name).querySelector('input')!;
    flushSync(() => { nativeSetter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
  }
  document.querySelector('form')!.requestSubmit();
  const model = (saved as SceneEntity | null)?.components.find(item => item.type === 'modelRenderer');
  if (model?.type !== 'modelRenderer' || model.lod?.enabled !== true ||
    model.lod.mediumScreenPercent !== 22 || model.lod.lowScreenPercent !== 4) {
    throw new Error('Actual inspector form did not save the LOD values.');
  }
  status.textContent = `PASS — real browser worker: ${report.fullTriangles} → ${report.mediumTriangles} → ${report.lowTriangles} triangles. Far/selected switching and actual inspector saving (22% / 4%) passed.`;
  status.style.color = '#8dffc4';
  controller.dispose();
}
void verify().catch(error => {
  status.textContent = `FAIL — ${error instanceof Error ? error.message : error}`;
  status.style.color = '#ff7676';
  console.error(error);
});
