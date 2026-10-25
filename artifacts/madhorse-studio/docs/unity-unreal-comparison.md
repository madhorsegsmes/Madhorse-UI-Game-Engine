# Madhorse versus Unity and Unreal

Reviewed 2026-10-25. This is a capability comparison, not a claim of feature or visual parity.

| Area | Working Madhorse foundation | Important remaining gap |
| --- | --- | --- |
| Editor | Hierarchy, transforms, object settings, scene/game cameras, history, prefabs, named projects | Mature multi-scene authoring, collaborative editing and production asset workflows |
| Rendering | Three.js/WebGL2, PBR, lighting/shadows, environment and render settings | Nanite-style virtual geometry, Lumen-style dynamic GI, production ray tracing and virtual shadow maps are not implemented equivalents |
| Physics | Local rigid-body/AABB simulation, broadphase, gravity, contact response; six editable collision groups with mutual masks | PhysX/Chaos-class mesh/convex solvers, joints, cloth, destruction and reliable continuous collision detection |
| Characters and animation | Editable character building, imported model assets, animation controllers and coordinated scene animation | Mature retargeting, robust IK/control-rig authoring, animation debugging and production-quality deformation pipelines |
| World building | Terrain/world tools and editable genre starters | Seamless world partition, streaming budgets, HLOD generation and scalable navigation-mesh baking |
| Assets | Import/export, materials/textures, browser-local asset storage | Full DCC reimport/dependency pipeline, automated LOD generation, texture/platform cooking and robust compression workflows |
| Logic and scripts | Built-in editable gameplay components, visual logic and isolated language runtimes with memory limits | Full Unity/Unreal engine APIs and native-code/plugin compatibility; arbitrary language support is not API compatibility |
| Multiplayer | Room/host-authority components | Dedicated authoritative servers, prediction/reconciliation at production scale, persistent MMO services and anti-cheat |
| Shipping | Portable web player and project export paths | Verified native Android APK build/signing pipeline, platform certification and console deployment |
| Diagnostics | System debugger, render statistics, scene/export checks | Full CPU/GPU frame debugger, deep allocation analysis, automated large-world and hardware performance coverage |

## Added in this pass

- Rigid-body collision groups: Default, World, Player, NPC, Projectile and Decoration.
- Per-object masks edited under object Physics → Collision groups (advanced).
- Both bodies must permit a contact; unchecking World also disables the implicit rigid-body floor.
- Old projects with no filter fields preserve the previous all-groups contact behavior.
- Filtering applies to rigid-body resolution, not independent trigger, navigation, character-motion or gameplay-hit systems.
- Repeated Python loader preparation accepts only the exact already-capped loader; unexpected or duplicate layouts still fail closed.

## Recommended next production work

1. Unify collision queries, character motion and gameplay traces behind documented collision policies.
2. Introduce a tested general-purpose physics backend before advertising complex vehicles, joints or ragdolls.
3. Build asset optimization/reimport and level-of-detail pipelines with measurable budgets.
4. Add animation retargeting and rig/IK workflows with authored validation scenes.
5. Implement streamed world chunks with explicit memory limits and server-authoritative gameplay.

Do not add buttons claiming these systems exist before their runtime behavior and authoring workflow work. Keep Hub thumbnail costs separate from Studio quality.

## Official comparison sources

- Unity 6 layer-based collision detection: https://docs.unity.com/en-us/engine/6000.0/manual/physics-section/physics-overview/collision-section/collision-detection/layer-based-collision
- Unreal Engine traces/channels: https://dev.epicgames.com/documentation/unreal-engine/traces-in-unreal-engine---overview
- Unreal Engine Lumen: https://dev.epicgames.com/documentation/unreal-engine/lumen-global-illumination-and-reflections-in-unreal-engine
- Unreal Engine Nanite: https://dev.epicgames.com/documentation/unreal-engine/nanite-virtualized-geometry-in-unreal-engine
