import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Bundle into a temporary directory so the regression leaves no generated assets in Git.
const project = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'madhorse-modeling-'));
try {
  const result = await build({
    stdin: {
      resolveDir: project, loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import * as THREE from 'three';
        import {
          createModularCharacter, DEFAULT_CHARACTER_OPTIONS, documentMeshes, documentBones,
          normalizeVertexInfluence, appendRigBone, disposeModelingDocument,
        } from './src/lib/modeling-document';
        import { exportModelingDocument, importModelingFiles } from './src/lib/modeling-io';
        import { createExtrudedGeometry, createSubdividedGeometry } from './src/lib/modeling-mesh-edit';
        globalThis.ProgressEvent ??= class ProgressEvent extends Event {
          constructor(type, options = {}) { super(type); Object.assign(this, options); }
        };
        globalThis.FileReader = class {
          result = null; onloadend = null;
          readAsArrayBuffer(blob) {
            blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); });
          }
          readAsDataURL(blob) {
            blob.arrayBuffer().then(value => {
              this.result = 'data:' + blob.type + ';base64,' + Buffer.from(value).toString('base64');
              this.onloadend?.();
            });
          }
        };
        function validate(document) {
          assert(documentMeshes(document.root).length > 1);
          assert(documentBones(document.root).length >= 23);
          for (const mesh of documentMeshes(document.root)) {
            assert(mesh instanceof THREE.SkinnedMesh);
            const positions = mesh.geometry.getAttribute('position');
            const weights = mesh.geometry.getAttribute('skinWeight');
            const indices = mesh.geometry.getAttribute('skinIndex');
            assert.equal(positions.count, weights.count);
            for (let vertex = 0; vertex < positions.count; vertex++) {
              let total = 0;
              for (let channel = 0; channel < 4; channel++) {
                const weight = weights.array[vertex * 4 + channel];
                assert(Number.isFinite(weight) && weight >= 0);
                assert(indices.array[vertex * 4 + channel] < mesh.skeleton.bones.length);
                total += weight;
              }
              assert(Math.abs(total - 1) < .0001);
            }
          }
        }
        const document = createModularCharacter(DEFAULT_CHARACTER_OPTIONS);
        validate(document);
        const body = documentMeshes(document.root).find(mesh => mesh.name === 'Body_Smooth_Skin');
        const bodyPositions = body.geometry.getAttribute('position');
        let upperHeadWidth = 0;
        let bodyTop = -Infinity;
        for (let vertex = 0; vertex < bodyPositions.count; vertex++) {
          bodyTop = Math.max(bodyTop, bodyPositions.getY(vertex));
          if (bodyPositions.getY(vertex) > 1.6) upperHeadWidth = Math.max(upperHeadWidth, Math.abs(bodyPositions.getX(vertex)));
        }
        assert(upperHeadWidth > .03 && upperHeadWidth < .25,
          'The head must exist without a flat sampling-boundary strip spanning the arms');
        assert(bodyTop > 1.78 && bodyTop < 1.83, 'The generated body should include the full 1.8 m head height');
        assert(bodyPositions.count > 1000, 'The actual body surface should retain a smooth, detailed mesh');
        const bones = documentBones(document.root);
        const forearm = bones.find(bone => bone.name === 'LeftForeArm');
        const hand = bones.find(bone => bone.name === 'LeftHand');
        const positions = body.geometry.getAttribute('position');
        let vertex = 0, distance = Infinity;
        const handPoint = hand.getWorldPosition(new THREE.Vector3());
        for (let index = 0; index < positions.count; index++) {
          const next = new THREE.Vector3().fromBufferAttribute(positions, index).distanceTo(handPoint);
          if (next < distance) { distance = next; vertex = index; }
        }
        document.root.updateMatrixWorld(true); body.skeleton.update();
        const before = body.applyBoneTransform(vertex, new THREE.Vector3().fromBufferAttribute(positions, vertex));
        forearm.rotation.z = .5;
        document.root.updateMatrixWorld(true); body.skeleton.update();
        const after = body.applyBoneTransform(vertex, new THREE.Vector3().fromBufferAttribute(positions, vertex));
        assert(before.distanceTo(after) > .05, 'Bone rotation must actually deform the skin');
        forearm.rotation.z = 0;
        normalizeVertexInfluence(body, vertex, 0, .4);
        const added = appendRigBone(document.root, hand);
        assert.equal(documentBones(document.root).length, 24);
        added.undo(); assert.equal(documentBones(document.root).length, 23);
        added.redo(); assert.equal(documentBones(document.root).length, 24);
        validate(document);
        document.clips.push(new THREE.AnimationClip('Stored pose', 1, [
          new THREE.QuaternionKeyframeTrack(hand.uuid + '.quaternion', [0, 1], [...hand.quaternion.toArray(), ...hand.quaternion.toArray()]),
          new THREE.VectorKeyframeTrack(hand.uuid + '.position', [0, 1], [...hand.position.toArray(), ...hand.position.toArray()]),
        ]));
        const glb = await exportModelingDocument(document);
        assert(glb.size > 1000 && glb.name.endsWith('.glb'));
        const imported = await importModelingFiles([glb]);
        validate(imported);
        assert.equal(imported.clips.length, 3);
        assert.equal(documentBones(imported.root).length, 24);
        const json = await exportModelingDocument(document, false);
        const gltf = JSON.parse(await json.text());
        assert(gltf.buffers.every(buffer => buffer.uri.startsWith('data:')));
        const jsonImport = await importModelingFiles([json]);
        validate(jsonImport);
        const modular = createModularCharacter({
          ...DEFAULT_CHARACTER_OPTIONS, outfit: 'armor', boots: true, gloves: true,
          helmet: true, backpack: true, height: 2,
        });
        validate(modular);
        assert(documentMeshes(modular.root).length > documentMeshes(document.root).length);
        const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
        cubeGeometry.computeBoundingBox();
        const extruded = createExtrudedGeometry(cubeGeometry, [0], .25);
        assert.equal(extruded.index.count, cubeGeometry.index.count + 30,
          'A flat cube face should extrude both coplanar triangles and only four boundary walls');
        extruded.computeBoundingBox();
        assert(Math.max(
          extruded.boundingBox.max.x - cubeGeometry.boundingBox.max.x,
          extruded.boundingBox.max.y - cubeGeometry.boundingBox.max.y,
          extruded.boundingBox.max.z - cubeGeometry.boundingBox.max.z,
        ) > .2, 'Extruded geometry should extend beyond the original box');
        const divided = createSubdividedGeometry(cubeGeometry, [0]);
        assert.equal(divided.index.count, cubeGeometry.index.count + 9, 'Subdivision replaces one triangle with four');
        for (const geometry of [extruded, divided]) {
          const positions = geometry.getAttribute('position');
          const normals = geometry.getAttribute('normal');
          for (let index = 0; index < positions.count; index++) {
            assert([positions.getX(index), positions.getY(index), positions.getZ(index)].every(Number.isFinite));
            assert([normals.getX(index), normals.getY(index), normals.getZ(index)].every(Number.isFinite));
          }
          geometry.dispose();
        }
        cubeGeometry.dispose();
        const originalVertex = new THREE.Vector3().fromBufferAttribute(body.geometry.getAttribute('position'), 0);
        assert(Number.isFinite(originalVertex.y));
        await assert.rejects(() => importModelingFiles([new File(['not blender'], 'test.blend')]), /one .glb or .gltf/);
        const missing = {
          asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
          nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
          accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0,0,0], max: [1,1,1] }],
          bufferViews: [{ buffer: 0, byteLength: 36 }], buffers: [{ uri: 'missing.bin', byteLength: 36 }],
        };
        await assert.rejects(() => importModelingFiles([
          new File([JSON.stringify(missing)], 'missing.gltf'),
        ]), /Missing local resource/);
        [document, imported, jsonImport, modular].forEach(disposeModelingDocument);
        console.log('PASS: smooth rigged human, normalized skin weights, actual bone deformation, joint undo/redo, modular equipment, GLB and self-contained glTF round trips, clips, and invalid import handling.');
      `,
    },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'warning',
  });
  const output = join(directory, 'regression.mjs');
  await writeFile(output, result.outputFiles[0].contents);
  await import(pathToFileURL(output).href);
} finally {
  await rm(directory, { recursive: true, force: true });
}
