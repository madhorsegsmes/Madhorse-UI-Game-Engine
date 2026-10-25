import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SVGRenderer } from 'three/examples/jsm/renderers/SVGRenderer.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { getCamera, getEffect, getLight, getModelRenderer, getPrimitive, getSkybox, getSpriteRenderer, getUICanvas, getWorldTransform, type SceneEntity } from '@/lib/scene-model';
import { createPrimitiveGeometry, sceneEditorFramePose } from '@/lib/scene-view-geometry';
import type { SceneFocus } from '@/lib/scene-view-geometry';
import { createCharacterBodyMesh, isCharacterBodySurfacePart, isCharacterBuilderModelRoot } from '@/lib/character-builder-geometry';
import { makeGameViewCamera, type GameCamera } from '@/lib/game-camera';
import type { SceneRenderSettings } from '@/hooks/use-scene-render-settings';
import { fighterVisualMode, isFighterEntity } from '@/lib/fighter-visual';

const noAssetUrls: Record<string, string> = {};

function makeSceneCamera(source: GameCamera, aspect: number) {
  const camera = new THREE.PerspectiveCamera(source.fov || 50, aspect, 0.1, 24);
  camera.position.set(source.position.x, source.position.y, source.position.z);
  if (source.rotation) {
    camera.rotation.set(
      THREE.MathUtils.degToRad(source.rotation.x),
      THREE.MathUtils.degToRad(source.rotation.y),
      THREE.MathUtils.degToRad(source.rotation.z),
    );
  } else {
    camera.lookAt(source.target.x, source.target.y, source.target.z);
  }
  return camera;
}

export function SceneRenderFallback({
  entities, camera, settings, zoom, sceneFocus, gameView = false, detail = 'full', assetUrls = noAssetUrls,
}: {
  entities: SceneEntity[];
  camera?: GameCamera;
  settings: SceneRenderSettings;
  zoom: number;
  sceneFocus: SceneFocus | null;
  gameView?: boolean;
  detail?: 'full' | 'thumbnail';
  assetUrls?: Record<string, string>;
  selectedEntityId: string | null;
  onSelectEntity: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const hasCube = entities.some((entity) => entity.active && getPrimitive(entity)?.shape === 'cube');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const sky = entities.filter(entity => entity.active).map(getSkybox).find(component => component?.enabled);
    const background = sky?.color ?? settings.background;
    scene.background = new THREE.Color(background);
    const viewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const renderer = new SVGRenderer();
    renderer.setQuality('high');
    renderer.setClearColor(new THREE.Color(background), 1);
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', 'Rendered 3D scene with solid mesh geometry');
    renderer.domElement.dataset.testid = 'scene3d-software-renderer';

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const exposure = settings.exposure;

    scene.add(new THREE.AmbientLight('#d5d9df', exposure * (settings.studioLighting ? 0.55 : 0.3)));
    if (settings.studioLighting) {
      const key = new THREE.DirectionalLight('#fff3dd', 1.05 * exposure);
      key.position.set(7, 12, 6);
      scene.add(key);
      const fill = new THREE.DirectionalLight('#9daec4', 0.75 * exposure);
      fill.position.set(-7, 5, -8);
      scene.add(fill);
    }
    if (settings.showGrid) {
      const grid = new THREE.GridHelper(160, 160, '#a4abb4', '#727982');
      grid.position.y = -0.012;
      const gridMaterial = grid.material as THREE.Material;
      gridMaterial.transparent = true;
      gridMaterial.opacity = 0.62;
      scene.add(grid);
      if (grid.geometry) geometries.add(grid.geometry);
      if (Array.isArray(grid.material)) grid.material.forEach((material) => materials.add(material));
      else materials.add(grid.material);
      const axes = new THREE.AxesHelper(3);
      scene.add(axes);
      geometries.add(axes.geometry);
      if (Array.isArray(axes.material)) axes.material.forEach((material) => materials.add(material));
      else materials.add(axes.material);
    }

    const replacedFighters = entities.filter(entity => {
      const model = getModelRenderer(entity);
      return (isFighterEntity(entity) && fighterVisualMode(entity) !== 'default') || Boolean(model?.enabled && model.assetId);
    });
    const hiddenParts = new Set<string>();
    const replacedIds = new Set(replacedFighters.map(entity => entity.id));
    const byId = new Map(entities.map(entity => [entity.id, entity]));
    for (const entity of entities) {
      let ancestor = entity.parentId;
      const visited = new Set<string>();
      while (ancestor && !visited.has(ancestor)) {
        if (replacedIds.has(ancestor)) { hiddenParts.add(entity.id); break; }
        visited.add(ancestor);
        ancestor = byId.get(ancestor)?.parentId ?? null;
      }
    }
    const characterRootIds = new Set(
      entities.filter(isCharacterBuilderModelRoot).map((entity) => entity.id),
    );
    for (const root of entities.filter(isCharacterBuilderModelRoot)) {
      if (replacedIds.has(root.id) || !root.active) continue;
      const bodyParts = entities.filter((entity) => entity.parentId === root.id);
      const body = createCharacterBodyMesh(bodyParts, detail === 'thumbnail'
        ? { resolution: 24, maxTriangles: 5000 }
        : undefined);
      const transform = getWorldTransform(entities, root.id);
      if (!body || !transform) continue;
      const assembly = new THREE.Group();
      assembly.position.set(
        (transform.position.x - 50) / 10,
        transform.position.z / 10,
        (transform.position.y - 50) / 10,
      );
      assembly.rotation.set(
        THREE.MathUtils.degToRad(-transform.rotation.x),
        THREE.MathUtils.degToRad(-transform.rotation.z),
        THREE.MathUtils.degToRad(-transform.rotation.y),
        'XYZ',
      );
      assembly.scale.set(transform.scale.x, transform.scale.z, transform.scale.y);
      const bodyPart = bodyParts.find(isCharacterBodySurfacePart);
      const bodyColor = bodyPart ? getPrimitive(bodyPart)?.color ?? '#d5a07d' : '#d5a07d';
      const material = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.68 });
      const bodyMesh = new THREE.Mesh(body.geometry, material);
      bodyMesh.position.copy(body.center);
      bodyMesh.scale.copy(body.halfExtents);
      assembly.add(bodyMesh);
      scene.add(assembly);
      geometries.add(body.geometry);
      materials.add(material);
    }

    for (const entity of entities) {
      if (!entity.active || entity.isGroup || getSkybox(entity) || hiddenParts.has(entity.id) || replacedIds.has(entity.id)) continue;
      const isUnifiedBodyPart = Boolean(
        entity.parentId
        && characterRootIds.has(entity.parentId)
        && isCharacterBodySurfacePart(entity),
      );
      if (isUnifiedBodyPart) continue;
      const transform = getWorldTransform(entities, entity.id);
      if (!transform) continue;
      const object = new THREE.Group();
      object.position.set(
        (transform.position.x - 50) / 10,
        transform.position.z / 10,
        (transform.position.y - 50) / 10,
      );
      object.rotation.set(
        THREE.MathUtils.degToRad(-transform.rotation.x),
        THREE.MathUtils.degToRad(-transform.rotation.z),
        THREE.MathUtils.degToRad(-transform.rotation.y),
        'XYZ',
      );
      object.scale.set(transform.scale.x, transform.scale.z, transform.scale.y);
      object.name = entity.name;
      scene.add(object);

      const primitive = getPrimitive(entity);
      const effect = getEffect(entity);
      if (primitive?.enabled) {
        // Thumbnail tessellation changes only this small software render, never
        // the editable source models or their full-detail WebGL geometry.
        const geometry = detail === 'thumbnail' && primitive.shape === 'sphere'
          ? new THREE.SphereGeometry(.5, 12, 8)
          : detail === 'thumbnail' && primitive.shape === 'rounded-cube'
            ? transform.scale.x > 4 && transform.scale.z < 1
              // Small floor tiles let SVG's depth sorter put feet in front of
              // the ground, rather than one large triangle painting over legs.
              ? new THREE.BoxGeometry(1, 1, 1, 16, 1, 16)
              : new RoundedBoxGeometry(1, 1, 1, 1, .08)
            : createPrimitiveGeometry(primitive.shape, primitive.terrainSettings, primitive.terrainEdits);
        const material = new THREE.MeshStandardMaterial({
          color: primitive.color,
          roughness: primitive.roughness ?? 0.58,
          metalness: primitive.metalness ?? 0.08,
          transparent: (primitive.opacity ?? 1) < 1,
          opacity: primitive.opacity ?? 1,
          side: THREE.DoubleSide,
        });
        object.add(new THREE.Mesh(geometry, material));
        if (primitive.shape === 'cube') {
          const edgeGeometry = new THREE.EdgesGeometry(geometry);
          const edgeMaterial = new THREE.LineBasicMaterial({ color: '#6a737c', transparent: true, opacity: 0.85 });
          object.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));
          geometries.add(edgeGeometry);
          materials.add(edgeMaterial);
        }
        geometries.add(geometry);
        materials.add(material);
      } else if (effect?.enabled) {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.32, 12, 8),
          new THREE.MeshBasicMaterial({ color: effect.color, wireframe: true, transparent: true, opacity: 0.85 }),
        );
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.48, 0.025, 6, 24),
          new THREE.MeshBasicMaterial({ color: effect.color, transparent: true, opacity: Math.min(1, effect.intensity / 2) }),
        );
        ring.rotation.x = Math.PI / 2;
        object.add(marker, ring);
        geometries.add(marker.geometry);
        materials.add(marker.material);
        geometries.add(ring.geometry);
        materials.add(ring.material);
      } else {
        const uiCanvas = getUICanvas(entity);
        const sprite = getSpriteRenderer(entity);
        if (uiCanvas?.enabled) {
          const dimensions = uiCanvas.kind === 'bar' ? [3.2, .42]
            : uiCanvas.kind === 'button' ? [1.2, .55]
              : uiCanvas.kind === 'panel' ? [2.4, 1.4] : [3.2, 1.8];
          const geometry = new THREE.PlaneGeometry(dimensions[0], dimensions[1]);
          geometry.rotateX(-Math.PI / 2);
          const color = uiCanvas.kind === 'button' ? '#e89bf2'
            : uiCanvas.kind === 'bar' ? '#cf83e8'
              : uiCanvas.kind === 'panel' ? '#a986e2' : '#72a7ad';
          const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, wireframe: true });
          object.add(new THREE.Mesh(geometry, material));
          geometries.add(geometry);
          materials.add(material);
        } else if (sprite?.enabled) {
          const geometry = new THREE.PlaneGeometry(
            Math.max(0.1, sprite.width / 10),
            Math.max(0.1, sprite.height / 10),
          );
          geometry.rotateX(-Math.PI / 2);
          const material = new THREE.MeshBasicMaterial({ color: sprite.tint, side: THREE.DoubleSide, transparent: true, opacity: 0.08 });
          object.add(new THREE.Mesh(geometry, material));
          geometries.add(geometry);
          materials.add(material);
        } else if (!getCamera(entity) && !getLight(entity)) {
          const geometry = new THREE.BoxGeometry(1, 1, 1);
          const material = new THREE.MeshStandardMaterial({ color: '#aab0b4', roughness: 0.68 });
          object.add(new THREE.Mesh(geometry, material));
          geometries.add(geometry);
          materials.add(material);
        }
      }

      const cameraComponent = getCamera(entity);
      if (cameraComponent?.enabled) {
        const entityCamera = new THREE.PerspectiveCamera(cameraComponent.fov, 16 / 9, 0.1, 8);
        entityCamera.position.copy(object.position);
        if (cameraComponent.useTransformRotation) {
          entityCamera.rotation.copy(object.rotation);
        } else {
          entityCamera.lookAt(
            cameraComponent.target.x,
            cameraComponent.target.y,
            cameraComponent.target.z,
          );
        }
        const helper = new THREE.CameraHelper(entityCamera);
        scene.add(helper);
        geometries.add(helper.geometry);
        if (Array.isArray(helper.material)) helper.material.forEach((material) => materials.add(material));
        else materials.add(helper.material);
      }
    }

    const mainCamera = camera ?? {
      position: { x: 0, y: 6, z: -8 },
      target: { x: 0, y: 0, z: 0 },
      fov: 50,
    };
    if (!gameView) {
      const cameraMarker = new THREE.CameraHelper(makeSceneCamera(mainCamera, 16 / 9));
      scene.add(cameraMarker);
      geometries.add(cameraMarker.geometry);
      if (Array.isArray(cameraMarker.material)) cameraMarker.material.forEach((material) => materials.add(material));
      else materials.add(cameraMarker.material);
    }

    const draw = () => {
      if (!host.isConnected) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height);
      if (gameView) {
        // Use the same lens and pose as WebGL, not the editor's elevated orbit.
        viewCamera.copy(makeGameViewCamera(mainCamera, width / height));
      } else {
        viewCamera.aspect = width / height;
        viewCamera.updateProjectionMatrix();
        const pose = sceneEditorFramePose(mainCamera, width / height, zoom, sceneFocus, viewCamera.fov);
        viewCamera.position.set(pose.position.x, pose.position.y, pose.position.z);
        viewCamera.lookAt(pose.target.x, pose.target.y, pose.target.z);
      }
      viewCamera.updateMatrixWorld();
      renderer.render(scene, viewCamera);
      // SVGRenderer cannot texture meshes. Project image assets explicitly so
      // 2D replacement fighters remain visible even without a WebGL context.
      for (const fighter of replacedFighters) {
        if (!fighter.active) continue;
        const transform = getWorldTransform(entities, fighter.id);
        if (!transform) continue;
        const sprite = getSpriteRenderer(fighter);
        const imageMode = fighterVisualMode(fighter) === 'sprite' && sprite;
        const heightMeters = imageMode ? sprite.height / 10 * transform.scale.z : 1.8 * transform.scale.z;
        const widthMeters = imageMode ? sprite.width / 10 * transform.scale.x : 1 * transform.scale.x;
        const center = new THREE.Vector3((transform.position.x - 50) / 10,
          transform.position.z / 10 + heightMeters / 2, (transform.position.y - 50) / 10);
        const depth = -center.clone().applyMatrix4(viewCamera.matrixWorldInverse).z;
        if (depth <= viewCamera.near) continue;
        const point = center.project(viewCamera);
        const pixelWidth = widthMeters * viewCamera.projectionMatrix.elements[0] / depth * width / 2;
        const pixelHeight = heightMeters * viewCamera.projectionMatrix.elements[5] / depth * height / 2;
        const url = imageMode && sprite.assetId ? assetUrls[sprite.assetId] : undefined;
        if (url) {
          const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
          image.setAttribute('href', url);
          image.setAttribute('x', String(point.x * width / 2 - pixelWidth / 2));
          image.setAttribute('y', String(-point.y * height / 2 - pixelHeight / 2));
          image.setAttribute('width', String(pixelWidth));
          image.setAttribute('height', String(pixelHeight));
          image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          image.dataset.entityId = fighter.id;
          renderer.domElement.append(image);
        } else {
          const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          label.setAttribute('x', String(point.x * width / 2));
          label.setAttribute('y', String(-point.y * height / 2));
          label.setAttribute('fill', '#e9c8a2');
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('font-size', '10');
          label.textContent = imageMode ? 'Fighter image unavailable' : '3D model · WebGL required';
          renderer.domElement.append(label);
        }
      }
      renderer.domElement.dataset.renderedFaces = String(renderer.info.render.faces);
      if (renderer.domElement.parentElement !== host) {
        host.replaceChildren(renderer.domElement);
      }
    };

    const observer = new ResizeObserver(draw);
    observer.observe(host);
    draw();
    return () => {
      observer.disconnect();
      renderer.domElement.remove();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    };
  }, [assetUrls, camera, detail, entities, gameView, sceneFocus, settings, zoom]);

  return (
    <div className="mh-scene3d__soft-preview" data-testid="scene3d-soft-preview">
      <div ref={hostRef} className="mh-scene3d__software-canvas" />
      {!gameView && hasCube && <span className="mh-scene3d__geometry-note" data-testid="scene3d-soft-object-starter-cube">
        Cube · solid 3D box mesh
      </span>}
      {!gameView && camera && <span className="mh-scene3d__software-camera" data-testid="scene3d-soft-camera">
        Main Camera · 3D frustum
      </span>}
      <span className="mh-scene3d__soft-note">SOFTWARE 3D PREVIEW · SVG MESH RENDERER</span>
    </div>
  );
}
