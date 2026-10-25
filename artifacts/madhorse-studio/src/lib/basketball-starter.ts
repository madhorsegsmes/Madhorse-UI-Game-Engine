import { createSceneEntity, getTransform, type SceneEntity, type Vector3, type ProjectAsset, type PrimitiveShape, type SceneComponent } from './scene-model';
import { createGameFeature } from './game-feature-model';
import { createEgoCharacterScene } from './character-builder-starter';

/**
 * Original 3v3 half-arcade basketball starter: Metro Comets (home, blue/gold) vs Harbor Waves (away, teal/coral).
 * World metres: x = east, z = north (court length axis), h = height.
 * Legacy storage: x*10, z -> legacy y*10, height -> legacy z*10.
 */
const COURT_W = 15;
const COURT_L = 28;
const RIM_H = 3.05;
const HOOP_Z = 12;

type Generated = Array<{ asset: ProjectAsset; file: File }>;
type Settings = Record<string, string | number | boolean>;

const HOME = { name: 'Metro Comets', jersey: '#1f4fb8', trim: '#f2b632', ink: '#f7f1df', shoe: '#f2b632' };
const AWAY = { name: 'Harbor Waves', jersey: '#f4efe2', trim: '#127a86', ink: '#127a86', shoe: '#e0634a' };
const SKIN = ['#8a5a3c', '#c99070', '#5e3b28', '#d6a17f', '#a8714f', '#6f4630'];
const HAIR = ['#1d1612', '#302820', '#120e0c', '#5b3a22', '#1a1411', '#24201c'];

function svgCourt() {
  const s = 20; // px per metre
  const W = COURT_W * s, L = COURT_L * s;
  const line = 'fill="none" stroke="#fbf6ea" stroke-width="2.6"';
  const planks: string[] = [];
  for (let i = 0; i < W; i += 9) {
    const tone = ['#c98f4f', '#d39a58', '#c48749', '#cf9553'][(i / 9) % 4 | 0];
    planks.push(`<rect x="${i}" y="0" width="9" height="${L}" fill="${tone}"/>`);
    for (let j = ((i * 37) % 110); j < L; j += 110) planks.push(`<rect x="${i}" y="${j}" width="9" height="1" fill="#9f6b38" opacity=".55"/>`);
  }
  const key = (top: boolean) => {
    const by = top ? 0 : L;
    const dir = top ? 1 : -1;
    const kw = 4.9 * s, kd = 5.8 * s;
    const ky = top ? 0 : L - kd;
    const bx = W / 2, basketY = by + dir * 1.575 * s;
    const r3 = 6.75 * s, cornerX = 0.9 * s;
    const dy = Math.sqrt(r3 * r3 - (bx - cornerX) ** 2);
    const arcY = basketY + dir * dy;
    return `<rect x="${bx - kw / 2}" y="${ky}" width="${kw}" height="${kd}" fill="#1f4fb8" opacity=".86"/>
<rect x="${bx - kw / 2}" y="${ky}" width="${kw}" height="${kd}" ${line}/>
<circle cx="${bx}" cy="${by + dir * kd}" r="${1.8 * s}" ${line}/>
<path d="M${cornerX} ${by} L${cornerX} ${arcY} A${r3} ${r3} 0 0 ${top ? 0 : 1} ${W - cornerX} ${arcY} L${W - cornerX} ${by}" ${line}/>
<path d="M${bx - 1.25 * s} ${basketY} A${1.25 * s} ${1.25 * s} 0 0 ${top ? 0 : 1} ${bx + 1.25 * s} ${basketY}" ${line}/>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${L}" viewBox="0 0 ${W} ${L}">
${planks.join('')}
<rect x="1.5" y="1.5" width="${W - 3}" height="${L - 3}" ${line}/>
<line x1="0" y1="${L / 2}" x2="${W}" y2="${L / 2}" stroke="#fbf6ea" stroke-width="2.6"/>
<circle cx="${W / 2}" cy="${L / 2}" r="${1.8 * s}" fill="#f2b632" opacity=".9"/>
<circle cx="${W / 2}" cy="${L / 2}" r="${1.8 * s}" ${line}/>
<text x="${W / 2}" y="${L / 2 + 9}" font-family="Verdana,sans-serif" font-weight="900" font-size="24" text-anchor="middle" fill="#1f4fb8">MC</text>
${key(true)}${key(false)}
</svg>`;
}

function svgJersey(team: typeof HOME, num: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
<defs><pattern id="mesh" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1" fill="#000" opacity=".09"/></pattern></defs>
<rect width="256" height="256" fill="${team.jersey}"/><rect width="256" height="256" fill="url(#mesh)"/>
<rect x="0" y="0" width="22" height="256" fill="${team.trim}"/><rect x="234" y="0" width="22" height="256" fill="${team.trim}"/>
<path d="M88 0 Q128 46 168 0" fill="none" stroke="${team.trim}" stroke-width="12"/>
<text x="128" y="64" font-family="Verdana,sans-serif" font-weight="900" font-size="20" text-anchor="middle" fill="${team.ink}">${team.name.split(' ')[1].toUpperCase()}</text>
<text x="128" y="180" font-family="Verdana,sans-serif" font-weight="900" font-size="104" text-anchor="middle" fill="${team.ink}" stroke="${team.trim}" stroke-width="4">${num}</text>
</svg>`;
}

const BALL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="256">
<defs><pattern id="pebble" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.3" fill="#8f3f12" opacity=".35"/></pattern></defs>
<rect width="512" height="256" fill="#d96a26"/><rect width="512" height="256" fill="url(#pebble)"/>
<g fill="none" stroke="#2a1608" stroke-width="5"><line x1="0" y1="128" x2="512" y2="128"/><line x1="128" y1="0" x2="128" y2="256"/><line x1="384" y1="0" x2="384" y2="256"/>
<path d="M60 0 Q128 128 60 256"/><path d="M196 0 Q128 128 196 256"/><path d="M316 0 Q384 128 316 256"/><path d="M452 0 Q384 128 452 256"/></g></svg>`;

const BOARD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="210"><rect width="360" height="210" fill="#dfeef2"/>
<rect x="6" y="6" width="348" height="198" fill="none" stroke="#f4efe2" stroke-width="10"/>
<rect x="132" y="104" width="96" height="70" fill="none" stroke="#f4efe2" stroke-width="8"/></svg>`;

const NET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#e9eef0" opacity=".15"/>
<g stroke="#fbfcfd" stroke-width="3" fill="none"><path d="M0 0 L128 128M32 0 L128 96M64 0 L128 64M96 0 L128 32M0 32 L96 128M0 64 L64 128M0 96 L32 128"/>
<path d="M128 0 L0 128M96 0 L0 96M64 0 L0 64M32 0 L0 32M128 32 L32 128M128 64 L64 128M128 96 L96 128"/></g></svg>`;

function svgCrowd(seed: number) {
  const dots: string[] = [];
  const palette = ['#1f4fb8', '#f2b632', '#127a86', '#e0634a', '#f4efe2', '#2a2f45', '#8a5a3c', '#d6a17f'];
  let r = seed;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 32; col++) {
      const x = col * 16 + 8 + (row % 2) * 4, y = row * 16 + 10;
      dots.push(`<rect x="${x - 5}" y="${y}" width="10" height="7" rx="3" fill="${palette[(rnd() * 6) | 0]}"/><circle cx="${x}" cy="${y - 2}" r="3.4" fill="${palette[6 + ((rnd() * 2) | 0)]}"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="128"><rect width="512" height="128" fill="#262a3d"/>${dots.join('')}</svg>`;
}

const BANNER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="96"><rect width="512" height="96" fill="#1f4fb8"/>
<rect x="0" y="0" width="256" height="96" fill="#127a86"/><text x="128" y="62" font-family="Verdana,sans-serif" font-weight="900" font-size="34" text-anchor="middle" fill="#f4efe2">HARBOR WAVES</text>
<text x="384" y="62" font-family="Verdana,sans-serif" font-weight="900" font-size="34" text-anchor="middle" fill="#f2b632">METRO COMETS</text></svg>`;

const SCOREBOARD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="128"><rect width="256" height="128" fill="#141827"/>
<rect x="6" y="6" width="244" height="116" fill="none" stroke="#f2b632" stroke-width="4"/>
<text x="64" y="44" font-family="Verdana" font-weight="900" font-size="18" text-anchor="middle" fill="#f2b632">COMETS</text>
<text x="192" y="44" font-family="Verdana" font-weight="900" font-size="18" text-anchor="middle" fill="#3cc3cf">WAVES</text>
<text x="64" y="100" font-family="monospace" font-weight="900" font-size="46" text-anchor="middle" fill="#f4efe2">00</text>
<text x="192" y="100" font-family="monospace" font-weight="900" font-size="46" text-anchor="middle" fill="#f4efe2">00</text>
<text x="128" y="78" font-family="monospace" font-size="18" text-anchor="middle" fill="#e0634a">3:00</text></svg>`;

const SIMULATION_TYPES = new Set(['physics', 'characterController', 'playerAction']);

export function createBasketballStarter(center: Vector3): {
  entities: SceneEntity[]; playerId: string; title: 'Sports · 3D Basketball';
  generatedAssets: Generated;
} {
  const entities: SceneEntity[] = [];
  const generatedAssets: Generated = [];
  function texture(name: string, svg: string) {
    const file = new File([svg], name, { type: 'image/svg+xml' });
    const asset: ProjectAsset = { id: crypto.randomUUID(), name, kind: 'image', mimeType: file.type, size: file.size, addedAt: new Date().toISOString() };
    generatedAssets.push({ asset, file });
    return asset.id;
  }
  const courtTex = texture('basketball-court-maple.svg', svgCourt());
  const ballTex = texture('basketball-leather-seams.svg', BALL_SVG);
  const boardTex = texture('basketball-backboard.svg', BOARD_SVG);
  const netTex = texture('basketball-net-mesh.svg', NET_SVG);
  const crowdTex = [texture('basketball-crowd-a.svg', svgCrowd(17)), texture('basketball-crowd-b.svg', svgCrowd(431))];
  const bannerTex = texture('basketball-team-banner.svg', BANNER_SVG);
  const scoreTex = texture('basketball-scoreboard.svg', SCOREBOARD_SVG);

  const pos = (x: number, z: number, h: number) => ({ x: center.x + x * 10, y: center.y + z * 10, z: center.z + h * 10 });
  const local = (x: number, z: number, h: number) => ({ x: 50 + x * 10, y: 50 + z * 10, z: 50 + h * 10 });

  function feature(settings: Settings) {
    const component = createGameFeature('basketball');
    component.settings = { ...component.settings, ...settings };
    return component;
  }
  function group(name: string, at: Vector3, settings?: Settings) {
    const g = createSceneEntity(name, at, null, false);
    g.components = [getTransform(g)];
    if (settings) g.components.push(feature(settings));
    g.isGroup = true;
    entities.push(g);
    return g;
  }
  function part(parent: SceneEntity, name: string, shape: PrimitiveShape, x: number, z: number, h: number, w: number, d: number, t: number, color: string,
    opts: { rot?: Vector3; tex?: string | null; rough?: number; metal?: number; opacity?: number } = {}) {
    const entity = createSceneEntity(name, local(x, z, h), parent.id, false);
    const tr = getTransform(entity);
    entity.components = [tr];
    tr.scale = { x: w, y: d, z: t };
    tr.rotation = { x: opts.rot?.x ?? 0, y: opts.rot?.y ?? 0, z: opts.rot?.z ?? 0 };
    entity.components.push({ id: crypto.randomUUID(), type: 'primitive', enabled: true, shape, color, textureAssetId: opts.tex ?? null,
      roughness: opts.rough ?? .5, metalness: opts.metal ?? .02, ...(opts.opacity !== undefined ? { opacity: opts.opacity } : {}) });
    entities.push(entity);
    return entity;
  }
  function light(parent: SceneEntity, name: string, x: number, z: number, h: number, kind: 'point' | 'directional' | 'ambient', color: string, intensity: number) {
    const entity = createSceneEntity(name, local(x, z, h), parent.id, false);
    entity.components = [getTransform(entity), { id: crypto.randomUUID(), type: 'light', enabled: true, kind, color, intensity }];
    entities.push(entity);
  }

  // ---------- Arena ----------
  const arena = group('Basketball Arena · Comets Fieldhouse', pos(0, 0, 0), {
    role: 'arena', matchSeconds: 180, courtWidth: COURT_W, courtLength: COURT_L, homeName: HOME.name, awayName: AWAY.name,
  });
  part(arena, 'Court · Polished maple floor', 'cube', 0, 0, -.03, COURT_W, COURT_L, .06, '#ffffff', { tex: courtTex, rough: .22, metal: .04 });
  part(arena, 'Court · Apron surround', 'cube', 0, 0, -.06, COURT_W + 4, COURT_L + 4, .06, '#1b2a55', { rough: .4 });
  part(arena, 'Arena · Concourse floor', 'cube', 0, 0, -.1, COURT_W + 22, COURT_L + 22, .06, '#2a2f45', { rough: .9 });
  // Sideline benches and scorer table
  for (const side of [-1, 1]) {
    part(arena, `Bench · ${side < 0 ? 'Comets' : 'Waves'}`, 'rounded-cube', -COURT_W / 2 - 1.3, side * 4.5, .25, .6, 5, .5, side < 0 ? HOME.jersey : AWAY.trim, { rough: .6 });
  }
  part(arena, 'Scorer table', 'rounded-cube', -COURT_W / 2 - 1.5, 0, .45, .8, 3.2, .9, '#141827', { rough: .35 });
  part(arena, 'Scorer table · LED fascia', 'cube', -COURT_W / 2 - 1.08, 0, .5, .04, 3.1, .5, '#ffffff', { tex: bannerTex, rough: .2, rot: { x: 0, y: 0, z: 90 } });
  // Seating tiers: 3 tiers along each long side, 2 behind each baseline
  const tiers = [0, 1, 2];
  for (const side of [-1, 1]) {
    for (const tier of tiers) {
      const x = side * (COURT_W / 2 + 4 + tier * 1.6);
      part(arena, `Seating · ${side < 0 ? 'West' : 'East'} tier ${tier + 1}`, 'cube', x, 0, .45 + tier * .9, 1.6, COURT_L + 4, .9 + tier * 1.8 - tier * .9, '#ffffff',
        { tex: crowdTex[(tier + (side > 0 ? 1 : 0)) % 2], rough: .85 });
    }
    for (const tier of [0, 1]) {
      const z = side * (COURT_L / 2 + 4 + tier * 1.6);
      part(arena, `Seating · ${side < 0 ? 'South' : 'North'} tier ${tier + 1}`, 'cube', 0, z, .45 + tier * .9, COURT_W + 6, 1.6, .9, '#ffffff',
        { tex: crowdTex[tier % 2], rough: .85 });
    }
    part(arena, `Ribbon board · ${side < 0 ? 'West' : 'East'}`, 'cube', side * (COURT_W / 2 + 3.15), 0, .55, .06, COURT_L + 2, .5, '#ffffff', { tex: bannerTex, rough: .25 });
  }
  // Center-hung scoreboard
  part(arena, 'Scoreboard · Center hung frame', 'rounded-cube', 0, 0, 9.5, 3.4, 3.4, 2, '#141827', { rough: .3, metal: .5 });
  for (const [i, [dx, dz, yaw]] of ([[0, -1.72, 0], [0, 1.72, 180], [-1.72, 0, -90], [1.72, 0, 90]] as const).entries()) {
    part(arena, `Scoreboard · Screen ${i + 1}`, 'cube', dx, dz, 9.5, 3, .05, 1.6, '#ffffff', { tex: scoreTex, rough: .15, rot: { x: 0, y: 0, z: yaw } });
  }
  part(arena, 'Scoreboard · Gold halo ring', 'torus', 0, 0, 8.35, 5.6, .5, 5.6, HOME.trim, { rot: { x: 90, y: 0, z: 0 }, rough: .3, metal: .6 });
  // Lighting rig
  light(arena, 'Light · Arena ambient fill', 0, 0, 12, 'ambient', '#ffeedd', .55);
  light(arena, 'Light · Key broadcast', 6, -10, 16, 'directional', '#fff4e0', 1.25);
  for (const [i, [x, z]] of ([[-5, -9], [5, -9], [-5, 9], [5, 9]] as const).entries()) {
    light(arena, `Light · Court spot ${i + 1}`, x, z, 11, 'point', '#fff1d6', 1.6);
    part(arena, `Lighting truss · Can ${i + 1}`, 'cylinder', x, z, 11.3, .5, .5, .4, '#2a2f45', { metal: .7, rough: .3 });
  }
  part(arena, 'Lighting truss · West', 'cube', -5, 0, 11.6, .25, 20, .25, '#3a4058', { metal: .7, rough: .35 });
  part(arena, 'Lighting truss · East', 'cube', 5, 0, 11.6, .25, 20, .25, '#3a4058', { metal: .7, rough: .35 });

  // ---------- Hoops (root = rim centre) ----------
  function hoop(team: 'home' | 'away', z: number) {
    const dir = Math.sign(z); // +1 north basket, -1 south
    const label = team === 'home' ? 'North' : 'South';
    const root = group(`Hoop · ${label} rim · ${team === 'home' ? HOME.name : AWAY.name} attack`, pos(0, z, RIM_H), { role: 'hoop', team });
    part(root, 'Rim · Breakaway steel ring', 'torus', 0, 0, 0, .62, .16, .62, '#e0571f', { rot: { x: 90, y: 0, z: 0 }, metal: .75, rough: .28 });
    part(root, 'Rim · Mount bracket', 'cube', 0, dir * .3, -.02, .14, .2, .06, '#c94c1a', { metal: .7, rough: .3 });
    part(root, 'Net · Nylon mesh', 'cone', 0, 0, -.22, .44, .44, .42, '#ffffff', { rot: { x: 180, y: 0, z: 0 }, tex: netTex, opacity: .78, rough: .8 });
    part(root, 'Backboard · Tempered glass', 'cube', 0, dir * .4, .45, 1.8, .03, 1.05, '#ffffff', { tex: boardTex, opacity: .5, rough: .05, metal: .1 });
    part(root, 'Backboard · Steel frame', 'cube', 0, dir * .43, .45, 1.86, .03, 1.1, '#20263a', { metal: .7, rough: .3, opacity: .9 });
    part(root, 'Backboard · Bottom padding', 'rounded-cube', 0, dir * .4, -.1, 1.86, .09, .1, HOME.jersey, { rough: .7 });
    part(root, 'Stanchion · Overhang arm', 'cube', 0, dir * 1.4, .35, .16, 1.9, .16, '#20263a', { metal: .65, rough: .32 });
    part(root, 'Stanchion · Upright', 'rounded-cube', 0, dir * 2.4, -1.4, .26, .26, 3.6, '#20263a', { metal: .6, rough: .35 });
    part(root, 'Stanchion · Padded base', 'rounded-cube', 0, dir * 2.7, -2.6, 1.3, 1.6, 1, HOME.jersey, { rough: .65 });
    part(root, 'Stanchion · Base pad stripe', 'cube', 0, dir * 1.89, -2.6, 1.32, .02, .14, HOME.trim, { rough: .5 });
    return root;
  }
  hoop('home', HOOP_Z);
  hoop('away', -HOOP_Z);

  // ---------- Athletes ----------
  const roster: Array<{ team: 'home' | 'away'; number: number; x: number; z: number; name: string; height: number }> = [
    { team: 'home', number: 1, x: 0, z: -7, name: 'Dario Velasco', height: 1.88 },
    { team: 'home', number: 2, x: -4, z: -3, name: 'Kenji Arata', height: 1.96 },
    { team: 'home', number: 3, x: 4, z: -3, name: 'Malik Oyelaran', height: 2.06 },
    { team: 'away', number: 1, x: 0, z: 6, name: 'Teo Marchetti', height: 1.86 },
    { team: 'away', number: 2, x: -3, z: 2, name: 'Rhys Calloway', height: 1.98 },
    { team: 'away', number: 3, x: 3, z: 2, name: 'Bram Okonkwo', height: 2.08 },
  ];
  let playerId = '';
  roster.forEach((r, index) => {
    const team = r.team === 'home' ? HOME : AWAY;
    const jerseyTex = texture(`basketball-jersey-${r.team}-${r.number}.svg`, svgJersey(team, r.number));
    const built = createEgoCharacterScene('human', r.height, { x: 0, z: 0 }, r.name, jerseyTex);
    const setup = built.entities.find(entity => entity.id === built.setupId)!;
    const character = built.entities.find(entity => entity.id === built.characterId)!;
    const factor = r.height / 1.8;
    const kept: SceneEntity[] = [];
    for (const entity of built.entities) {
      entity.components = entity.components.filter((component: SceneComponent) => !SIMULATION_TYPES.has(component.type));
      const prim = entity.components.find(component => component.type === 'primitive');
      const tr = getTransform(entity);
      if (/Clothing · (Left|Right) sleeve/.test(entity.name)) continue; // sleeveless jersey
      if (prim?.type === 'primitive') {
        if (entity.name.startsWith('Skin ·')) prim.color = SKIN[index];
        if (entity.name.startsWith('Hair ·')) prim.color = HAIR[index];
        if (/Tailored shirt/.test(entity.name)) { entity.name = `Clothing · ${team.name} jersey #${r.number}`; prim.color = '#ffffff'; }
        if (/trousers/.test(entity.name)) {
          entity.name = entity.name.replace('trousers', 'game shorts');
          prim.color = team.jersey; prim.textureAssetId = null;
          tr.position.z += 1.6 * factor;
          tr.scale.z *= .5;
          tr.scale.x *= 1.08;
        }
        if (/Belt/.test(entity.name)) { entity.name = 'Clothing · Shorts waistband'; prim.color = team.trim; }
        if (/boot/.test(entity.name)) { entity.name = entity.name.replace('boot', 'court sneaker'); prim.color = team.shoe; }
      }
      kept.push(entity);
    }
    setup.name = `Player · ${team.name} #${r.number} · ${r.name}`;
    // Preserve native body/skin-rig recognition; the parent is the friendly player label.
    character.name = `Character · ${r.name} · ${r.height.toFixed(2)} m`;
    const tr = getTransform(setup);
    tr.position = pos(r.x, r.z, 0);
    tr.rotation = { x: 0, y: 0, z: r.team === 'home' ? 0 : 180 }; // zero yaw faces +worldZ
    const controlled = r.team === 'home' && r.number === 1;
    setup.components.push(feature({ role: 'player', team: r.team, controlled, jerseyNumber: r.number, moveSpeed: r.height > 2 ? 5.6 : 6.2 }));
    if (controlled) playerId = setup.id;
    entities.push(...kept);
  });

  // ---------- Ball ----------
  const ball = createSceneEntity('Ball · Official leather 7 (0.12 m radius)', pos(.42, -6.6, 1.0), null, false);
  const btr = getTransform(ball);
  ball.components = [btr];
  btr.scale = { x: .24, y: .24, z: .24 };
  ball.components.push({ id: crypto.randomUUID(), type: 'primitive', enabled: true, shape: 'sphere', color: '#ffffff', textureAssetId: ballTex, roughness: .72, metalness: 0 });
  ball.components.push(feature({ role: 'ball' }));
  entities.push(ball);

  // ---------- Controlled-player indicator (runtime follows controlledId) ----------
  const ring = createSceneEntity('Indicator · Controlled player ring', pos(0, -7, .02), null, false);
  const rtr = getTransform(ring);
  ring.components = [rtr];
  rtr.scale = { x: 1.15, y: 1.15, z: 1 };
  ring.components.push({ id: crypto.randomUUID(), type: 'primitive', enabled: true, shape: 'ring', color: HOME.trim, textureAssetId: null, roughness: .35, metalness: .1, opacity: .85 });
  ring.components.push(feature({ role: 'indicator', team: 'home' }));
  entities.push(ring);

  return { entities, playerId, title: 'Sports · 3D Basketball', generatedAssets };
}
