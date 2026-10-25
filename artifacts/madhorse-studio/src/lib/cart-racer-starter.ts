import { createSceneEntity, createPhysicsComponent, getTransform, type SceneEntity, type Vector3, type ProjectAsset, type PrimitiveShape } from './scene-model';
import { createPluginComponent } from './scene-plugin-catalog';
import { createGameFeature } from './game-feature-model';
import { createPlayerAction } from './player-action-model';

export const CART_RACER_CONTROLS = 'W/Up: accelerate · S/Down: brake / reverse · A/D or Left/Right: steer · Esc: stop test. Driving is ready automatically. Drive 3 laps through the North, West, South and Finish arches in order. Stop and replay to reset.';

// Oval layout in WORLD metres (x = east, z = north). Legacy storage: x*10, z→legacy y*10, height→legacy z*10.
const RX = 26;
const RZ = 18;
const ROAD_WIDTH = 8;
const SLABS = 68;

export function createCartRacerStarter(center: Vector3): {
  entities: SceneEntity[]; playerId: string; title: 'Cart Racer Stylized';
  generatedAssets?: Array<{ asset: ProjectAsset; file: File }>;
} {
  const entities: SceneEntity[] = [];
  const generatedAssets: Array<{ asset: ProjectAsset; file: File }> = [];
  function texture(name: string, svg: string) {
    const file = new File([svg], name, { type: 'image/svg+xml' });
    const asset: ProjectAsset = { id: crypto.randomUUID(), name, kind: 'image', mimeType: file.type, size: file.size, addedAt: new Date().toISOString() };
    generatedAssets.push({ asset, file });
    return asset.id;
  }
  const checker = texture('cart-checker.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#fdf6ec"/><g fill="#22314a"><rect width="64" height="64"/><rect x="128" width="64" height="64"/><rect x="64" y="64" width="64" height="64"/><rect x="192" y="64" width="64" height="64"/><rect y="128" width="64" height="64"/><rect x="128" y="128" width="64" height="64"/><rect x="64" y="192" width="64" height="64"/><rect x="192" y="192" width="64" height="64"/></g></svg>');
  const candy = texture('cart-candy-stripe.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="64"><rect width="256" height="64" fill="#fff4f0"/><g fill="#ff5d73"><rect width="32" height="64"/><rect x="64" width="32" height="64"/><rect x="128" width="32" height="64"/><rect x="192" width="32" height="64"/></g></svg>');
  const banner = texture('cart-banner.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="128"><rect width="512" height="128" rx="20" fill="#ffd45c"/><rect x="10" y="10" width="492" height="108" rx="14" fill="none" stroke="#22314a" stroke-width="6"/><text x="256" y="84" font-family="Verdana,sans-serif" font-weight="900" font-size="58" text-anchor="middle" fill="#22314a">PEPPERMINT GP</text></svg>');
  const asphalt = texture('cart-asphalt.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#5d6b86"/><g fill="#6c7a96" opacity=".7"><circle cx="20" cy="30" r="3"/><circle cx="90" cy="18" r="2"/><circle cx="60" cy="80" r="3"/><circle cx="110" cy="100" r="2"/><circle cx="30" cy="110" r="2"/></g></svg>');

  const pos = (x: number, z: number, h: number) => ({ x: center.x + x * 10, y: center.y + z * 10, z: center.z + h * 10 });
  /** Top-level visual/solid part. x,z,h are world metres; w,d,t are world-metre sizes. */
  function part(name: string, shape: PrimitiveShape, x: number, z: number, h: number, w: number, d: number, t: number, color: string,
    opts: { yaw?: number; tilt?: Vector3; solid?: boolean; tex?: string | null; rough?: number; metal?: number; parent?: SceneEntity } = {}) {
    const entity = createSceneEntity(name, opts.parent ? { x: 50 + x * 10, y: 50 + z * 10, z: 50 + h * 10 } : pos(x, z, h), opts.parent?.id ?? null, false);
    const tr = getTransform(entity);
    entity.components = [tr];
    tr.scale = { x: w, y: d, z: t };
    tr.rotation = { x: opts.tilt?.x ?? 0, y: opts.tilt?.y ?? 0, z: opts.yaw ?? 0 };
    entity.components.push({ id: crypto.randomUUID(), type: 'primitive', enabled: true, shape, color, textureAssetId: opts.tex ?? null, roughness: opts.rough ?? .42, metalness: opts.metal ?? .06 });
    if (opts.solid) {
      const physics = createPhysicsComponent('static');
      physics.size = { x: w * 10, y: d * 10, z: t * 10 };
      entity.components.push(physics);
    }
    entities.push(entity);
    return entity;
  }
  function group(name: string, x: number, z: number, yaw = 0) {
    const g = createSceneEntity(name, pos(x, z, 0), null, false);
    g.components = [getTransform(g)];
    getTransform(g).rotation.z = yaw;
    g.isGroup = true;
    entities.push(g);
    return g;
  }
  // Yaw (deg) that points local +Y (world +Z) along direction (dx, dz).
  const yawOf = (dx: number, dz: number) => Math.atan2(-dx, dz) * 180 / Math.PI;
  const onOval = (a: number, rOff = 0) => {
    const cx = Math.cos(a), sz = Math.sin(a);
    const tx = -RX * sz, tz = RZ * cx;
    const len = Math.hypot(tx, tz);
    const nx = tz / len, nz = -tx / len; // outward normal
    return { x: RX * cx + nx * rOff, z: RZ * sz + nz * rOff, tx: tx / len, tz: tz / len, nx, nz, speed: len };
  };

  // Lighting & sky
  const sky = createSceneEntity('Sky · pastel dome', pos(0, 0, 40), null, false);
  sky.components = [getTransform(sky), { id: crypto.randomUUID(), type: 'skybox', enabled: true, color: '#bfe6ff' }];
  const ambient = createSceneEntity('Ambient light · warm fill', pos(0, 0, 20), null, false);
  ambient.components = [getTransform(ambient), { id: crypto.randomUUID(), type: 'light', enabled: true, kind: 'ambient', color: '#fff1e2', intensity: 1.1 }];
  const sun = createSceneEntity('Sun · late morning', pos(-30, -24, 40), null, false);
  sun.components = [getTransform(sun), { id: crypto.randomUUID(), type: 'light', enabled: true, kind: 'directional', color: '#fff6d8', intensity: 2.4 }];
  entities.push(sky, ambient, sun);

  // Ground (visual only, no collision — runtime floor carries the kart)
  part('Meadow · editable ground', 'cube', 0, 0, -.12, 96, 76, .2, '#9fe3a8', { rough: .9 });
  part('Infield lawn', 'cylinder', 0, 0, -.015, 36, 22, .02, '#b8efb0', { rough: .85 });

  // Road: overlapping tangent slabs
  const roadGroup = group('Track · road slabs', 0, 0);
  for (let i = 0; i < SLABS; i++) {
    const a = (i / SLABS) * Math.PI * 2;
    const p = onOval(a);
    const len = (p.speed * Math.PI * 2) / SLABS * 1.35;
    part(`Road slab · ${i + 1}`, 'cube', p.x, p.z, .02, ROAD_WIDTH, len, .06, '#5d6b86', { yaw: yawOf(p.tx, p.tz), tex: asphalt, rough: .78, parent: roadGroup });
    if (i % 2 === 0) {
      part(`Centre dash · ${i / 2 + 1}`, 'cube', p.x, p.z, .06, .22, len * .55, .02, '#fff8e8', { yaw: yawOf(p.tx, p.tz), rough: .6, parent: roadGroup });
    }
    for (const side of [-1, 1]) {
      const e = onOval(a, side * (ROAD_WIDTH / 2 + .35));
      part(`${side > 0 ? 'Outer' : 'Inner'} candy curb · ${i + 1}`, 'cube', e.x, e.z, .1, .7, len * 1.02, .18, i % 2 ? '#ff5d73' : '#fff4f0',
        { yaw: yawOf(e.tx, e.tz), rough: .35, parent: roadGroup });
    }
  }

  // Perimeter barriers (solid, low). Leaves a corridor of ~ road + curb width.
  const BARRIERS = 40;
  const barrierGroup = group('Track · barriers', 0, 0);
  for (let i = 0; i < BARRIERS; i++) {
    const a = (i / BARRIERS) * Math.PI * 2;
    for (const side of [-1, 1]) {
      const off = side * (ROAD_WIDTH / 2 + 1.6);
      const e = onOval(a, off);
      const r = side > 0 ? 1 + off / Math.min(RX, RZ) : 1 + off / Math.max(RX, RZ);
      const len = (e.speed * Math.PI * 2) / BARRIERS * Math.max(.4, r) * 1.12;
      part(`${side > 0 ? 'Outer' : 'Inner'} barrier · ${i + 1}`, 'rounded-cube', e.x, e.z, .45, .6, len, .9,
        side > 0 ? (i % 2 ? '#5fd3e4' : '#f8f3ff') : (i % 2 ? '#ffb4c8' : '#f8f3ff'),
        { yaw: yawOf(e.tx, e.tz), solid: true, tex: side > 0 && i % 4 === 0 ? candy : null, rough: .3, parent: barrierGroup });
    }
  }

  // Race gates (no physics) — feature dims in WORLD metres
  const gates: Array<[string, number, number, number]> = [
    ['North', 0, RZ, 90], ['West', -RX, 0, 180], ['South', 0, -RZ, -90], ['Finish', RX, 0, 0],
  ];
  gates.forEach(([label, x, z, yaw], index) => {
    const g = group(`Gate ${index} · ${label}${index === 3 ? ' line' : ' checkpoint'}`, x, z, yaw);
    const feature = createGameFeature('cart-racer');
    feature.settings = { ...feature.settings, role: 'gate', gateIndex: index, gateWidth: 10, gateDepth: 4 };
    g.components.push(feature);
    const finish = index === 3;
    const accent = finish ? '#ffd45c' : ['#7fd8ff', '#c9a7ff', '#ff9fc0'][index];
    // Local frame: local +Y is the gate's facing; local X spans the road. Gate yaw of 0 has the road along +Z, so posts sit on ±X.
    for (const s of [-1, 1]) {
      part(`${label} arch post · ${s < 0 ? 'L' : 'R'}`, 'cylinder', s * 5.6, 0, 2.2, .5, .5, 4.4, '#f8f3ff', { rough: .3, parent: g });
      part(`${label} post cap · ${s < 0 ? 'L' : 'R'}`, 'sphere', s * 5.6, 0, 4.55, .9, .9, .9, accent, { rough: .25, parent: g });
    }
    part(`${label} arch beam`, 'rounded-cube', 0, 0, 4.4, 11.6, .6, .9, accent, { rough: .3, parent: g });
    if (finish) {
      part('Finish banner', 'cube', 0, -.32, 4.4, 9, .04, .8, '#fffaf0', { tex: banner, rough: .5, parent: g });
      part('Finish checkered stripe', 'cube', 0, 0, .055, ROAD_WIDTH, 1.4, .02, '#fffaf0', { tex: checker, rough: .55, parent: g });
      part('Start grid line', 'cube', 0, -3.5, .055, ROAD_WIDTH, .25, .02, '#fffaf0', { rough: .6, parent: g });
    } else {
      part(`${label} pennant`, 'triangular-prism', 0, 0, 3.3, 1.4, .08, 1, '#fffaf0', { rough: .5, parent: g });
    }
  });

  // Banners along the outside
  for (const [i, a] of [.4, 1.2, 2.2, 3.6, 4.4, 5.4].entries()) {
    const e = onOval(a, ROAD_WIDTH / 2 + 3.4);
    const g = group(`Trackside banner · ${i + 1}`, e.x, e.z, yawOf(e.tx, e.tz) + 90);
    for (const s of [-1, 1]) part(`Banner pole · ${i + 1}${s < 0 ? 'a' : 'b'}`, 'cylinder', s * 2.4, 0, 1.3, .16, .16, 2.6, '#f8f3ff', { parent: g });
    part(`Banner cloth · ${i + 1}`, 'cube', 0, 0, 2.1, 4.8, .06, 1.1, '#ffd45c', { tex: banner, rough: .6, parent: g });
  }

  // Scenery: rounded hills + lollipop trees
  for (const [i, [x, z, r, c]] of ([
    [-42, 30, 9, '#8fd9a0'], [40, 32, 11, '#a6e3c2'], [-44, -28, 10, '#9bdcb6'], [44, -30, 8, '#b4e6a0'], [0, 34, 7, '#a7e0c8'],
  ] as const).entries()) part(`Rounded hill · ${i + 1}`, 'sphere', x, z, -r * .35, r * 2, r * 2, r * 1.3, c, { rough: .85 });
  const treeColors = ['#ff9fc0', '#7fd8ff', '#ffd45c', '#c9a7ff', '#8be0a0'];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + .2;
    const outside = i % 3 !== 0;
    const e = onOval(a, outside ? ROAD_WIDTH / 2 + 7 + (i % 2) * 3 : -(ROAD_WIDTH / 2 + 5));
    const t = group(`Lollipop tree · ${i + 1}`, e.x, e.z);
    part(`Tree trunk · ${i + 1}`, 'cylinder', 0, 0, 1, .35, .35, 2, '#f1d3b0', { rough: .7, parent: t });
    part(`Tree crown · ${i + 1}`, 'sphere', 0, 0, 2.8, 2.4, 2.4, 2.4, treeColors[i % treeColors.length], { rough: .4, parent: t });
  }

  // Player kart: root at east side (x26, z3), facing +Z (yaw 0)
  const kart = createSceneEntity('Turquoise Kart · Player', pos(RX, 3, .55), null, false);
  const kt = getTransform(kart);
  kart.components = [kt];
  kart.isGroup = true;
  kart.components.push({ id: crypto.randomUUID(), type: 'primitive', enabled: false, shape: 'rounded-cube', color: '#2ec4c9', textureAssetId: null, roughness: .3, metalness: .2 });
  const controller = createPluginComponent('character-controller-player', 0).component;
  if (controller.type === 'characterController') { controller.enabled = true; controller.perspective = 'third-person'; controller.moveSpeed = 8; controller.jumpHeight = 0; }
  const body = createPhysicsComponent('dynamic');
  body.size = { x: 16, y: 24, z: 10 }; // 1.6m wide × 2.4m long × 1m tall
  body.mass = 4; body.friction = .3;
  const race = createPlayerAction('race');
  race.enabled = true;
  race.settings.acceleration = 6; race.settings.maxSpeed = 14; race.settings.turnSpeed = 103;
  const feature = createGameFeature('cart-racer');
  feature.settings = { ...feature.settings, role: 'player', startDriving: true, laps: 3 };
  kart.components.push(controller, body, race, feature);
  entities.push(kart);
  // Cylinders are upright (axis = height) by default; wheels use y:90 to lie on the X axle.
  // Kart parts: local metres relative to the root (root scale 1, so offsets are world metres).
  const k = (name: string, shape: PrimitiveShape, x: number, z: number, h: number, w: number, d: number, t: number, color: string, tilt?: Vector3, rough = .28, metal = .1) =>
    part(`Kart · ${name}`, shape, x, z, h, w, d, t, color, { parent: kart, tilt, rough, metal });
  k('chassis tray', 'rounded-cube', 0, 0, -.18, 1.3, 2.2, .14, '#22314a', undefined, .5, .4);
  k('body tub', 'rounded-cube', 0, -.05, .05, 1.1, 1.6, .34, '#2ec4c9');
  k('nose cone', 'wedge', 0, .95, 0, 1.0, .7, .3, '#1f7fe0');
  k('front bumper', 'rounded-cube', 0, 1.25, -.12, 1.4, .18, .16, '#ffd45c');
  k('rear bumper', 'rounded-cube', 0, -1.15, -.08, 1.4, .18, .22, '#ffd45c');
  for (const s of [-1, 1]) k(`side pod ${s < 0 ? 'L' : 'R'}`, 'rounded-cube', s * .6, -.1, -.02, .22, 1.2, .26, '#1f7fe0');
  k('number plate', 'rounded-cube', 0, 1.0, .2, .5, .05, .26, '#fffaf0');
  k('seat back', 'rounded-cube', 0, -.55, .35, .6, .14, .55, '#ff5d73', undefined, .55);
  k('seat base', 'rounded-cube', 0, -.35, .1, .6, .45, .12, '#ff5d73', undefined, .55);
  k('steering column', 'cylinder', 0, .45, .3, .06, .06, .4, '#22314a', { x: 40, y: 0, z: 0 }, .4, .6);
  k('steering wheel', 'torus', 0, .3, .5, .34, .34, .08, '#22314a', { x: 50, y: 0, z: 0 }, .4, .3);
  k('engine block', 'rounded-cube', 0, -.95, .12, .5, .35, .3, '#c9d3e0', undefined, .25, .7);
  k('exhaust pipe', 'cylinder', .22, -1.2, .25, .1, .1, .25, '#c9d3e0', { x: 90, y: 0, z: 0 }, .2, .8);
  k('rear spoiler', 'rounded-cube', 0, -1.15, .6, 1.2, .2, .06, '#ffd45c');
  for (const s of [-1, 1]) k(`spoiler strut ${s < 0 ? 'L' : 'R'}`, 'cube', s * .4, -1.15, .42, .06, .08, .32, '#22314a');
  for (const [lbl, z] of [['front', .75], ['rear', -.75]] as const) {
    for (const s of [-1, 1]) {
      const wx = s * .78;
      const big = lbl === 'rear' ? 1.1 : 1;
      k(`${lbl} tire ${s < 0 ? 'L' : 'R'}`, 'cylinder', wx, z, -.2, .55 * big, .55 * big, .32, '#2a2d3a', { x: 0, y: 90, z: 0 }, .85, 0);
      k(`${lbl} hub ${s < 0 ? 'L' : 'R'}`, 'cylinder', wx + s * .17, z, -.2, .28, .28, .04, '#fffaf0', { x: 0, y: 90, z: 0 }, .2, .6);
    }
    k(`${lbl} axle`, 'cylinder', 0, z, -.2, .08, .08, 1.5, '#22314a', { x: 0, y: 90, z: 0 }, .4, .6);
  }
  // Driver
  k('driver torso', 'capsule', 0, -.35, .55, .5, .4, .6, '#ff9fc0', undefined, .6);
  for (const s of [-1, 1]) k(`driver arm ${s < 0 ? 'L' : 'R'}`, 'capsule', s * .22, 0, .55, .14, .14, .5, '#ff9fc0', { x: 60, y: 0, z: 0 }, .6);
  k('driver helmet', 'sphere', 0, -.3, 1.05, .5, .5, .5, '#fffaf0', undefined, .15, .2);
  k('helmet stripe', 'torus', 0, -.3, 1.05, .5, .5, .1, '#2ec4c9', { x: 0, y: 90, z: 0 }, .2);
  k('helmet visor', 'rounded-cube', 0, -.08, 1.05, .34, .06, .14, '#22314a', undefined, .1, .5);

  return { entities, playerId: kart.id, title: 'Cart Racer Stylized', generatedAssets };
}
