import { PlanMadBuilderResponse } from '@workspace/api-zod';
import type { MadBuilderPlan } from '@workspace/api-client-react';
import { createSceneEntity, createModelRendererComponent, createSpriteRendererComponent,
  getTransform, getWorldTransform, isSceneGraph, type ProjectAsset, type SceneEntity } from './scene-model';
import { createUIControlElement, type UIControlElement } from './ui-controls';
import { createVictorianHouseGeometry } from './victorian-house-geometry';
import { createCoupeVehicleGeometry, COUPE_DIMENSIONS } from './coupe-vehicle-geometry';
import type { BuilderMessage } from '@/components/mad-builder-contract';

export function isBuilderHistory(value: unknown): value is BuilderMessage[] {
  return Array.isArray(value) && value.length <= 40 && value.every((message) =>
    message && typeof message.id === 'string' && ['user', 'assistant'].includes(message.role) &&
    typeof message.text === 'string' && message.text.length <= 2000);
}
export function isBuilderDraft(value: unknown): value is MadBuilderPlan | null {
  return value === null || PlanMadBuilderResponse.safeParse(value).success;
}

/** The only boundary between AI output and the editor: data in, new entities out. */
export function compileBuilderPlan(input: unknown, existing: SceneEntity[], assets: ProjectAsset[]) {
  const parsed = PlanMadBuilderResponse.safeParse(input);
  if (!parsed.success) throw new Error('The AI returned an unsupported or incomplete plan. Please try again.');
  const plan: MadBuilderPlan = parsed.data;
  if (!plan.parts.length) throw new Error('This plan does not contain any buildable objects.');
  const byKey = new Map(plan.parts.map((part) => [part.key, part]));
  if (byKey.size !== plan.parts.length) throw new Error('The plan contains duplicate object keys.');
  if (plan.parts.some((part) => part.shape && part.kind !== 'box')) {
    throw new Error('A shape can only be assigned to a 3D object.');
  }
  if (plan.parts.some((part) => part.kind === 'architecture' && part.architectureStyle !== 'victorian-house')) {
    throw new Error('This architecture tool needs a supported house style.');
  }
  if (plan.parts.some((part) => part.kind === 'vehicle' && part.vehicleStyle !== 'muscle-coupe')) {
    throw new Error('This vehicle tool needs a supported vehicle style.');
  }
  if (plan.parts.filter((part) => part.kind === 'vehicle').length > 4) {
    throw new Error('Build at most four detailed vehicles at a time.');
  }
  for (const [kind, limit] of [['terrain', 2], ['light', 8], ['camera', 4], ['model', 4]] as const) {
    if (plan.parts.filter((part) => part.kind === kind).length > limit) throw new Error(`Too many ${kind} objects in one build.`);
  }
  if (plan.parts.filter((part) => part.kind.startsWith('ui-')).length > 20) throw new Error('Too many UI controls in one build.');
  for (const part of plan.parts) {
    let current: typeof part | undefined = part;
    const chain = new Set<string>();
    while (current) {
      if (chain.has(current.key) || chain.size >= 8) throw new Error('The plan has an invalid or overly deep hierarchy.');
      chain.add(current.key);
      if (current.parentKey && !byKey.has(current.parentKey)) throw new Error('The plan references a missing parent.');
      current = current.parentKey ? byKey.get(current.parentKey) : undefined;
    }
    if (part.assetId && !assets.some((asset) => asset.id === part.assetId &&
      asset.kind === (part.kind === 'model' ? 'model' : 'image'))) throw new Error('A requested asset is no longer available in this project.');
    if (part.kind === 'model' && !part.assetId) throw new Error('A model part needs an existing project model.');
  }
  const anchor = getWorldTransform(existing, 'player')?.position ?? { x: 50, y: 50, z: 0 };
  const previousBuilds = existing.filter((entity) => entity.generatedBy === 'mad-builder').length;
  // Scene positions use 10 storage units per world unit. Keep builds clear of
  // the starter cube, then leave enough room for the widest supported house.
  anchor.x += 140 + previousBuilds * 300;
  const root = createSceneEntity(plan.title, anchor, null, false);
  root.generatedBy = 'mad-builder';
  root.isGroup = true;
  const ids = new Map(plan.parts.map((part) => [part.key, crypto.randomUUID()]));
  const entities: SceneEntity[] = [root];
  const uiControls: UIControlElement[] = [];
  for (const part of plan.parts) {
    if (part.kind === 'vehicle') {
      const vehicle = createSceneEntity(part.name, {
        x: 50 + part.position.x * 10, y: 50 + part.position.z * 10, z: 50 + part.position.y * 10,
      }, part.parentKey ? ids.get(part.parentKey)! : root.id, false);
      vehicle.id = ids.get(part.key)!;
      vehicle.isGroup = true;
      const transform = getTransform(vehicle);
      transform.rotation = { x: -part.rotation.x, y: -part.rotation.z, z: -part.rotation.y };
      transform.scale = { x: part.size.x / COUPE_DIMENSIONS.x,
        y: part.size.z / COUPE_DIMENSIONS.z, z: part.size.y / COUPE_DIMENSIONS.y };
      const physics = vehicle.components.find((component) => component.type === 'physics');
      if (physics?.type === 'physics') {
        physics.bodyType = 'static';
        physics.size = { x: COUPE_DIMENSIONS.x * 10, y: COUPE_DIMENSIONS.z * 10, z: COUPE_DIMENSIONS.y * 10 };
      }
      entities.push(vehicle, ...createCoupeVehicleGeometry(vehicle.id, part));
      continue;
    }
    if (part.kind === 'architecture') {
      const houseGroup = createSceneEntity(part.name, {
        x: part.position.x * 10,
        y: part.position.z * 10,
        z: part.position.y * 10,
      }, part.parentKey ? ids.get(part.parentKey)! : root.id, false);
      houseGroup.id = ids.get(part.key)!;
      houseGroup.isGroup = true;
      entities.push(houseGroup, ...createVictorianHouseGeometry(houseGroup.id, part));
      continue;
    }
    const entity = createSceneEntity(part.name, {
      x: 50 + part.position.x * 10, y: 50 + part.position.z * 10, z: 50 + part.position.y * 10,
    }, part.parentKey ? ids.get(part.parentKey)! : root.id, false);
    entity.id = ids.get(part.key)!;
    const transform = getTransform(entity);
    transform.rotation = { x: -part.rotation.x, y: -part.rotation.z, z: -part.rotation.y };
    transform.scale = { x: part.size.x, y: part.size.z, z: part.size.y };
    if (part.kind === 'group') entity.isGroup = true;
    else if (['box', 'plane', 'terrain'].includes(part.kind)) {
      if (part.kind === 'plane') transform.scale = { x: part.size.x / 10, y: part.size.z / 10, z: 1 };
      if (part.kind === 'terrain') transform.scale = { x: part.size.x / 20, y: part.size.z / 20, z: part.size.y / 1.3 };
      entity.components.push({ id: crypto.randomUUID(), type: 'primitive', enabled: true,
        shape: part.kind === 'box' ? part.shape ?? 'cube' : part.kind as 'plane' | 'terrain',
        color: part.color, opacity: part.opacity ?? 1, textureAssetId: part.assetId ?? null });
    } else if (part.kind === 'sprite') {
      transform.scale = { x: 1, y: 1, z: 1 };
      entity.components.push({ ...createSpriteRendererComponent(), tint: part.color,
        width: part.size.x * 10, height: part.size.z * 10, assetId: part.assetId ?? null });
    } else if (part.kind === 'model') {
      entity.components.push(createModelRendererComponent(part.assetId));
    } else if (part.kind === 'light') {
      entity.components.push({ id: crypto.randomUUID(), type: 'light', enabled: true,
        kind: part.lightKind ?? 'point', color: part.color, intensity: part.intensity ?? 10 });
    } else if (part.kind === 'camera') {
      entity.components.push({ id: crypto.randomUUID(), type: 'camera', enabled: true,
        fov: part.fov ?? 50, target: { ...anchor, z: anchor.z + 15 } });
    } else if (part.kind.startsWith('ui-')) {
      const type = part.kind === 'ui-health' ? 'health-bar' : part.kind.slice(3) as 'text' | 'button' | 'panel';
      const control = { ...createUIControlElement(type, uiControls.length), label: part.text ?? part.name,
        x: Math.max(0, Math.min(100, 50 + part.position.x * 5)),
        y: Math.max(0, Math.min(100, 50 - part.position.y * 5)),
        width: Math.max(24, Math.min(1000, part.size.x * 100)),
        height: Math.max(20, Math.min(500, part.size.y * 100)), color: part.color };
      uiControls.push(control);
      entity.components.push({ id: crypto.randomUUID(), type: 'uiCanvas', enabled: true, controlId: control.id, frame: false });
    }
    entities.push(entity);
  }
  if (!isSceneGraph(entities)) throw new Error('The build could not be converted to a valid scene.');
  for (const entity of entities) {
    const world = getWorldTransform(entities, entity.id)!;
    if (Object.values(world.scale).some((value) => !Number.isFinite(value) || value > 100) ||
        Object.values(world.position).some((value) => !Number.isFinite(value) || Math.abs(value) > 100_000)) {
      throw new Error('The build exceeds the editor’s safe scene limits.');
    }
  }
  return { rootId: root.id, entities, uiControls, plan };
}
