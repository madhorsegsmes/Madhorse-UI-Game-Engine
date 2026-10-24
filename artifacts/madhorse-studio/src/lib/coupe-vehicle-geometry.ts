import * as THREE from 'three';
import type { BuilderPart } from '@workspace/api-client-react';
import { createSceneEntity, getPhysicsComponent, getTransform, type PrimitiveShape, type SceneEntity } from './scene-model';

export const COUPE_DIMENSIONS = { x: 2.14, y: 1.44, z: 4.88 };
type Triple = [number, number, number];

/** A bounded vehicle tool, not AI-generated mesh/code. All surfaces and fittings
 * remain separate, named editor objects with ordinary saved transforms. */
export function createCoupeVehicleGeometry(parentId: string, specification: BuilderPart) {
  const entities: SceneEntity[] = [];
  const paint = specification.color;
  const trim = specification.trimColor ?? '#111318';
  const metal = '#89929e';
  const group = (name: string) => {
    const entity = createSceneEntity(name, { x: 50, y: 50, z: 50 }, parentId, false);
    entity.isGroup = true;
    getPhysicsComponent(entity)!.enabled = false;
    entities.push(entity);
    return entity.id;
  };
  const add = (parent: string, name: string, shape: PrimitiveShape, at: Triple, size: Triple,
    color: string, rotation: Triple = [0, 0, 0], roughness = .28, metalness = .45) => {
    const entity = createSceneEntity(name, {
      x: 50 + at[0] * 10, y: 50 + at[2] * 10, z: 50 + at[1] * 10,
    }, parent, false);
    const transform = getTransform(entity);
    transform.scale = { x: size[0], y: size[2], z: size[1] };
    transform.rotation = { x: -rotation[0], y: -rotation[2], z: -rotation[1] };
    getPhysicsComponent(entity)!.enabled = false;
    entity.components.push({ id: crypto.randomUUID(), type: 'primitive', enabled: true,
      shape, color, textureAssetId: null, roughness, metalness });
    entities.push(entity);
    return entity;
  };
  const beam = (parent: string, name: string, a: Triple, b: Triple, thickness: number, color: string) => {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion()
      .setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()), 'XYZ');
    const midpoint = start.add(end).multiplyScalar(.5);
    add(parent, name, 'rounded-cube', [midpoint.x, midpoint.y, midpoint.z],
      [thickness, direction.length(), thickness], color,
      [rotation.x, rotation.y, rotation.z].map(THREE.MathUtils.radToDeg) as Triple);
  };

  const shell = group('Body · contoured shell and wheel openings');
  add(shell, 'Contoured body with four wheel openings', 'coupe-body', [0, .625, 0], [1.92, .76, 4.8], paint);
  const cabin = group('Cabin · roof, glass and pillars');
  // Dark reflective glazing stays opaque: no bright yellow body showing through.
  add(cabin, 'Windshield, side glass and fastback glazing', 'coupe-glazing',
    [0, 1.1925, .265], [1.66, .445, 2.01], '#16212b', [0, 0, 0], .12, .35);
  add(cabin, 'Painted roof', 'rounded-cube', [0, 1.417, .275], [1.34, .045, .9], paint);
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'Left' : 'Right';
    beam(cabin, `${label} A pillar`, [side * .814, .995, -.71], [side * .65, 1.395, -.16], .047, paint);
    beam(cabin, `${label} C pillar`, [side * .675, 1.395, .64], [side * .824, .99, 1.25], .09, paint);
    beam(cabin, `${label} B pillar`, [side * .827, .98, .39], [side * .67, 1.4, .39], .038, trim);
    beam(cabin, `${label} window sill`, [side * .831, .98, -.69], [side * .831, .98, 1.24], .026, metal);
    add(shell, `${label} mirror arm`, 'rounded-cube', [side * .9, 1.012, -.55], [.2, .04, .06], trim);
    add(shell, `${label} mirror housing`, 'rounded-cube', [side * 1.0, 1.045, -.53], [.14, .085, .22], paint);
    add(shell, `${label} mirror glass`, 'rounded-cube', [side * 1.002, 1.05, -.415], [.1, .055, .012], metal);
    add(shell, `${label} door handle`, 'rounded-cube', [side * .963, .865, .55], [.025, .035, .17], paint);
    beam(shell, `${label} door rear seam`, [side * .963, .91, .78], [side * .964, .4, .78], .008, '#6b500f');
    beam(shell, `${label} door lower seam`, [side * .961, .4, -.76], [side * .961, .4, .78], .008, '#6b500f');
    add(shell, `${label} lower side skirt`, 'rounded-cube', [side * .918, .29, 0], [.075, .1, 1.94], trim);
  }
  const front = group('Front · grille, lamps and bumper');
  add(front, 'Hexagonal upper grille', 'coupe-grille', [0, .635, -2.375], [1.28, .29, .045], trim, [0, 0, 0], .65, .1);
  add(front, 'Lower intake', 'coupe-grille', [0, .345, -2.37], [1.1, .16, .055], trim);
  add(front, 'Front splitter', 'rounded-cube', [0, .25, -2.28], [1.92, .045, .3], trim);
  for (let i = -5; i <= 5; i++) {
    add(front, `Grille vertical slat ${i + 6}`, 'rounded-cube', [i * .1, .635, -2.402], [.012, .215, .012], '#303640');
  }
  for (const y of [.575, .635, .695]) {
    add(front, `Grille horizontal slat ${y}`, 'rounded-cube', [0, y, -2.408], [1.09, .012, .012], '#303640');
  }
  for (const side of [-1, 1]) {
    const label = side < 0 ? 'Left' : 'Right';
    add(front, `${label} headlamp recess`, 'rounded-cube', [side * .77, .835, -2.27], [.32, .12, .09], '#20252c');
    add(front, `${label} headlamp lens`, 'rounded-cube', [side * .79, .843, -2.321], [.25, .073, .014], '#d7e4eb', [0, 0, 0], .12, .3);
    for (let i = 0; i < 3; i++) {
      add(front, `${label} LED ${i + 1}`, 'rounded-cube', [side * (.68 + i * .063), .838, -2.335],
        [.016, .075, .014], '#eef5ff', [0, 0, -side * 14]);
    }
    add(front, `${label} bumper side intake`, 'rounded-cube', [side * .76, .4, -2.31], [.25, .16, .08], trim);
  }
  const rear = group('Rear · lamps, diffuser and exhaust');
  add(rear, 'Rear lamp surround', 'rounded-cube', [0, .79, 2.34], [1.73, .2, .045], trim);
  add(rear, 'Rear diffuser', 'rounded-cube', [0, .32, 2.32], [1.7, .15, .15], trim);
  add(rear, 'Trunk lip', 'rounded-cube', [0, .975, 2.12], [1.72, .035, .14], paint);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      add(rear, `${side < 0 ? 'Left' : 'Right'} tail lamp ${i + 1}`, 'rounded-cube',
        [side * (.48 + i * .115), .79, 2.368], [.061, .135, .018], '#b72329');
    }
    add(rear, `${side < 0 ? 'Left' : 'Right'} exhaust outlet`, 'hollow-cylinder',
      [side * .61, .27, 2.38], [.13, .18, .13], metal, [90, 0, 0], .2, .9);
  }

  for (const side of [-1, 1]) for (const [axle, z] of [['Front', -1.43], ['Rear', 1.43]] as const) {
    const label = `${side < 0 ? 'Left' : 'Right'} ${axle.toLowerCase()}`;
    const wheel = group(`${label} wheel · tire, rim and brake`);
    add(wheel, `${label} tire`, 'torus', [side * .89, .39, z], [.75, .75, .85], '#17191c', [0, 90, 0], .86, .02);
    add(wheel, `${label} sidewall`, 'cylinder', [side * .89, .39, z], [.69, .26, .69], '#17191c', [0, 0, 90], .86, .02);
    add(wheel, `${label} rim barrel`, 'cylinder', [side * 1.028, .39, z], [.54, .028, .54], '#252a31', [0, 0, 90], .24, .8);
    add(wheel, `${label} brake rotor`, 'cylinder', [side * 1.046, .39, z], [.43, .008, .43], '#6b7076', [0, 0, 90], .45, .8);
    add(wheel, `${label} rim lip`, 'torus', [side * 1.06, .39, z], [.53, .53, .06], metal, [0, 90, 0], .2, .85);
    for (let i = 0; i < 10; i++) {
      const theta = i * Math.PI / 5;
      add(wheel, `${label} alloy spoke ${i + 1}`, 'rounded-cube',
        [side * 1.064, .39 + Math.cos(theta) * .13, z + Math.sin(theta) * .13],
        [.028, .24, .023], '#535e6c', [THREE.MathUtils.radToDeg(theta), 0, 0], .2, .85);
    }
    add(wheel, `${label} hub`, 'cylinder', [side * 1.075, .39, z], [.12, .026, .12], metal, [0, 0, 90], .2, .8);
    for (let i = 0; i < 16; i++) {
      const theta = i * Math.PI / 8;
      add(wheel, `${label} tread groove ${i + 1}`, 'rounded-cube',
        [side * .89, .39 + Math.sin(theta) * .374, z + Math.cos(theta) * .374],
        [.22, .007, .028], '#25272a', [90 - THREE.MathUtils.radToDeg(theta), 0, 0], .9, 0);
    }
  }
  if (specification.racingStripes) {
    const stripes = group('Paired racing stripes');
    for (const x of [-.18, .18]) {
      add(stripes, `Hood stripe ${x < 0 ? 'left' : 'right'}`, 'rounded-cube',
        [x, .944, -1.36], [.23, .012, 1.35], trim, [-2.7, 0, 0], .35, .15);
      add(stripes, `Roof stripe ${x < 0 ? 'left' : 'right'}`, 'rounded-cube',
        [x, 1.444, .275], [.23, .008, .88], trim, [0, 0, 0], .35, .15);
      add(stripes, `Trunk stripe ${x < 0 ? 'left' : 'right'}`, 'rounded-cube',
        [x, .961, 1.7], [.23, .009, .77], trim, [1.6, 0, 0], .35, .15);
    }
  }
  return entities;
}
