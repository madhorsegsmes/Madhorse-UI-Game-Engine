import * as THREE from 'three';
import { acquireModelLod, modelLodEligibility } from './model-lod-geometry';
import { chooseModelLod, type ModelLodSettings } from './model-lod-settings';
import { setModelLodReport, type ModelLodReport } from './model-lod-report';
const cameraPosition = new THREE.Vector3();
const triangleCount = (geometry: THREE.BufferGeometry) =>
  (geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0) / 3;

export function projectedModelCoverage(camera: THREE.Camera, sphere: THREE.Sphere): number {
  if (camera instanceof THREE.OrthographicCamera) return sphere.radius * 2 / ((camera.top - camera.bottom) / camera.zoom);
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.getWorldPosition(cameraPosition);
    const distance = cameraPosition.distanceTo(sphere.center);
    if (distance <= sphere.radius) return Infinity;
    return sphere.radius / (distance * Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV() / 2)));
  }
  return Infinity;
}
export class ModelLodController {
  private disposed = false;
  private level = 0;
  private localSphere = new THREE.Sphere();
  private sphere = new THREE.Sphere();
  private entries: { mesh: THREE.Mesh; original: THREE.BufferGeometry; levels: THREE.BufferGeometry[] }[] = [];
  private leases: ReturnType<typeof acquireModelLod>[] = [];
  private report: ModelLodReport;
  constructor(private root: THREE.Object3D, private id: string, assetId: string) {
    let fullTriangles = 0;
    root.traverse(item => { if ((item as THREE.Mesh).isMesh) fullTriangles += triangleCount((item as THREE.Mesh).geometry); });
    this.report = { assetId, phase: 'preparing', fullTriangles, mediumTriangles: fullTriangles,
      lowTriangles: fullTriangles, activeLevel: 0, message: 'Preparing distant detail in a background worker…' };
  }
  async prepare() {
    const meshes: THREE.Mesh[] = [];
    this.root.traverse(item => { if ((item as THREE.Mesh).isMesh) meshes.push(item as THREE.Mesh); });
    if (meshes.some(mesh => (mesh as THREE.SkinnedMesh).isSkinnedMesh ||
      Object.values(mesh.geometry.morphAttributes).some(values => values.length))) {
      this.report = { ...this.report, phase: 'full-detail', message: 'Skinned/morph models remain at original detail to protect animation.' };
      setModelLodReport(this.id, this.report);
      return;
    }
    setModelLodReport(this.id, this.report);
    this.root.updateWorldMatrix(true, true);
    new THREE.Box3().setFromObject(this.root).getBoundingSphere(this.localSphere);
    this.localSphere.applyMatrix4(this.root.matrixWorld.clone().invert());
    const reasons: string[] = [];
    const pending: Promise<void>[] = [];
    for (const mesh of meshes) {
      if (this.disposed) return;
      const reason = modelLodEligibility(mesh);
      if (reason) { reasons.push(reason); continue; }
      const original = mesh.geometry;
      const lease = acquireModelLod(original);
      this.leases.push(lease);
      pending.push(lease.ready.then(levels => {
        if (!this.disposed) this.entries.push({ mesh, original, levels });
      }).catch(error => { reasons.push(error instanceof Error ? error.message : 'Detail generation unavailable.'); }));
      // Avoid copying inputs for a whole model synchronously on the UI thread.
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    await Promise.all(pending);
    if (this.disposed) return;
    let mediumTriangles = this.report.fullTriangles, lowTriangles = mediumTriangles;
    for (const entry of this.entries) {
      mediumTriangles += triangleCount(entry.levels[1]) - triangleCount(entry.original);
      lowTriangles += triangleCount(entry.levels[2]) - triangleCount(entry.original);
    }
    this.report = { ...this.report, mediumTriangles, lowTriangles,
      phase: this.entries.length ? 'ready' : 'full-detail',
      message: this.entries.length
        ? `${this.entries.length} mesh(es) optimized. ${reasons.length ? 'Other meshes retain original detail.' : 'Original geometry is preserved.'}`
        : reasons[0] ?? 'No supported meshes to optimize.' };
    setModelLodReport(this.id, this.report);
  }
  update(camera: THREE.Camera, settings: ModelLodSettings, forceFull: boolean) {
    if (this.report.phase !== 'ready' || !this.entries.length || this.disposed) return;
    this.root.updateWorldMatrix(true, false);
    this.sphere.copy(this.localSphere).applyMatrix4(this.root.matrixWorld);
    const level = forceFull ? 0 : chooseModelLod(projectedModelCoverage(camera, this.sphere), this.level, settings);
    if (level === this.level) return;
    this.level = level;
    for (const entry of this.entries) entry.mesh.geometry = entry.levels[level];
    this.report = { ...this.report, activeLevel: level };
    setModelLodReport(this.id, this.report);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of this.entries) entry.mesh.geometry = entry.original;
    this.leases.forEach(lease => lease.release());
    this.entries = []; this.leases = [];
    this.report = { ...this.report, phase: 'full-detail', activeLevel: 0,
      message: 'Automatic detail inactive; original geometry restored.' };
    setModelLodReport(this.id, this.report);
  }
  fail(error: unknown) {
    if (this.disposed) return;
    this.dispose();
    this.report = { ...this.report, phase: 'full-detail', activeLevel: 0,
      message: error instanceof Error ? error.message : 'Automatic detail unavailable; original geometry retained.' };
    setModelLodReport(this.id, this.report);
  }
}
