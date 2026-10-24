# Unity and Unreal Editor Tools, Performance, and Madhorse

**Protected system reference · Read-only**

This guide summarizes public Unity and Unreal Engine documentation and maps the
most useful editor and performance practices to Madhorse Studio. These products
have many version-specific windows, packages, and third-party plugins; this is a
catalog of their main tool families, not a claim that Madhorse contains every
Unity or Unreal feature.

## Core editor tool families

### Unity

- **Scene and Game views:** inspect and edit a level, then preview what a player
  camera will show.
- **Hierarchy and Inspector:** organize scene objects; inspect and edit the
  selected object's components and properties.
- **Project and asset tools:** import, organize, reuse, and configure project
  assets and prefabs.
- **Scene authoring:** transform tools, terrain tools, lighting, cameras,
  physics, UI, animation, and timeline workflows.
- **Profiler and Frame Debugger:** inspect CPU, GPU, memory, rendering, and
  frame-level draw events; compare measured costs before and after a change.

### Unreal Engine

- **Level Editor and viewport:** navigate and author the active world.
- **World Outliner and Details:** organize actors and inspect the selected
  actor's transform, mesh, rendering, and physics properties.
- **Content Browser:** import, organize, view, and manage project assets.
- **Authoring modes:** selection and transforms, Landscape, Modeling, foliage,
  mesh paint, fracture, and related level-building tools.
- **Sequencer, Niagara, and Blueprints:** author cinematic timelines, effects,
  and visual gameplay logic.
- **Unreal Insights and stat commands:** capture traces and inspect frame,
  CPU/GPU, memory, and asset-loading costs.

## Shared performance principles

1. **Measure before tuning.** Identify whether the bottleneck is CPU, GPU,
   memory, loading, or the target device. A change that helps one bottleneck can
   make another worse.
2. **Test the actual target.** Desktop and mobile browsers have different GPU,
   memory, battery, and WebGL limits. A desktop preview is not a mobile
   benchmark.
3. **Control rendering work.** Avoid drawing invisible or distant objects;
   later Madhorse stages can add frustum/occlusion culling, level of detail,
   instancing, and asset streaming.
4. **Offer quality budgets.** Let creators trade pixel density for smoothness
   without changing their saved scene.
5. **Keep the editor idle when nothing changes.** Static editing views should
   render on demand; animation and game preview need continuous frames.
6. **Report what is actually measurable.** WebGL draw calls, triangles,
   geometries, and textures are useful counters. Browser frame interval is not
   a GPU-time measurement; GPU timing needs supported browser extensions and
   hardware.
7. **Keep fallback behavior local.** If WebGL is unavailable, preserve scene
   editing and show a software preview instead of disabling the rest of the
   editor.

## How Madhorse Studio works today

- The editor is a React/Vite web app using React Three Fiber and Three.js for
  the interactive 3D scene.
- The Scene View uses demand rendering; the game-camera view runs continuously
  so animation and play preview can update.
- The current renderer caps mobile preview at 1x pixel ratio and disables
  antialiasing there; desktop preview has a moderate pixel-ratio range.
- If WebGL cannot start, the Scene View uses its software-rendered fallback.
- Project and editor preferences are browser-local. Imported asset bytes live
  in IndexedDB; project metadata and scene state use local storage.
- Current editor equivalents include Scene View, Hierarchy, selected-object
  Settings, asset/data panels, transform controls, animation timeline,
  world-building tools, and Mad Builder.

## Practices applied in Madhorse

- **Render quality setting:** Performance, Balanced, and High pixel-ratio
  ranges allow a user to trade scene-preview sharpness for rendering cost.
  Balanced is the default; mobile remains capped at 1x.
- **Live render statistics:** an optional overlay reports frame interval in
  Play/Game View and renderer draw calls, triangles, geometry count, and
  texture count. It is disabled by default and stays in the current viewport.
- **No automatic telemetry upload:** these measurements remain in the
  displayed browser session and are not added to saved project data.

## Suggested staged roadmap

1. Keep measuring with the current counters and verify quality modes on actual
   desktop and phone GPUs.
2. Add asset budgets and loading status before importing very large worlds.
3. Add visibility culling, level of detail, and instancing when benchmark scenes
   demonstrate the need.
4. Add richer frame captures only where the browser and device expose reliable
   APIs; do not label estimated frame interval as GPU time.

## Official references

- Unity Editor interface:
  https://docs.unity3d.com/2022.3/Documentation/Manual/UsingTheEditor.html
- Unity Profiler:
  https://docs.unity3d.com/6000.0/Documentation/Manual/Profiler.html
- Unity Rendering Profiler:
  https://docs.unity3d.com/6000.0/Documentation/Manual/ProfilerRendering.html
- Unity rendering optimization:
  https://docs.unity3d.com/6000.2/Documentation/Manual/OptimizingGraphicsPerformance.html
- Unity Frame Debugger:
  https://docs.unity3d.com/6000.3/Documentation/Manual/FrameDebugger.html
- Unreal Editor interface:
  https://dev.epicgames.com/documentation/unreal-engine/unreal-editor-interface
- Unreal Content Browser:
  https://dev.epicgames.com/documentation/en-us/unreal-engine/content-browser-in-unreal-engine
- Unreal Insights:
  https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-insights-in-unreal-engine
- Unreal real-time rendering optimization:
  https://dev.epicgames.com/documentation/en-us/unreal-engine/guidelines-for-optimizing-rendering-for-real-time-in-unreal-engine
