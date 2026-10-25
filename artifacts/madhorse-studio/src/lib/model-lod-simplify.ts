import { MeshoptSimplifier } from 'meshoptimizer';
export type ModelLodInput = { positions: Float32Array; indices: Uint32Array };
export async function simplifyModelLod(input: ModelLodInput): Promise<Uint32Array[]> {
  if (input.positions.length < 9 || input.indices.length < 3 || input.positions.length % 3 || input.indices.length % 3 ||
    input.positions.length / 3 > 100_000 || input.indices.length > 600_000) {
    throw new Error('Model exceeds automatic detail generation limits.');
  }
  if (!input.positions.every(Number.isFinite) ||
    input.indices.some(index => index >= input.positions.length / 3)) throw new Error('Invalid model geometry.');
  await MeshoptSimplifier.ready;
  if (!MeshoptSimplifier.supported) throw new Error('Mesh simplification is unavailable in this browser.');
  return [.5, .2].map(ratio => {
    const target = Math.max(3, Math.floor(input.indices.length * ratio / 3) * 3);
    // No permissive seam collapse: retain boundaries and restrict geometric error
    // to 0.5% of mesh extents. Target reductions are not guaranteed.
    return MeshoptSimplifier.simplify(input.indices, input.positions, 3, target, .005, ['LockBorder'])[0];
  });
}
