import * as THREE from 'three';

/** Unit-bounded surfaces: the vehicle tool supplies their real-world dimensions.
 * The body has actual wheel-arch cutouts, rather than tires buried in a cube. */
export function createVehicleSurfaceGeometry(shape: 'coupe-body' | 'coupe-glazing' | 'coupe-grille') {
  if (shape === 'coupe-body') return createBody();
  if (shape === 'coupe-glazing') return createGlazing();
  const outline = new THREE.Shape();
  outline.moveTo(-.5, .26);
  outline.lineTo(-.4, -.5);
  outline.lineTo(.4, -.5);
  outline.lineTo(.5, .26);
  outline.lineTo(.42, .5);
  outline.lineTo(-.42, .5);
  outline.closePath();
  const geometry = new THREE.ExtrudeGeometry(outline, { depth: 1, bevelEnabled: false });
  geometry.translate(0, 0, -.5);
  return geometry;
}

function createBody() {
  // Native reference dimensions: 1.92 W, .72 body H, 4.8 L.
  const profile = new THREE.Shape();
  const archY = .39;
  const archRadius = .425;
  const bottom = .28;
  const angle = Math.asin((archY - bottom) / archRadius);
  const reach = Math.sqrt(archRadius ** 2 - (archY - bottom) ** 2);
  profile.moveTo(-2.35, bottom);
  for (const z of [-1.43, 1.43]) {
    profile.lineTo(z - reach, bottom);
    profile.absarc(z, archY, archRadius, Math.PI + angle, -angle, true);
  }
  profile.lineTo(2.35, bottom);
  profile.quadraticCurveTo(2.4, .35, 2.36, .72);
  profile.quadraticCurveTo(2.25, .91, 1.95, .94);
  profile.lineTo(.9, .97);
  profile.lineTo(-.68, .97);
  profile.lineTo(-1.94, .91);
  profile.quadraticCurveTo(-2.3, .88, -2.37, .74);
  profile.lineTo(-2.35, bottom);
  const geometry = new THREE.ExtrudeGeometry(profile, {
    depth: 1.82, steps: 1, bevelEnabled: true,
    bevelSegments: 5, bevelSize: .035, bevelThickness: .05, curveSegments: 32,
  });
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const z = positions.getX(i);
    const y = positions.getY(i);
    const across = positions.getZ(i) - .91;
    const noseTaper = 1 - Math.max(0, -z - 1.9) * .14;
    const tailTaper = 1 - Math.max(0, z - 1.95) * .08;
    positions.setXYZ(i, across * noseTaper * tailTaper, y, z);
  }
  // The axis permutation above is a reflection; reverse winding as well.
  const index = geometry.getIndex();
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, b);
    }
  } else {
    for (const name of Object.keys(geometry.attributes)) {
      const attribute = geometry.getAttribute(name) as THREE.BufferAttribute;
      for (let i = 0; i < attribute.count; i += 3) {
        for (let axis = 0; axis < attribute.itemSize; axis++) {
          const a = (i + 1) * attribute.itemSize + axis;
          const b = (i + 2) * attribute.itemSize + axis;
          const saved = attribute.array[a];
          attribute.array[a] = attribute.array[b];
          attribute.array[b] = saved;
        }
      }
    }
  }
  return normalize(geometry);
}

function createGlazing() {
  // A closed loft with a sloping windshield, tapered roof and rear fastback.
  const sections = [
    { z: -.74, y: .985, halfWidth: .81 },
    { z: -.6, y: 1.1, halfWidth: .78 },
    { z: -.16, y: 1.39, halfWidth: .65 },
    { z: .08, y: 1.415, halfWidth: .66 },
    { z: .63, y: 1.40, halfWidth: .67 },
    { z: .83, y: 1.33, halfWidth: .71 },
    { z: 1.27, y: .995, halfWidth: .82 },
  ];
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const section of sections) {
    // Cross-section perimeter: bottom left, top left, top right, bottom right.
    vertices.push(-.83, .97, section.z, -section.halfWidth, section.y, section.z,
      section.halfWidth, section.y, section.z, .83, .97, section.z);
  }
  for (let s = 0; s < sections.length - 1; s++) {
    for (let side = 0; side < 4; side++) {
      const a = s * 4 + side;
      const b = s * 4 + (side + 1) % 4;
      const c = b + 4;
      const d = a + 4;
      indices.push(a, c, b, a, d, c);
    }
  }
  indices.push(0, 1, 2, 0, 2, 3);
  const end = (sections.length - 1) * 4;
  indices.push(end, end + 2, end + 1, end, end + 3, end + 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  return normalize(geometry);
}

function normalize(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(1 / size.x, 1 / size.y, 1 / size.z);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
