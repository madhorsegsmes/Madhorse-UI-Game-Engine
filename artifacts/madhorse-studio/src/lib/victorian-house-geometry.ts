import type { BuilderPart } from '@workspace/api-client-react';
import { createSceneEntity, getTransform, type PrimitiveShape, type SceneEntity } from './scene-model';

type Point3 = { x: number; y: number; z: number };
type Size3 = { x: number; y: number; z: number };
type Rotation3 = { x: number; y: number; z: number };

/** Expands one compact architecture instruction into independently editable scene geometry. */
export function createVictorianHouseGeometry(parentId: string, specification: BuilderPart): SceneEntity[] {
  const entities: SceneEntity[] = [];
  const width = clamp(specification.size.x, 16, 24);
  const height = clamp(specification.size.y, 10, 15);
  const depth = clamp(specification.size.z, 12, 22);
  const wall = 0.3;
  const floorHeight = (height - 3.4) / 2;
  const secondFloor = floorHeight;
  const roofBase = floorHeight * 2;
  const roofRise = height - roofBase;
  const front = -depth / 2;
  const palette = {
    wall: specification.color,
    roof: specification.roofColor ?? '#30374b',
    trim: specification.trimColor ?? '#eee2cc',
    accent: specification.accentColor ?? '#98563f',
    glass: '#82b9d0',
    recess: '#352d32',
    foundation: '#77716d',
  };

  const group = (name: string, parent = parentId) => {
    const entity = createSceneEntity(name, { x: 0, y: 0, z: 0 }, parent, false);
    entity.isGroup = true;
    entities.push(entity);
    return entity.id;
  };

  const add = (
    parent: string, name: string, shape: PrimitiveShape, at: Point3, size: Size3,
    color: string, rotation: Rotation3 = { x: 0, y: 0, z: 0 }, opacity = 1,
  ) => {
    const entity = createSceneEntity(name, { x: at.x * 10, y: at.z * 10, z: at.y * 10 }, parent, false);
    const transform = getTransform(entity);
    transform.rotation = { x: -rotation.x, y: -rotation.z, z: -rotation.y };
    transform.scale = { x: size.x, y: size.z, z: size.y };
    entity.components.push({
      id: crypto.randomUUID(), type: 'primitive', enabled: true, shape,
      color, opacity, textureAssetId: null,
    });
    entities.push(entity);
    return entity;
  };

  const wallsGroup = group('Victorian House · Walls');
  const roofGroup = group('Victorian House · Gables and roofs');
  const porchGroup = group('Victorian House · Porch and balcony');
  const windowsGroup = group('Victorian House · Windows and doors');
  const foundationGroup = group('Victorian House · Foundation and steps');

  const addWindow = (parent: string, name: string, center: Point3, w: number, h: number, side: -1 | 0 | 1 = 0) => {
    const frame = 0.13;
    const sill = 0.14;
    const post = (postName: string, x: number, y: number, z: number, sw: number, sh: number, sd: number, color = palette.trim) =>
      add(parent, `${name} · ${postName}`, 'cube', { x, y, z }, { x: sw, y: sh, z: sd }, color);
    if (side === 0) {
      add(parent, `${name} · Glazing`, 'cube',
        { x: center.x, y: center.y, z: center.z - wall * 0.62 },
        { x: w - frame * 1.2, y: h - frame * 1.2, z: 0.07 }, palette.glass, { x: 0, y: 0, z: 0 }, 0.48);
      post('Left jamb', center.x - w / 2, center.y, center.z - wall * 0.73, frame, h + frame, 0.16);
      post('Right jamb', center.x + w / 2, center.y, center.z - wall * 0.73, frame, h + frame, 0.16);
      post('Header', center.x, center.y + h / 2, center.z - wall * 0.73, w + frame * 2, frame, 0.16);
      post('Sill', center.x, center.y - h / 2, center.z - wall * 0.73, w + frame * 2.3, sill, 0.23);
      post('Vertical mullion', center.x, center.y, center.z - wall * 0.79, frame * 0.48, h - frame, 0.08, palette.trim);
      post('Cross mullion', center.x, center.y, center.z - wall * 0.8, w - frame, frame * 0.48, 0.08, palette.trim);
    } else {
      add(parent, `${name} · Glazing`, 'cube',
        { x: center.x + side * wall * 0.62, y: center.y, z: center.z },
        { x: 0.07, y: h - frame * 1.2, z: w - frame * 1.2 }, palette.glass, { x: 0, y: 0, z: 0 }, 0.48);
      post('Front jamb', center.x + side * wall * 0.73, center.y, center.z - w / 2, 0.16, h + frame, frame);
      post('Rear jamb', center.x + side * wall * 0.73, center.y, center.z + w / 2, 0.16, h + frame, frame);
      post('Header', center.x + side * wall * 0.73, center.y + h / 2, center.z, 0.16, frame, w + frame * 2);
      post('Sill', center.x + side * wall * 0.73, center.y - h / 2, center.z, 0.23, sill, w + frame * 2.3);
      post('Mullion', center.x + side * wall * 0.79, center.y, center.z, 0.08, h - frame, frame * 0.48);
      post('Cross mullion', center.x + side * wall * 0.8, center.y, center.z, 0.08, frame * 0.48, w - frame);
    }
  };

  type Opening = { x: number; width: number; bottom: number; height: number; name: string; door?: boolean };
  const addFrontWall = (name: string, baseY: number, h: number, openings: Opening[]) => {
    const xCuts = [...new Set([-width / 2, width / 2, ...openings.flatMap(o => [o.x - o.width / 2, o.x + o.width / 2])])].sort((a, b) => a - b);
    const yCuts = [...new Set([0, h, ...openings.flatMap(o => [o.bottom, o.bottom + o.height])])].sort((a, b) => a - b);
    for (let yi = 0; yi < yCuts.length - 1; yi++) {
      const y0 = yCuts[yi], y1 = yCuts[yi + 1], cy = (y0 + y1) / 2;
      const spans: Array<{ left: number; right: number }> = [];
      let start: number | null = null;
      for (let xi = 0; xi < xCuts.length - 1; xi++) {
        const x0 = xCuts[xi], x1 = xCuts[xi + 1], cx = (x0 + x1) / 2;
        const empty = openings.some(o => cx > o.x - o.width / 2 && cx < o.x + o.width / 2 &&
          cy > o.bottom && cy < o.bottom + o.height);
        if (!empty && start === null) start = x0;
        if ((empty || xi === xCuts.length - 2) && start !== null) {
          spans.push({ left: start, right: empty ? x0 : x1 });
          start = null;
        }
      }
      for (const span of spans) {
        add(wallsGroup, `${name} · Wall section`, 'cube',
          { x: (span.left + span.right) / 2, y: baseY + cy, z: front },
          { x: span.right - span.left, y: y1 - y0, z: wall }, palette.wall);
      }
    }
    for (const opening of openings) {
      const center = { x: opening.x, y: baseY + opening.bottom + opening.height / 2, z: front };
      if (opening.door) {
        add(windowsGroup, `${opening.name} · Door`, 'cube',
          { x: opening.x, y: baseY + opening.height / 2, z: front - wall * 0.62 },
          { x: opening.width - 0.22, y: opening.height - 0.1, z: 0.1 }, palette.accent);
        add(windowsGroup, `${opening.name} · Header`, 'cube',
          { x: opening.x, y: baseY + opening.height, z: front - wall * 0.72 },
          { x: opening.width + 0.28, y: 0.16, z: 0.18 }, palette.trim);
        for (const x of [-1, 1]) {
          add(windowsGroup, `${opening.name} · Door jamb`, 'cube',
            { x: opening.x + x * opening.width / 2, y: baseY + opening.height / 2, z: front - wall * 0.72 },
            { x: 0.14, y: opening.height, z: 0.18 }, palette.trim);
        }
        add(windowsGroup, `${opening.name} · Panel detail`, 'cube',
          { x: opening.x, y: baseY + opening.height * 0.67, z: front - wall * 0.9 },
          { x: opening.width * 0.55, y: opening.height * 0.24, z: 0.05 }, palette.trim);
        add(windowsGroup, `${opening.name} · Step`, 'cube',
          { x: opening.x, y: baseY + 0.08, z: front - 0.38 },
          { x: opening.width + 0.42, y: 0.16, z: 0.72 }, palette.foundation);
      } else {
        addWindow(windowsGroup, opening.name, center, opening.width, opening.height);
      }
    }
  };

  const addSideWall = (name: string, side: -1 | 1, baseY: number, h: number, windows: number[]) => {
    const wallX = side * (width / 2);
    const openings = windows.map((z) => ({ z, width: 1.12, bottom: 0.95, height: 1.35 }));
    const zCuts = [...new Set([-depth / 2, depth / 2, ...openings.flatMap(o => [o.z - o.width / 2, o.z + o.width / 2])])].sort((a, b) => a - b);
    const yCuts = [...new Set([0, h, ...openings.flatMap(o => [o.bottom, o.bottom + o.height])])].sort((a, b) => a - b);
    for (let yi = 0; yi < yCuts.length - 1; yi++) {
      const y0 = yCuts[yi], y1 = yCuts[yi + 1], cy = (y0 + y1) / 2;
      let start: number | null = null;
      for (let zi = 0; zi < zCuts.length - 1; zi++) {
        const z0 = zCuts[zi], z1 = zCuts[zi + 1], cz = (z0 + z1) / 2;
        const empty = openings.some(o => cz > o.z - o.width / 2 && cz < o.z + o.width / 2 &&
          cy > o.bottom && cy < o.bottom + o.height);
        if (!empty && start === null) start = z0;
        if ((empty || zi === zCuts.length - 2) && start !== null) {
          const end = empty ? z0 : z1;
          add(wallsGroup, `${name} · Wall section`, 'cube',
            { x: wallX, y: baseY + cy, z: (start + end) / 2 },
            { x: wall, y: y1 - y0, z: end - start }, palette.wall);
          start = null;
        }
      }
    }
    for (const z of windows) {
      const centerY = baseY + h * 0.57;
      addWindow(windowsGroup, `${name} · Window`, { x: wallX, y: centerY, z }, 1.12, 1.35, side);
    }
  };

  // A raised plinth, separate floor courses and a real doorway/window cutout grid.
  add(foundationGroup, 'Continuous stone foundation', 'cube',
    { x: 0, y: 0.15, z: 0 }, { x: width + 0.8, y: 0.3, z: depth + 0.8 }, palette.foundation);
  add(foundationGroup, 'First floor sill course', 'cube',
    { x: 0, y: 0.42, z: front - wall * 0.72 }, { x: width + 0.45, y: 0.18, z: 0.45 }, palette.trim);
  add(foundationGroup, 'Upper story belt course', 'cube',
    { x: 0, y: secondFloor, z: front - wall * 0.65 }, { x: width + 0.45, y: 0.22, z: 0.42 }, palette.trim);

  const groundWindows = [-width * 0.34, -width * 0.15, width * 0.17, width * 0.36]
    .map((x, index): Opening => ({ x, width: 1.2, bottom: 0.95, height: 1.45, name: `Front ground window ${index + 1}` }));
  const door: Opening = { x: 0, width: 1.45, bottom: 0, height: 2.6, name: 'Front entry', door: true };
  addFrontWall('Ground floor façade', 0, floorHeight, [...groundWindows, door]);
  const upperCenters = [-0.36, -0.18, 0, 0.18, 0.36].map(x => x * width);
  const upperWindows = upperCenters.map((x, index): Opening => ({
    x, width: 1.05, bottom: 1.05, height: 1.45, name: `Balcony story window ${index + 1}`,
  }));
  addFrontWall('Upper floor façade', secondFloor, floorHeight, upperWindows);
  for (const side of [-1, 1] as const) {
    addSideWall(side === -1 ? 'West elevation ground story' : 'East elevation ground story', side, 0, floorHeight, [-depth * 0.25, depth * 0.23]);
    addSideWall(side === -1 ? 'West elevation upper story' : 'East elevation upper story', side, secondFloor, floorHeight, [-depth * 0.22, depth * 0.26]);
  }
  add(wallsGroup, 'Rear elevation lower story', 'cube', { x: 0, y: floorHeight / 2, z: depth / 2 }, { x: width, y: floorHeight, z: wall }, palette.wall);
  add(wallsGroup, 'Rear elevation upper story', 'cube', { x: 0, y: secondFloor + floorHeight / 2, z: depth / 2 }, { x: width, y: floorHeight, z: wall }, palette.wall);

  const addGable = (parent: string, name: string, x: number, baseY: number, z: number, halfWidth: number, rise: number, thickness: number) => {
    add(parent, `${name} · Left gable infill`, 'wedge',
      { x: x - halfWidth / 2, y: baseY + rise / 2, z }, { x: halfWidth, y: rise, z: thickness }, palette.wall);
    add(parent, `${name} · Right gable infill`, 'wedge',
      { x: x + halfWidth / 2, y: baseY + rise / 2, z }, { x: halfWidth, y: rise, z: thickness }, palette.wall,
      { x: 0, y: 0, z: 180 });
  };

  const addPitchedRoof = (parent: string, name: string, x: number, baseY: number, z: number,
    halfWidth: number, rise: number, roofDepth: number) => {
    const slopeLength = Math.hypot(halfWidth, rise);
    const angle = Math.atan2(rise, halfWidth) * 180 / Math.PI;
    add(parent, `${name} · Left pitched roof`, 'cube',
      { x: x - halfWidth / 2, y: baseY + rise / 2, z },
      { x: slopeLength, y: 0.3, z: roofDepth }, palette.roof, { x: 0, y: 0, z: angle });
    add(parent, `${name} · Right pitched roof`, 'cube',
      { x: x + halfWidth / 2, y: baseY + rise / 2, z },
      { x: slopeLength, y: 0.3, z: roofDepth }, palette.roof, { x: 0, y: 0, z: -angle });
    add(parent, `${name} · Ridge cap`, 'cube',
      { x, y: baseY + rise + 0.12, z }, { x: 0.38, y: 0.24, z: roofDepth }, palette.accent);
    add(parent, `${name} · Front eave`, 'cube',
      { x, y: baseY + 0.12, z: z - roofDepth / 2 }, { x: halfWidth * 2 + 0.55, y: 0.24, z: 0.28 }, palette.trim);
  };

  const frontGableZ = front - wall * 0.68;
  addGable(roofGroup, 'Main front gable', 0, roofBase, frontGableZ, width / 2 + 0.5, roofRise, wall);
  addGable(roofGroup, 'Main rear gable', 0, roofBase, depth / 2 + wall * 0.6, width / 2 + 0.5, roofRise, wall);
  addPitchedRoof(roofGroup, 'Main slate roof', 0, roofBase + roofRise * 0.02, 0,
    width / 2 + 0.8, roofRise, depth + 1.1);

  // A projecting central dormer makes the front roofline legible rather than a flat slab.
  const dormerWidth = width * 0.3;
  const dormerBase = roofBase + roofRise * 0.36;
  const dormerRise = roofRise * 0.48;
  const dormerZ = front - 0.7;
  addGable(roofGroup, 'Front dormer', 0, dormerBase, dormerZ, dormerWidth / 2, dormerRise, depth * 0.24);
  addPitchedRoof(roofGroup, 'Front dormer roof', 0, dormerBase + dormerRise * 0.02, dormerZ,
    dormerWidth / 2 + 0.24, dormerRise, depth * 0.24 + 0.35);
  addWindow(windowsGroup, 'Dormer window', { x: 0, y: dormerBase + dormerRise * 0.44, z: dormerZ - wall * 0.8 }, 1.35, 1.15);

  // Polygonal turret with a real conical roof and raised eave bands.
  const turretX = width * 0.31;
  const turretZ = front - 0.1;
  const turretWidth = width * 0.23;
  const turretHeight = roofBase + 0.6;
  add(roofGroup, 'Round corner turret', 'cylinder',
    { x: turretX, y: turretHeight / 2, z: turretZ },
    { x: turretWidth, y: turretHeight, z: turretWidth }, palette.accent);
  for (const y of [floorHeight * 0.86, floorHeight + 0.28, roofBase - 0.28]) {
    add(roofGroup, 'Turret raised trim band', 'torus',
      { x: turretX, y, z: turretZ },
      { x: turretWidth + 0.22, y: 0.3, z: turretWidth + 0.22 }, palette.trim);
  }
  add(roofGroup, 'Turret conical roof', 'cone',
    { x: turretX, y: turretHeight + 1.35, z: turretZ },
    { x: turretWidth + 0.75, y: 2.7, z: turretWidth + 0.75 }, palette.roof);
  add(roofGroup, 'Turret finial', 'sphere',
    { x: turretX, y: turretHeight + 2.85, z: turretZ }, { x: 0.38, y: 0.48, z: 0.38 }, palette.accent);
  for (let index = 0; index < 4; index++) {
    const angle = index * Math.PI / 2;
    const center = { x: turretX + Math.sin(angle) * turretWidth * 0.44, y: roofBase - 1, z: turretZ + Math.cos(angle) * turretWidth * 0.44 };
    addWindow(windowsGroup, `Turret sash ${index + 1}`, center, 0.82, 1.55);
  }

  // Raised upper balcony with continuous balustrade and deliberate openings.
  const balconyWidth = width * 0.65;
  const balconyDepth = 1.65;
  const balconyZ = front - 1.2;
  const balconyY = secondFloor + 0.28;
  add(porchGroup, 'Upper balcony platform', 'cube',
    { x: 0, y: balconyY, z: balconyZ },
    { x: balconyWidth, y: 0.32, z: balconyDepth }, palette.accent);
  const railTop = balconyY + 1.02;
  for (const z of [balconyZ - balconyDepth / 2, balconyZ + balconyDepth / 2]) {
    add(porchGroup, 'Balcony continuous handrail', 'cube',
      { x: 0, y: railTop, z }, { x: balconyWidth, y: 0.16, z: 0.16 }, palette.trim);
    add(porchGroup, 'Balcony lower rail', 'cube',
      { x: 0, y: balconyY + 0.37, z }, { x: balconyWidth, y: 0.14, z: 0.14 }, palette.trim);
    for (let i = 0; i <= 18; i++) {
      const x = -balconyWidth / 2 + i * balconyWidth / 18;
      add(porchGroup, 'Balcony baluster', 'cylinder',
        { x, y: balconyY + 0.7, z }, { x: 0.09, y: 0.7, z: 0.09 }, palette.trim);
    }
  }
  for (const side of [-1, 1]) {
    const x = side * balconyWidth / 2;
    add(porchGroup, 'Balcony side handrail', 'cube',
      { x, y: railTop, z: balconyZ }, { x: 0.16, y: 0.16, z: balconyDepth }, palette.trim);
    for (let i = 0; i <= 3; i++) {
      const z = balconyZ - balconyDepth / 2 + i * balconyDepth / 3;
      add(porchGroup, 'Balcony side baluster', 'cylinder',
        { x, y: balconyY + 0.7, z }, { x: 0.09, y: 0.7, z: 0.09 }, palette.trim);
    }
  }

  // Covered wraparound porch, evenly spaced columns, open steps and a short railing run.
  const porchWidth = width + 2.2;
  const porchDepth = 2.8;
  const porchZ = front - 2.1;
  const porchRoofY = floorHeight - 0.18;
  add(porchGroup, 'Wraparound porch floor', 'cube',
    { x: 0, y: 0.55, z: porchZ }, { x: porchWidth, y: 0.3, z: porchDepth }, palette.trim);
  add(porchGroup, 'Porch canopy', 'cube',
    { x: 0, y: porchRoofY, z: porchZ - 0.2 }, { x: porchWidth + 0.8, y: 0.22, z: porchDepth + 1.1 }, palette.roof);
  add(porchGroup, 'Porch canopy fascia', 'cube',
    { x: 0, y: porchRoofY - 0.16, z: porchZ - porchDepth / 2 - 0.72 },
    { x: porchWidth + 0.9, y: 0.34, z: 0.2 }, palette.trim);
  for (let i = 0; i <= 8; i++) {
    const x = -porchWidth / 2 + i * porchWidth / 8;
    if (Math.abs(x) < 1.4) continue;
    add(porchGroup, `Porch turned column ${i + 1}`, 'cylinder',
      { x, y: porchRoofY / 2 + 0.42, z: porchZ - porchDepth / 2 + 0.15 },
      { x: 0.32, y: porchRoofY - 0.5, z: 0.32 }, palette.trim);
    add(porchGroup, `Porch column capital ${i + 1}`, 'cube',
      { x, y: porchRoofY - 0.4, z: porchZ - porchDepth / 2 + 0.15 },
      { x: 0.58, y: 0.22, z: 0.58 }, palette.accent);
  }
  const stairCount = 5;
  for (let i = 0; i < stairCount; i++) {
    add(foundationGroup, `Front stair ${i + 1}`, 'cube',
      { x: 0, y: 0.34 - i * 0.06, z: porchZ - porchDepth / 2 - 0.25 - i * 0.42 },
      { x: 2.6 + (stairCount - i) * 0.12, y: 0.24, z: 0.52 }, palette.foundation);
  }
  add(foundationGroup, 'Entry walk', 'cube',
    { x: 0, y: 0.04, z: porchZ - porchDepth / 2 - 2.8 },
    { x: 3.1, y: 0.08, z: 2.4 }, palette.foundation);

  // A restrained garden edge keeps plants from obscuring the facade.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const x = side * (width / 2 + 2.2 + i * 0.8);
      add(foundationGroup, 'Low foundation shrub', 'sphere',
        { x, y: 0.72, z: front - 1.5 + i * 2.2 },
        { x: 1.2, y: 1.35, z: 1.15 }, i % 2 ? '#50644a' : '#66724f');
    }
  }

  return entities;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}
