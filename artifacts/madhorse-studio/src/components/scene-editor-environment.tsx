import { Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';

/** Editor-only depth cues: lighting, fog, ground, grid, world axes, orientation gizmo. */
export function SceneEditorEnvironment({ mobile, showGrid = true, studioLighting = true, exposure = 1 }: {
  mobile: boolean; showGrid?: boolean; studioLighting?: boolean; exposure?: number;
}) {
  return (
    <>
      <fog attach="fog" args={['#1d1f22', 45, 150]} />
      <hemisphereLight args={['#d9dde2', '#2a2422', (studioLighting ? 0.9 : 0.25) * exposure]} />
      <ambientLight intensity={(studioLighting ? 0.45 : 0.18) * exposure} />
      {studioLighting && <>
        <directionalLight position={[7, 12, 6]} intensity={2.1 * exposure}
          castShadow={!mobile} shadow-mapSize-width={2048} shadow-mapSize-height={2048}
          shadow-camera-left={-30} shadow-camera-right={30}
          shadow-camera-top={30} shadow-camera-bottom={-30}
          shadow-camera-near={.1} shadow-camera-far={100}
          shadow-bias={-.0002} shadow-normalBias={.035} />
        <directionalLight position={[-7, 5, -8]} intensity={0.7 * exposure} color="#b3c0cf" />
      </>}
      {/* soft ground with contact pool under origin */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <circleGeometry args={[220, 48]} />
        <meshStandardMaterial color="#26282b" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[6, 32]} />
        <meshBasicMaterial color="#121314" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {showGrid && <Grid args={[160, 160]} cellSize={1} cellThickness={0.8} cellColor="#727982" sectionSize={5}
        sectionThickness={1.3} sectionColor="#a4abb4" fadeDistance={mobile ? 60 : 90} fadeStrength={1.1} infiniteGrid
        position={[0, -0.012, 0]} />}
      <group position={[0, 0.012, 0]}>
        <AxisLine points={[[-60, 0, 0], [60, 0, 0]]} color="#c94b43" />
        <AxisLine points={[[0, 0, -60], [0, 0, 60]]} color="#638bc5" />
        <AxisLine points={[[0, 0, 0], [0, 4, 0]]} color="#72ae79" />
      </group>
      <GizmoHelper alignment="top-right" margin={mobile ? [48, 48] : [62, 62]}>
        <GizmoViewport axisColors={['#c94b43', '#72ae79', '#638bc5']} labelColor="#e4e1dc" axisHeadScale={mobile ? 0.85 : 1} />
      </GizmoHelper>
    </>
  );
}

function AxisLine({ points, color }: { points: [number, number, number][]; color: string }) {
  return <line>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(points.flat()), 3]} /></bufferGeometry>
    <lineBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} />
  </line>;
}
