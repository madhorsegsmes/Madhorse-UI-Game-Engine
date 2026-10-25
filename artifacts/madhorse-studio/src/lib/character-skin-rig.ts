import * as THREE from 'three';
import type { CharacterBodyMesh } from './character-builder-geometry';
import { fighterAttackEnvelope, type FighterPlayback } from './fighter-playback';

type Segment = { name: string; start: THREE.Vector3; end: THREE.Vector3; radius: number };
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A reusable skin palette in character-local metres, independent of scene pose. */
export function createCharacterSkinRig(body: CharacterBodyMesh) {
  const geometry = body.geometry.clone();
  geometry.scale(body.halfExtents.x, body.halfExtents.y, body.halfExtents.z);
  geometry.translate(body.center.x, body.center.y, body.center.z);
  geometry.computeBoundingBox();
  const height = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y;
  const unit = height / 1.8;
  const segments: Segment[] = [];
  const add = (name: string, start: number[], end: number[], radius: number) =>
    segments.push({ name, start: v(start[0], start[1], start[2]).multiplyScalar(unit),
      end: v(end[0], end[1], end[2]).multiplyScalar(unit), radius: radius * unit });
  add('pelvis', [0, .83, 0], [0, 1.02, 0], .2);
  add('spine', [0, 1.02, 0], [0, 1.3, 0], .19);
  add('chest', [0, 1.3, 0], [0, 1.52, 0], .24);
  add('head', [0, 1.52, 0], [0, 1.78, 0], .14);
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'left' : 'right';
    add(`${name}-arm`, [side * .25, 1.5, 0], [side * .25, 1.22, .07], .08);
    add(`${name}-forearm`, [side * .25, 1.22, .07], [side * .11, 1.42, .19], .075);
    add(`${name}-hand`, [side * .11, 1.42, .19], [side * .11, 1.45, .23], .065);
    add(`${name}-thigh`, [side * .12, .88, 0], [side * .12, .46, 0], .12);
    add(`${name}-shin`, [side * .12, .46, 0], [side * .12, .08, .015], .085);
    add(`${name}-foot`, [side * .12, .08, .015], [side * .12, .04, .14], .08);
  }
  const bones = segments.map(segment => {
    const bone = new THREE.Bone();
    bone.name = segment.name;
    bone.position.copy(segment.start);
    bone.updateMatrixWorld(true);
    return bone;
  });
  const skeleton = new THREE.Skeleton(bones);
  skeleton.calculateInverses();
  const positions = geometry.getAttribute('position');
  const uv = new Float32Array(positions.count * 2);
  const indices = new Uint16Array(positions.count * 4);
  const weights = new Float32Array(positions.count * 4);
  const point = new THREE.Vector3(), nearestPoint = new THREE.Vector3();
  const lines = segments.map(segment => new THREE.Line3(segment.start, segment.end));
  const scores = new Float64Array(segments.length);
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    uv[i * 2] = .5 + Math.atan2(point.z, point.x) / (2 * Math.PI);
    uv[i * 2 + 1] = point.y / height;
    for (let j = 0; j < segments.length; j++) {
      lines[j].closestPointToPoint(point, true, nearestPoint);
      scores[j] = point.distanceToSquared(nearestPoint) / (segments[j].radius ** 2);
      if (point.y > 1.59 * unit && j !== 3) scores[j] += 20;
    }
    const ranked = Array.from(scores, (score, index) => ({ score, index })).sort((a, b) => a.score - b.score).slice(0, 4);
    let total = 0;
    for (let j = 0; j < 4; j++) {
      indices[i * 4 + j] = ranked[j].index;
      weights[i * 4 + j] = Math.exp(-Math.min(40, (ranked[j].score - ranked[0].score) * 3));
      total += weights[i * 4 + j];
    }
    for (let j = 0; j < 4; j++) weights[i * 4 + j] /= total;
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const matrices = bones.map(() => new THREE.Matrix4());
  const byName = new Map(segments.map((segment, index) => [segment.name, index]));
  const q = new THREE.Quaternion(), a = new THREE.Vector3(), b = new THREE.Vector3();
  function set(name: string, start: THREE.Vector3, end: THREE.Vector3) {
    const index = byName.get(name)!;
    const segment = segments[index];
    bones[index].position.copy(start);
    a.subVectors(segment.end, segment.start).normalize();
    b.subVectors(end, start).normalize();
    bones[index].quaternion.copy(q.setFromUnitVectors(a, b));
  }
  function solve(start: THREE.Vector3, middle: THREE.Vector3, end: THREE.Vector3, target: THREE.Vector3, bend: THREE.Vector3) {
    const upper = start.distanceTo(middle), lower = middle.distanceTo(end);
    const direction = target.clone().sub(start);
    const distance = THREE.MathUtils.clamp(direction.length(), Math.abs(upper - lower) + .001, upper + lower - .001);
    direction.normalize();
    const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
    const across = Math.sqrt(Math.max(0, upper * upper - along * along));
    const bendDirection = bend.clone().addScaledVector(direction, -bend.dot(direction)).normalize();
    return {
      middle: start.clone().addScaledVector(direction, along).addScaledVector(bendDirection, across),
      end: start.clone().addScaledVector(direction, distance),
    };
  }
  function update(pose: FighterPlayback | undefined, time: number) {
    if (!pose) {
      for (let i = 0; i < bones.length; i++) {
        bones[i].position.copy(segments[i].start);
        bones[i].quaternion.identity();
        bones[i].updateMatrixWorld(true);
        matrices[i].identity();
      }
      skeleton.update();
      return;
    }
    const amount = fighterAttackEnvelope(pose?.attack, time);
    const kind = pose?.attack?.kind;
    const age = pose?.hitAt === undefined ? 100 : time - pose.hitAt;
    const recoil = age >= 0 && age < .32 ? Math.sin(age * 28) * Math.exp(-age * 10) : 0;
    const stride = pose?.moving ? Math.sin(time * 11) : 0;
    const breathing = Math.sin(time * 3.3) * .004;
    const offset = v(stride * .008, breathing + Math.abs(stride) * .012,
      amount * .025 - recoil * .075).multiplyScalar(unit);
    for (let i = 0; i < 4; i++) {
      set(segments[i].name, segments[i].start.clone().add(offset), segments[i].end.clone().add(offset));
    }
    for (const side of [-1, 1]) {
      const name = side < 0 ? 'left' : 'right';
      const upper = segments[byName.get(`${name}-arm`)!];
      const fore = segments[byName.get(`${name}-forearm`)!];
      const hand = segments[byName.get(`${name}-hand`)!];
      const shoulder = upper.start.clone().add(offset);
      const wrist = fore.end.clone().add(offset);
      if(pose.basketball){
        const sports=pose.basketball;
        wrist.copy(v(side*.23,1.05+stride*side*.08,.16).multiplyScalar(unit).add(offset));
        if(sports.dribble&&side===1)wrist.copy(v(.34,.92+Math.abs(Math.sin(time*10))*.25,.14).multiplyScalar(unit).add(offset));
        wrist.lerp(v(side*.13,1.88,.27).multiplyScalar(unit).add(offset),sports.shoot);
        wrist.lerp(v(side*.18,1.38,.49).multiplyScalar(unit).add(offset),sports.passing);
      }
      if (pose?.blocking) wrist.add(v(side * .025, .13, -.01).multiplyScalar(unit));
      const strike = kind === 'light-attack' && side === -1 || kind === 'heavy-attack' && side === 1;
      if (strike) wrist.lerp(v(side * .2, 1.43, .53).multiplyScalar(unit).add(offset), amount);
      const arm = solve(shoulder, upper.end.clone().add(offset), fore.end.clone().add(offset), wrist, v(side * .12, -1, .12));
      set(`${name}-arm`, shoulder, arm.middle);
      set(`${name}-forearm`, arm.middle, arm.end);
      set(`${name}-hand`, arm.end, arm.end.clone().add(hand.end.clone().sub(hand.start).lerp(v(0, 0, .07).multiplyScalar(unit), strike ? amount : 0)));
      const thigh = segments[byName.get(`${name}-thigh`)!];
      const shin = segments[byName.get(`${name}-shin`)!];
      const foot = segments[byName.get(`${name}-foot`)!];
      const hip = thigh.start.clone().add(offset);
      const ankle = shin.end.clone().add(v(0, Math.max(0, stride * side) * .07, stride * side * .16).multiplyScalar(unit));
      if (kind === 'special-attack' && side === 1) ankle.lerp(v(side * .14, 1.04, .58).multiplyScalar(unit), amount);
      const leg = solve(hip, thigh.end, shin.end, ankle, v(0, .1, 1));
      set(`${name}-thigh`, hip, leg.middle);
      set(`${name}-shin`, leg.middle, leg.end);
      set(`${name}-foot`, leg.end, leg.end.clone().add(foot.end.clone().sub(foot.start)));
    }
    for (let i = 0; i < bones.length; i++) {
      if (pose.defeated) {
        const fall = THREE.MathUtils.clamp((time - (pose.hitAt ?? time)) / .45, 0, 1);
        const rotation = q.setFromAxisAngle(v(1, 0, 0), -fall * 1.35);
        bones[i].position.applyQuaternion(rotation).y += .13 * fall;
        bones[i].quaternion.premultiply(rotation);
      }
      bones[i].updateMatrixWorld(true);
      matrices[i].multiplyMatrices(bones[i].matrixWorld, skeleton.boneInverses[i]);
    }
    skeleton.update();
  }
  function nearestBone(point: THREE.Vector3) {
    let best = 0, distance = Infinity;
    for (let i = 0; i < segments.length; i++) {
      lines[i].closestPointToPoint(point, true, nearestPoint);
      const value = point.distanceToSquared(nearestPoint) / segments[i].radius ** 2;
      if (value < distance) { distance = value; best = i; }
    }
    return best;
  }
  return { geometry, skeleton, matrices, nearestBone, update, dispose() { geometry.dispose(); skeleton.dispose(); } };
}
