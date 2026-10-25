import { magentaModel } from './gpu-fixtures';

// Authored here rather than downloaded: one scalene triangle, no third-party
// assets, exporters, network dependencies, or loader mocks.
export function modelFixture(format: string) {
  const gltf = JSON.parse(magentaModel().buffer.toString());
  if (format === 'gltf') return magentaModel();
  if (format === 'glb') {
    const binary = Buffer.from(gltf.buffers[0].uri.split(',')[1], 'base64');
    delete gltf.buffers[0].uri;
    const json = Buffer.from(JSON.stringify(gltf));
    const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
    json.copy(padded);
    const header = Buffer.alloc(20);
    header.write('glTF');
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(28 + padded.length + binary.length, 8);
    header.writeUInt32LE(padded.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    const chunk = Buffer.alloc(8);
    chunk.writeUInt32LE(binary.length, 0);
    chunk.writeUInt32LE(0x004e4942, 4);
    return { name: 'gpu-triangle.glb', mimeType: 'model/gltf-binary', buffer: Buffer.concat([header, padded, chunk, binary]) };
  }
  const sources: Record<string, string> = {
    obj: 'o Triangle\nv -1 0 0 1 0 1\nv 1 0 0 1 0 1\nv -0.6 2 0 1 0 1\nf 1 2 3\n',
    fbx: `; FBX 7.4.0 project file
FBXHeaderExtension:  {
\tFBXVersion: 7400
}
Objects:  {
\tGeometry: 1, "Geometry::Triangle", "Mesh" {
\t\tVertices: *9 {
\t\t\ta: -1,0,0,1,0,0,-0.6,2,0
\t\t}
\t\tPolygonVertexIndex: *3 {
\t\t\ta: 0,1,-3
\t\t}
\t}
\tModel: 2, "Model::Triangle", "Mesh" {
\t\tVersion: 232
\t\tProperties70:  {
\t\t\tP: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1
\t\t}
\t}
\tMaterial: 3, "Material::Magenta", "" {
\t\tVersion: 102
\t\tShadingModel: "lambert"
\t\tProperties70:  {
\t\t\tP: "DiffuseColor", "Color", "", "A",0,0,0
\t\t\tP: "EmissiveColor", "Color", "", "A",1,0,1
\t\t}
\t}
}
Connections:  {
\tC: "OO",1,2
\tC: "OO",3,2
\tC: "OO",2,0
}
`,
    dae: `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <asset><unit meter="1" name="meter"/><up_axis>Y_UP</up_axis></asset>
  <library_effects><effect id="magenta"><profile_COMMON><technique sid="common">
    <lambert><diffuse><color>0 0 0 1</color></diffuse><emission><color>1 0 1 1</color></emission></lambert>
  </technique></profile_COMMON></effect></library_effects>
  <library_materials><material id="mat"><instance_effect url="#magenta"/></material></library_materials>
  <library_geometries><geometry id="triangle"><mesh>
    <source id="positions"><float_array id="positions-array" count="9">-1 0 0 1 0 0 -0.6 2 0</float_array>
      <technique_common><accessor source="#positions-array" count="3" stride="3">
        <param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/>
      </accessor></technique_common>
    </source>
    <vertices id="vertices"><input semantic="POSITION" source="#positions"/></vertices>
    <triangles count="1" material="surface"><input semantic="VERTEX" source="#vertices" offset="0"/><p>0 1 2</p></triangles>
  </mesh></geometry></library_geometries>
  <library_visual_scenes><visual_scene id="scene"><node id="node"><instance_geometry url="#triangle">
    <bind_material><technique_common><instance_material symbol="surface" target="#mat"/></technique_common></bind_material>
  </instance_geometry></node></visual_scene></library_visual_scenes>
  <scene><instance_visual_scene url="#scene"/></scene>
</COLLADA>`,
  };
  if (!sources[format]) throw new Error(`Unknown model fixture: ${format}`);
  return { name: `gpu-triangle.${format}`, mimeType: 'application/octet-stream', buffer: Buffer.from(sources[format]) };
}

/** A real local image dependency, resolved by basename from IndexedDB on reload. */
export function texturedModelFixture() {
  const gltf = JSON.parse(magentaModel().buffer.toString());
  gltf.images = [{ uri: 'textures/local%20magenta.png' }];
  gltf.textures = [{ source: 0 }];
  gltf.materials[0].pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1];
  gltf.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
  const positions = Buffer.from(gltf.buffers[0].uri.split(',')[1], 'base64');
  const uv = Buffer.alloc(24);
  [0, 0, 1, 0, .2, 1].forEach((v, i) => uv.writeFloatLE(v, i * 4));
  const bytes = Buffer.concat([positions, uv]);
  gltf.buffers[0] = { uri: `data:application/octet-stream;base64,${bytes.toString('base64')}`, byteLength: bytes.length };
  gltf.bufferViews.push({ buffer: 0, byteOffset: positions.length, byteLength: uv.length });
  gltf.accessors.push({ bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' });
  gltf.meshes[0].primitives[0].attributes.TEXCOORD_0 = 1;
  return { name: 'local-texture.gltf', mimeType: 'model/gltf+json', buffer: Buffer.from(JSON.stringify(gltf)) };
}
