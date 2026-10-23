import type { BufferGeometry, Object3D } from 'three';

export function hasRenderableModelGeometry(root: Object3D): boolean {
  let found = false;
  root.traverse((object) => {
    const candidate = object as Object3D & {
      geometry?: BufferGeometry;
      isMesh?: boolean;
      isLine?: boolean;
      isPoints?: boolean;
    };
    if (
      (candidate.isMesh || candidate.isLine || candidate.isPoints) &&
      (candidate.geometry?.getAttribute('position')?.count ?? 0) > 0
    ) {
      found = true;
    }
  });
  return found;
}
