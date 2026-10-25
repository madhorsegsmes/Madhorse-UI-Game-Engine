import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { observeWebGLContext, type SceneGraphicsFailure } from '@/lib/webgl-context';

export function SceneContextLifecycle({ onLost, onRestored }: {
  onLost: (failure: SceneGraphicsFailure) => void;
  onRestored: () => void;
}) {
  const { gl, invalidate } = useThree();
  useEffect(() => observeWebGLContext(gl.domElement, {
    onLost,
    onRestored: () => { invalidate(); onRestored(); },
  }), [gl, invalidate, onLost, onRestored]);
  return null;
}
