# Gaming-PC engine upgrade

Target: gaming PCs, with high-quality graphics by default. Preserve the editor
layout, browser-local projects, existing features, and explicit saved settings.
This is an engineering status record, not a claim of Unity/Unreal feature parity.

## Implemented foundation

- **Rendering:** High is the new fallback/default quality. Explicit Performance,
  Balanced, and High preferences remain intact. High uses the current supported
  PCF shadow mode; studio lights and opaque imported models can cast shadows.
  Authored directional-light shadow maps use 2048 resolution.
- **Materials/assets:** Procedural surface color maps share reference-counted
  texture leases, mipmaps, sRGB color encoding, and hardware-capped anisotropic
  filtering. Unmounting one material cannot dispose another material's map.
- **Gameplay timing:** Play Test uses bounded 60 Hz simulation steps rather than
  variable browser-frame deltas. Input taps are consumed once, UI publishing
  remains limited, hidden pages pause simulation, and long stalls cannot create
  an unbounded catch-up loop.
- **Physics preview:** Uses the same simulation clock. Spatial hashing replaces
  all-body collision-pair checks, oversized colliders have a bounded fallback,
  contact order is stable, and overlapping contacts receive three solve passes.
  This remains an axis-aligned box solver, not a full rigidbody engine.
- **Local storage:** Concurrent asset operations share browser-database
  connections. Transactions still report success only after commit; failures
  remain explicit. Connections close on version changes, with no schema change,
  deletion of existing records, or write to the original editor's asset store.

## Preserved work from the preceding character pass

Generated humanoid fighters have cached surfaces, temporary skinning, matching
clothing motion, accepted-action animation events, early-input buffering, and
hit reactions. These do not automatically retarget arbitrary FBX/GLB rigs or
provide quadruped animation.

## Remaining system passes

These are **not completed by the foundation changes above**.

| System | Required next work and evidence |
| --- | --- |
| Rendering and effects | Verify real GPU appearance, shadow coverage and frame time on the target PC; profile before adding post-processing, reflections, or additional shadow casters. |
| Animation and character creation | Validate the generated rig visually; add authored motion clips, imported-rig compatibility, retargeting, root motion, richer anatomy and creature-specific rigs. |
| Movement, combat and NPCs | Exercise each genre's actual controls; synchronize visible contact with damage and improve avoidance, reactions and input feel without overwriting project settings. |
| Gameplay physics | Integrate controllers and rigidbodies without double simulation; add supported step/slope/platform behavior, rotated collision shapes and fast-body collision checks. The preview solver is not a substitute. |
| Terrain/world building | Profile large maps; improve terrain/vegetation level of detail, brush feedback, water, biome blending and traversal on assembled levels. |
| Modeling and texturing | Verify each topology, sculpt, UV, material and rig tool; preserve weights/morphs and source assets during edits and Blender exchange. |
| Ego and Mad Builder | Bind planning to supported operations and validated project data; test reference fidelity and real scene construction, and report unsupported requests honestly. |
| Plugins and functions | Verify drag/drop attachment, dependencies, editable settings, runtime behavior, removal and persistence for every plugin category. |
| Scripts | Preserve isolated, lazy-loaded runtimes, hard memory/stack boundaries and data-only imported scripts; test diagnostics and each supported language separately. |
| Multiplayer | Preserve host authority; test joining/leaving, interpolation, reconnects and a real 16–32-player session before making capacity/performance claims. |
| Audio | Verify real action clips and footsteps; add deliberate mixing, attenuation, transitions and cleanup without triggering duplicate sounds during simulation catch-up. |
| Vision Board and UI | Verify node/media editing, navigation, menu/control bindings, game completion and publication against saved projects; preserve original media. |
| Saving/import/export | Exercise complete project round trips, missing-asset reporting, failure recovery and supported game outputs. Do not imply browser persistence is a backup or that APK packaging is verified. |
| Hub/auth/community/publishing | Keep authentication and Hub-first navigation intact; separately verify permissions, community flows and published-environment behavior. |

## Verification rules

- Deterministic checks cover simulation refresh-rate independence, bounded
  catch-up/pause, 2D/3D broadphase parity with brute force, collision behavior,
  texture ownership/lifecycle, and preference normalization.
- Fighting, FPS, scene persistence and replacement regressions must remain green.
- Browser checks must use their own project/asset records, never clear user stores.
- WebGL-unavailable software previews cannot certify GPU animation, shadows,
  high-end visual fidelity or actual gaming-PC frame rates.
- Benchmark an assembled game, not just a component or an empty scene.
