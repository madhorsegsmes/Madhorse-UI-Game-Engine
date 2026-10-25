import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const result = await build({
  stdin: {
    contents: `export { fitModelViewport } from './src/lib/model-viewport-fit';
      export * from 'three';`,
    resolveDir: new URL('../../', import.meta.url).pathname,
  },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const { fitModelViewport, Box3, BoxGeometry, Group, Mesh, PerspectiveCamera, Vector3 } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

function assertInView(camera, model) {
  const bounds = new Box3().setFromObject(model, true);
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const projected = new Vector3(x, y, z).project(camera);
        assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 &&
          Math.abs(projected.z) < 1, `Corner outside viewport: ${projected.toArray()}`);
      }
    }
  }
}

for (const scale of [1e-6, 1, 1e6]) {
  for (const aspect of [.25, 2]) {
    test(`fits offset, rotated geometry at scale ${scale}, aspect ${aspect} without editing transforms`, () => {
      const parent = new Group();
      parent.position.set(450, -75, 130);
      parent.rotation.set(.2, .4, -.3);
      parent.scale.set(2, .7, 1.5);
      const model = new Mesh(new BoxGeometry(2, 3, 4));
      model.geometry.translate(150, 20, -80);
      model.scale.setScalar(scale);
      parent.add(model);
      parent.updateWorldMatrix(true, true);
      const before = parent.toJSON();
      const camera = new PerspectiveCamera(48, aspect, .1, 3000);
      camera.position.set(10, 8, 12);
      const target = new Vector3();
      assert.equal(fitModelViewport(camera, model, target), true);
      assertInView(camera, model);
      assert.deepEqual(parent.toJSON(), before);
      assert.ok(target.distanceTo(new Box3().setFromObject(model).getCenter(new Vector3())) < 1e-6);
      // Repeated fits, including after fitting a different selection, must work.
      const other = new Mesh(new BoxGeometry(40, 20, 10));
      other.position.set(-2000, 70, 300);
      assert.equal(fitModelViewport(camera, other, target), true);
      assertInView(camera, other);
      assert.equal(fitModelViewport(camera, model, target), true);
      assertInView(camera, model);
    });
  }
}

test('empty models do not move the camera', () => {
  const camera = new PerspectiveCamera();
  const before = camera.position.clone();
  assert.equal(fitModelViewport(camera, new Group(), new Vector3()), false);
  assert.deepEqual(camera.position, before);
});
