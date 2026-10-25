import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { installReflectionEnvironment } from '@/lib/physical-rendering';
import { publishDiagnostic } from '@/lib/system-diagnostics';

/** Local, prefiltered studio reflections: no remote HDR download or authored-material edits. */
export function ScenePhysicalLighting({ enabled, intensity }: { enabled: boolean; intensity: number }) {
  const { gl, scene, invalidate } = useThree();
  const [contextGeneration, setContextGeneration] = useState(0);
  const currentIntensity = useRef(intensity);
  currentIntensity.current = intensity;
  const environment = useRef<ReturnType<typeof installReflectionEnvironment> | null>(null);

  useEffect(() => {
    const restored = () => setContextGeneration(value => value + 1);
    gl.domElement.addEventListener('webglcontextrestored', restored);
    return () => gl.domElement.removeEventListener('webglcontextrestored', restored);
  }, [gl]);

  useEffect(() => {
    if (!enabled || gl.getContext().isContextLost() || scene.environment !== null) return;
    if (!gl.extensions.has('EXT_color_buffer_float')) {
      publishDiagnostic('rendering', 'warning',
        'Studio reflections need floating-point color-buffer support. Direct lighting remains available.');
      return;
    }
    try {
      environment.current = installReflectionEnvironment(scene, () => {
        const room = new RoomEnvironment();
        let generator: PMREMGenerator | undefined;
        try {
          generator = new PMREMGenerator(gl);
          return generator.fromScene(room, 0.04);
        } finally { generator?.dispose(); room.dispose(); }
      }, currentIntensity.current);
      invalidate();
    } catch (error) {
      publishDiagnostic('rendering', 'warning', 'Studio reflections could not be generated. Direct lighting remains available.',
        error instanceof Error ? error.message : 'The GPU could not create the reflection environment.');
    }
    return () => {
      environment.current?.dispose();
      environment.current = null;
      invalidate();
    };
  }, [enabled, gl, scene, invalidate, contextGeneration]);

  useEffect(() => {
    environment.current?.setIntensity(intensity);
    invalidate();
  }, [intensity, invalidate]);
  return null;
}
