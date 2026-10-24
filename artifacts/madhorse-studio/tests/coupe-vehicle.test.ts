import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { compileBuilderPlan } from '../src/lib/mad-builder';
import { createPrimitiveGeometry } from '../src/lib/scene-view-geometry';
import { createStarterCube, getPrimitive, getTransform, getWorldTransform, isSceneGraph } from '../src/lib/scene-model';

const plan = {
  title: 'Orange reference coupe', summary: 'Contoured editable coupe.', warnings: ['Unseen details are estimated.'],
  parts: [{ key: 'car', parentKey: null, kind: 'vehicle', vehicleStyle: 'muscle-coupe',
    name: 'Orange coupe', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 },
    size: { x: 2.14, y: 1.44, z: 4.88 }, color: '#efa90f', trimColor: '#111318', racingStripes: true }],
};

test('vehicle instruction creates one coherent persisted coupe without touching existing objects', () => {
  const existing = [createStarterCube()];
  const before = JSON.stringify(existing);
  const build = compileBuilderPlan(plan, existing, []);
  assert.equal(JSON.stringify(existing), before);
  assert.ok(isSceneGraph(build.entities));
  assert.ok(isSceneGraph(JSON.parse(JSON.stringify(build.entities))), 'All surfaces survive project serialization');
  assert.equal(build.entities.filter(e => getPrimitive(e)?.shape === 'coupe-body').length, 1);
  assert.equal(build.entities.filter(e => e.name.endsWith(' tire')).length, 4);
  assert.equal(build.entities.filter(e => e.name.includes('alloy spoke')).length, 40);
  assert.equal(build.entities.filter(e => e.name.startsWith('Hood stripe')).length, 2);
  assert.ok(build.entities.length < 300, 'One vehicle has a bounded editor footprint');
  const car = build.entities.find(e => e.name === 'Orange coupe')!;
  const origin = getWorldTransform(build.entities, car.id)!.position;
  for (const entity of build.entities.filter(e => e.name.endsWith(' tire'))) {
    const world = getWorldTransform(build.entities, entity.id)!;
    assert.ok(Math.abs(Math.abs((world.position.x - origin.x) / 10) - .89) < .001);
    assert.ok(Math.abs(Math.abs((world.position.y - origin.y) / 10) - 1.43) < .001);
    assert.ok(Math.abs((world.position.z - origin.z) / 10 - .39) < .001);
  }
  const noStripes = compileBuilderPlan({ ...plan, parts: [{ ...plan.parts[0], racingStripes: false }] }, [], []);
  assert.equal(noStripes.entities.filter(e => e.name.startsWith('Hood stripe')).length, 0);
  assert.throws(() => compileBuilderPlan({ ...plan, parts: [{ ...plan.parts[0], vehicleStyle: undefined }] }, [], []), /supported vehicle/);
});

test('contoured surfaces are finite and body arches leave physical openings around both axles', () => {
  for (const shape of ['coupe-body', 'coupe-glazing', 'coupe-grille'] as const) {
    const geometry = createPrimitiveGeometry(shape);
    assert.ok(geometry.getAttribute('position').count > 20);
    for (const value of geometry.getAttribute('position').array) assert.ok(Number.isFinite(value));
    geometry.computeBoundingBox();
    const size = geometry.boundingBox!.getSize(new THREE.Vector3());
    for (const dimension of size.toArray()) assert.ok(Math.abs(dimension - 1) < .002);
    geometry.dispose();
  }
  const geometry = createPrimitiveGeometry('coupe-body');
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.position.set(0, .625, 0);
  mesh.scale.set(1.92, .76, 4.8);
  mesh.updateMatrixWorld();
  const ray = new THREE.Raycaster();
  for (const z of [-1.43, 1.43]) {
    ray.set(new THREE.Vector3(-3, .5, z), new THREE.Vector3(1, 0, 0));
    assert.equal(ray.intersectObject(mesh).length, 0, 'Wheels are not buried in an opaque body block');
  }
  ray.set(new THREE.Vector3(-3, .5, 0), new THREE.Vector3(1, 0, 0));
  assert.ok(ray.intersectObject(mesh).length > 0, 'Door region remains a solid contoured body');
  geometry.dispose();
  mesh.material.dispose();
});

test('old primitive drafts still compile and vehicle rotations/dimensions are honored', () => {
  const rotated = compileBuilderPlan({ ...plan, parts: [{ ...plan.parts[0],
    rotation: { x: 0, y: 30, z: 0 }, size: { x: 2.14, y: 1.44, z: 5.368 } }] }, [], []);
  const transform = getTransform(rotated.entities.find(e => e.name === 'Orange coupe')!);
  assert.equal(transform.rotation.z, -30);
  assert.ok(Math.abs(transform.scale.y - 1.1) < .0001);
  const legacy = { ...plan, parts: [{ ...plan.parts[0], kind: 'box', shape: 'rounded-cube' }] };
  assert.equal(compileBuilderPlan(legacy, [], []).entities.length, 2);
});
