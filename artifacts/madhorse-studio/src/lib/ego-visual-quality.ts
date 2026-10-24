export const egoHighFidelityGuidance = [
  'VISUAL QUALITY: build polished, high-fidelity real-time game assets, not generic piles of primitives.',
  'Use clear real-world proportions, smooth silhouettes, purposeful bevels, layered named parts, coherent composition, and distinct foreground/midground/background.',
  'Use the current renderer-supported physically based material controls: plausible base colors, varied roughness, restrained metalness, readable glass/rubber/paint/stone/skin, and deliberate texture detail.',
  'Light each scene with a clear key/fill/rim direction, useful contact shadows, balanced exposure, and reflections only where the surface warrants them. Keep materials and geometry efficient for real-time play.',
  'Match the selected genre: kart racing uses a compact playful kart silhouette, bold readable colors, clear track boundaries and painted curbs; real-car racing uses believable road-car proportions, wheelbase, separate body/glass/rubber/metal surfaces, and realistic racing track detail.',
  'These are visual principles informed by Unity HDRP and Unreal Engine documentation; Madhorse uses its own renderer and must not claim it is running HDRP, Nanite, or Lumen.',
].join(' ');

export const egoGraphicsReferences = [
  {
    label: 'Unity HDRP · High-fidelity rendering overview',
    url: 'https://docs.unity3d.com/6000.1/Documentation/Manual/high-definition-render-pipeline.html',
  },
  {
    label: 'Unity HDRP · Lit materials',
    url: 'https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@17.1/manual/lit-material.html',
  },
  {
    label: 'Unreal Engine · Lumen global illumination and reflections',
    url: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/lumen-global-illumination-and-reflections-in-unreal-engine',
  },
  {
    label: 'Unreal Engine · Real-time rendering optimization',
    url: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/guidelines-for-optimizing-rendering-for-real-time-in-unreal-engine?lang=en-US',
  },
  {
    label: 'Unity · Animator Controllers',
    url: 'https://docs.unity3d.com/6000.5/Documentation/Manual/class-AnimatorController.html',
  },
  {
    label: 'Unreal Engine · Animation Blueprints',
    url: 'https://dev.epicgames.com/documentation/unreal-engine/animation-blueprints-in-unreal-engine?lang=en-US',
  },
];
