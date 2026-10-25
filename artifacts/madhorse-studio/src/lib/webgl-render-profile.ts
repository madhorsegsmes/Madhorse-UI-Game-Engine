export type WebGLQuality = 'performance' | 'balanced' | 'high';

type WebGLRenderProfile = Readonly<{
  dpr: number | [number, number];
  antialias: boolean;
  shadows: boolean;
  powerPreference: 'low-power' | 'high-performance';
}>;

const profiles: Readonly<Record<WebGLQuality, Omit<WebGLRenderProfile, 'dpr'>>> = Object.freeze({
  performance: Object.freeze({ antialias: false, shadows: false, powerPreference: 'low-power' }),
  balanced: Object.freeze({ antialias: true, shadows: false, powerPreference: 'low-power' }),
  high: Object.freeze({ antialias: true, shadows: true, powerPreference: 'high-performance' }),
});

/** Converts the protected quality choice into options for the existing Three.js Canvas. */
export function getWebGLRenderProfile(quality: WebGLQuality, mobile: boolean): WebGLRenderProfile {
  if (mobile || quality === 'performance') {
    return { ...profiles[quality], dpr: 1, shadows: false, powerPreference: 'low-power' };
  }
  if (quality === 'balanced') return { ...profiles.balanced, dpr: [1, 1.5] };
  return { ...profiles.high, dpr: [1, 2] };
}
