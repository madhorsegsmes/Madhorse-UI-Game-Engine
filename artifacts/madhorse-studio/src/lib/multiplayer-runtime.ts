import type {
  MultiplayerPluginComponent,
  SceneEntity,
} from "./scene-model";
import type {
  MultiplayerRoomSnapshot,
  MultiplayerRoomUpdate,
} from "./multiplayer-client";
import type { MultiplayerTransform } from "@workspace/api-zod";

function multiplayerComponent(entity: SceneEntity, mode: MultiplayerPluginComponent["mode"]) {
  return entity.components.find((component): component is MultiplayerPluginComponent =>
    component.type === "multiplayerPlugin" && component.enabled && component.mode === mode,
  );
}

function transformOf(entity: SceneEntity): MultiplayerTransform {
  const transform = entity.components.find(component => component.type === "transform");
  return {
    position: transform ? { ...transform.position } : { x: 0, y: 0, z: 0 },
    rotation: transform ? { ...transform.rotation } : { x: 0, y: 0, z: 0 },
    scale: transform ? { ...transform.scale } : { x: 1, y: 1, z: 1 },
  };
}

export function createMultiplayerUpdate(
  entities: SceneEntity[],
  playing: boolean,
  isHost = true,
): MultiplayerRoomUpdate {
  if (!playing) return { playerTransform: null, objects: [] };
  const player = entities.find(entity => entity.active && multiplayerComponent(entity, "player"));
  const objects = entities
    .filter(entity => isHost && entity.active && multiplayerComponent(entity, "object"))
    .slice(0, 256)
    .map(entity => ({ entityId: entity.id, transform: transformOf(entity) }));
  return {
    playerTransform: player ? transformOf(player) : null,
    objects,
  };
}

function withTransform(entity: SceneEntity, value: MultiplayerTransform): SceneEntity {
  return {
    ...entity,
    components: entity.components.map(component => component.type === "transform"
      ? {
        ...component,
        position: { ...value.position },
        rotation: { ...value.rotation },
        scale: { ...value.scale },
      }
      : component),
  };
}

function remotePlayerEntity(template: SceneEntity, player: MultiplayerRoomSnapshot["players"][number]): SceneEntity | null {
  if (!player.transform) return null;
  const visualComponents = template.components.filter(component =>
    component.type === "transform" ||
    component.type === "primitive" ||
    component.type === "modelRenderer" ||
    component.type === "spriteRenderer" ||
    component.type === "effect" ||
    component.type === "light",
  );
  const components = visualComponents.map(component => {
    const id = `remote:${player.id}:${component.id}`;
    return component.type === "transform"
      ? { ...component, id, position: { ...player.transform!.position }, rotation: { ...player.transform!.rotation }, scale: { ...player.transform!.scale } }
      : { ...component, id };
  });
  return {
    ...template,
    id: `multiplayer-peer:${player.id}`,
    name: `${player.name} (Remote)`,
    parentId: null,
    active: true,
    components,
  };
}

export function applyMultiplayerSnapshot(
  liveEntities: SceneEntity[],
  snapshot: MultiplayerRoomSnapshot | null,
  localPlayerId: string | null,
  isHost = false,
): SceneEntity[] {
  const withoutRemotePlayers = liveEntities.filter(entity => !entity.id.startsWith("multiplayer-peer:"));
  if (!snapshot) return withoutRemotePlayers;

  const objectTransforms = new Map(snapshot.objects.map(object => [object.entityId, object.transform]));
  const withRemoteObjects = withoutRemotePlayers.map(entity => {
    if (isHost || !multiplayerComponent(entity, "object")) return entity;
    const synced = objectTransforms.get(entity.id);
    return synced ? withTransform(entity, synced) : entity;
  });

  const playerTemplate = withRemoteObjects.find(entity => multiplayerComponent(entity, "player"));
  if (!playerTemplate) return withRemoteObjects;
  const remotePlayers = snapshot.players
    .filter(player => player.id !== localPlayerId && player.transform)
    .map(player => remotePlayerEntity(playerTemplate, player))
    .filter((entity): entity is SceneEntity => entity !== null);
  return [...withRemoteObjects, ...remotePlayers];
}
