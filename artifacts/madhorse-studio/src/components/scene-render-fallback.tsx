import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SVGRenderer } from 'three/examples/jsm/renderers/SVGRenderer.js';
import { getCamera, getEffect, getLight, getPrimitive, getSpriteRenderer, getUICanvas, getWorldTransform, type SceneEntity } from '@/lib/scene-model';
import { createPrimitiveGeometry } from '@/lib/scene-view-geometry';
import type { SceneFocus } from '@/lib/scene-view-geometry';
import { createCharacterBodyMesh, isCharacterBodySurfacePart, isCharacterBuilderModelRoot } from '@/lib/character-builder-geometry';
import type { GameCamera } from '@/lib/game-camera';
import type { SceneRenderSettings } from '@/hooks/use-scene-render-settings';

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
  entities, camera, settings, zoom, sceneFocus,
}: {
  entities: SceneEntity[];
  camera?: GameCamera;
  settings: SceneRenderSettings;
  zoom: number;
  sceneFocus: SceneFocus | null;
  selectedEntityId: string | null;
  onSelectEntity: (id: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const hasCube = entities.some((entity) => entity.active && getPrimitive(entity)?.shape === 'cube');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(settings.background);
    const viewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const renderer = new SVGRenderer();
    renderer.setQuality('high');
    renderer.setClearColor(new THREE.Color(settings.background), 1);
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

    const characterRootIds = new Set(
      entities.filter(isCharacterBuilderModelRoot).map((entity) => entity.id),
    );
    for (const root of entities.filter(isCharacterBuilderModelRoot)) {
      const bodyParts = entities.filter((entity) => entity.parentId === root.id);
      const body = createCharacterBodyMesh(bodyParts);
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
      const material = new THREE.MeshStandardMaterial({ color: '#d5a07d', roughness: 0.68 });
      const bodyMesh = new THREE.Mesh(body.geometry, material);
      bodyMesh.position.copy(body.center);
      bodyMesh.scale.copy(body.halfExtents);
      assembly.add(bodyMesh);
      scene.add(assembly);
      geometries.add(body.geometry);
      materials.add(material);
    }

    for (const entity of entities) {
      if (!entity.active || entity.isGroup) continue;
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
        const geometry = createPrimitiveGeometry(primitive.shape, primitive.terrainSettings);
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
    const cameraMarker = new THREE.CameraHelper(makeSceneCamera(mainCamera, 16 / 9));
    scene.add(cameraMarker);
    geometries.add(cameraMarker.geometry);
    if (Array.isArray(cameraMarker.material)) cameraMarker.material.forEach((material) => materials.add(material));
    else materials.add(cameraMarker.material);

    const draw = () => {
      if (!host.isConnected) return;
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height);
      viewCamera.aspect = width / height;
      viewCamera.updateProjectionMatrix();
      const distance = 5.5 * (100 / Math.max(30, zoom));
      const target = sceneFocus
        ? new THREE.Vector3(sceneFocus.center.x, sceneFocus.center.y, sceneFocus.center.z)
        : new THREE.Vector3(0, 0, 0);
      viewCamera.position.set(
        target.x + distance * 0.58,
        target.y + distance * 0.52,
        target.z + distance * 0.63,
      );
      viewCamera.lookAt(target);
      renderer.render(scene, viewCamera);
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
  }, [camera, entities, sceneFocus, settings, zoom]);

  return (
    <div className="mh-scene3d__soft-preview" data-testid="scene3d-soft-preview">
      <div ref={hostRef} className="mh-scene3d__software-canvas" />
      {hasCube && <span className="mh-scene3d__geometry-note" data-testid="scene3d-soft-object-starter-cube">
        Cube · solid 3D box mesh
      </span>}
      {camera && <span className="mh-scene3d__software-camera" data-testid="scene3d-soft-camera">
        Main Camera · 3D frustum
      </span>}
      <span className="mh-scene3d__soft-note">SOFTWARE 3D PREVIEW · SVG MESH RENDERER</span>
    </div>
  );
}
