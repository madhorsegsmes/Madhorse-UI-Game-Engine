import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { ModelingDocument } from './modeling-document';

export async function importModelingFiles(files: File[]): Promise<ModelingDocument> {
  if (files.reduce((total, file) => total + file.size, 0) > 100 * 1024 * 1024) {
    throw new Error('Choose a model and resources totaling less than 100 MB.');
  }
  const models = files.filter((file) => /\.(glb|gltf)$/i.test(file.name));
  if (models.length !== 1) throw new Error('Choose one .glb or .gltf file. For .gltf, also select its .bin and texture files.');
  const main = models[0];
  const urls: string[] = [];
  const resources = new Map<string, string>();
  for (const file of files) {
    const url = URL.createObjectURL(file);
    urls.push(url);
    resources.set(file.name, url);
    if (file.webkitRelativePath) resources.set(file.webkitRelativePath, url);
  }
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    const decoded = decodeURIComponent(url).replaceAll('\\', '/').replace(/^\.\//, '');
    const match = resources.get(decoded) ?? resources.get(decoded.split('/').at(-1) ?? '');
    if (!match) throw new Error(`Missing local resource: ${decoded}. Select it with the .gltf, or use an embedded GLB from Blender.`);
    return match;
  });
  try {
    const loader = new GLTFLoader(manager);
    const data = /\.glb$/i.test(main.name) ? await main.arrayBuffer() : await main.text();
    const loaded = await loader.parseAsync(data, '');
    loaded.scene.name ||= main.name.replace(/\.(glb|gltf)$/i, '');
    return { root: loaded.scene, clips: loaded.animations, name: main.name.replace(/\.(glb|gltf)$/i, '') };
  } catch (error) {
    throw new Error(`Could not import model: ${error instanceof Error ? error.message : 'invalid GLB/glTF'}. Compressed Draco models need to be exported uncompressed from Blender.`);
  } finally {
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
}

export async function exportModelingDocument(document: ModelingDocument, binary = true): Promise<File> {
  document.root.updateMatrixWorld(true);
  document.root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
  });
  const output = await new GLTFExporter().parseAsync(document.root, {
    binary, trs: true, onlyVisible: true, animations: document.clips,
  });
  const safeName = (document.name || 'Madhorse Model').replace(/[^\w .-]/g, '_');
  return binary
    ? new File([output as ArrayBuffer], `${safeName}.glb`, { type: 'model/gltf-binary' })
    : new File([JSON.stringify(output)], `${safeName}.gltf`, { type: 'model/gltf+json' });
}

export function downloadModelingFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
