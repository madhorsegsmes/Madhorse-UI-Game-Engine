import { Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';

/** Editor-only depth cues: lighting, fog, ground, grid, world axes, orientation gizmo. */
export function SceneEditorEnvironment({ mobile }: { mobile: boolean }) {
  return (
    <>
      <fog attach="fog" args={['#1d1f22', 45, 150]} />
      <hemisphereLight args={['#d9dde2', '#2a2422', 0.9]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[7, 12, 6]} intensity={2.1} />
      <directionalLight position={[-7, 5, -8]} intensity={0.7} color="#b3c0cf" />
      {/* soft ground with contact pool under origin */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <circleGeometry args={[220, 48]} />
        <meshStandardMaterial color="#26282b" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[6, 32]} />
        <meshBasicMaterial color="#121314" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <Grid args={[160, 160]} cellSize={1} cellThickness={0.5} cellColor="#45494d" sectionSize={5}
        sectionThickness={1} sectionColor="#7d8185" fadeDistance={mobile ? 60 : 90} fadeStrength={1.4} infiniteGrid
        position={[0, -0.012, 0]} />
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
