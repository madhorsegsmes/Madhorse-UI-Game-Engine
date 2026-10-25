# Madhorse versus Unity and Unreal

Reviewed 2026-10-25. This is a capability comparison, not a claim of feature or visual parity.

| Area | Working Madhorse foundation | Important remaining gap |
| --- | --- | --- |
| Editor | Hierarchy with name/type filters, transforms and space/snap controls, visibility/picking locks, object settings, scene/game cameras, history, prefabs, named projects | Mature multi-scene authoring, collaborative editing and production asset workflows |

Hierarchy search now combines object names with filters for models/shapes, physics,
lights, cameras, scripts, audio, UI, game systems and inactive objects. Matching
children retain their parent path; filters do not change or hide authored data.
| Rendering | Three.js/WebGL2, PBR, lighting/shadows, environment and render settings | Nanite-style virtual geometry, Lumen-style dynamic GI, production ray tracing and virtual shadow maps are not implemented equivalents |
| Physics | Local rigid-body/AABB simulation, broadphase, gravity, contact response; six collision groups, editable presets and opt-in swept-box CCD against stationary boxes | PhysX/Chaos-class mesh/convex solvers, joints, cloth, destruction, moving-body/rotational CCD and large-scale solver performance |
| Characters and animation | Editable character building, imported model assets, animation controllers and coordinated scene animation | Mature retargeting, robust IK/control-rig authoring, animation debugging and production-quality deformation pipelines |
| World building | Terrain/world tools and editable genre starters | Seamless world partition, streaming budgets, HLOD generation and scalable navigation-mesh baking |
| Assets | Import/export, materials/textures, browser-local asset storage; automatic bounded LOD generation for supported imported static meshes | Full DCC reimport/dependency pipeline, skeletal/multi-material LOD generation, texture/platform cooking and robust compression workflows |
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

## Further comparison and upgrades

Unity offers discrete, continuous and continuous-dynamic collision modes; Unreal exposes a Use CCD setting on physics bodies. A production engine needs contact detection along a body's travel path, not only at its final position.

Madhorse now has an opt-in **Continuous collision (fast objects)** setting in object Physics. It sweeps the existing axis-aligned body box against active stationary static boxes, selects the earliest time of impact, respects both contact masks, and resolves remaining sliding/bouncing motion with a bounded three-hit budget. At the limit it stops at the last safe contact instead of advancing unchecked.

This is not full PhysX/Chaos CCD: dynamic/kinematic target motion, changing rotations, triangles, deformation and pre-existing overlaps are outside the sweep's scope. The ordinary discrete solver still handles overlapping endpoints. Enable it selectively because each enabled moving body checks eligible stationary colliders; it is not a large-world spatial-query accelerator.

Collision presets simplify setup: Solid, World, Player, NPC, Fast projectile, Decoration and Ghost. Fast projectile enables continuous detection, ignores other projectiles and opts the object into Simulate in Play. Presets do not implement guns, player controls, damage or body-type changes. Every setting stays editable and is applied through the normal Save Changes action.

**Runtime connection:** The shared 3D Studio scene runtime and standalone player now run opted-in dynamic rigid bodies through the same solver. Enable **Simulate this rigid body in Play** and optionally set launch velocity; velocity is initialized once per simulation entry. Existing scenes default to opt-out to preserve authored motion. Character/action-controlled entities retain movement authority, and temporary kinematic proxies never change saved body components. Dedicated card/pixel-game rules and controller collision queries remain separate systems.

### Additional gaps confirmed by this comparison

- **Physics:** moving-body CCD, angular dynamics, shape casts, reliable joints/ragdolls and a general-purpose physics backend.
- **Animation:** authored retargeting maps, skeletal IK, blend-space authoring and motion matching—not more procedural poses alone.
- **World scale:** streamed scene chunks, navigation generation, HLOD and asynchronous asset residency with measured memory budgets.
- **Rendering:** material/shader authoring, baked/dynamic indirect lighting and scalable visibility/occlusion systems. PBR alone does not provide these.
- **Production:** platform asset cooking, build automation, authoritative server infrastructure and hardware-based performance regression tests.

## Automatic static-model LOD

Supported imported static meshes now have a real automatic detail pipeline:

- Worker-based meshoptimizer simplification targets approximately 50% / 20% of
  original triangles, subject to locked borders and a 0.5% geometric-error limit.
  These targets are not guaranteed; unsafe or ineffective reductions keep originals.
- Retained vertices are compacted with original UVs, normals, tangents and colors.
  Materials, hierarchy and asset files are not replaced.
- Actual projected screen height selects original / medium / low geometry, with
  hysteresis. Near and selected objects stay original; orthographic zoom is handled.
- New model renderer components enable it by default. Older components without
  LOD settings stay full detail. Object Settings exposes editable thresholds and
  actual last-renderer triangle counts/status. Save Changes applies them.
- Studio and the standalone player both use the same ModelAssetView renderer.
  Worker assets and their meshoptimizer license are included in web-player exports.

Generation is limited to one worker, eight queued requests, 100,000 source vertices,
200,000 source triangles, 16 MiB source attributes per mesh and 32 MiB of generated
detail geometry. Generation has a timeout; worker failure keeps original geometry.
Instances share generated geometry with reference-counted cleanup. These limits
bound this optimization pipeline, not the whole renderer's memory.

Skinned/morph models stay wholly original. Multi-material, non-indexed, partial
draw-range and unsupported attribute meshes also stay original. This does not
implement skeletal LOD, HLOD, streaming, cross-fades, GI or Nanite. GPU appearance
and frame-time improvement still need real-hardware validation.

## Scene-editor visibility and picking locks

Hierarchy rows have compact eye and picking-lock controls. Hidden objects and
their descendants are not drawn in the 3D scene-editor view; locked objects and
descendants are filtered from pointer intersections and cannot use scene gizmos
or direct camera dragging. Pointer filtering allows picking objects behind a
locked object instead of selecting its parent through event bubbling.

These are not security/data locks: Hierarchy, Settings, duplication and deletion
remain editable. They do not disable an object in the game. Scene-view controls
are ignored by Play/read-only game views, and editor metadata is stripped from
web-game exports without dropping the objects. Metadata persists in normal
project saves, with Undo/Redo and Show all / Unlock all recovery controls. Parent
flags are inherited; independently hidden children remain hidden when a parent
is shown again. The virtual primary-camera row has no saved-object controls.
Hidden groups remain mounted so restoring visibility does not reload imported
models or repeatedly recreate their GPU resources. This is not asset streaming.

This first pass is for the 3D scene editor, not separate pixel/card-game editing
surfaces. CPU raycast, storage, export and browser-control checks do not establish
GPU visual verification of the signed-in editor.

### Scene gizmo alignment and snapping

The draggable Move/Rotate/Scale toolbar includes Auto/World/Local axes, an
opt-in Snap checkbox and editable move, turn and size steps. Auto preserves the
previous behavior: camera translation uses world axes, other transforms use
local axes. Scaling always uses local axes, as required by Three.js controls.
Turn steps are converted from degrees to radians for the actual TransformControls.
Zero, negative or non-finite scale at release restores the pre-drag scale.

Preferences are browser editor settings, not authored game rules or exported
project/game data. Snapping applies to gizmo dragging, not exact Inspector inputs
or free camera-icon dragging. Vertex/surface snapping, multi-object pivots and
arbitrary rotated-parent world-grid correctness are not claimed by this pass.

## Physics collision view

Render settings can show editor-only colored wire boxes for the shared AABB
solver, optionally for just the selected object or through visible models.
The guide and solver share half-extent math, account for hierarchy scale and
world position, and deliberately do not rotate box extents with the mesh.
Inactive ancestors, disabled physics/colliders and editor-hidden objects are
filtered; during Play the Scene view follows active runtime objects instead.

Rendering uses one non-pickable line batch, reused bounded buffers and a 500-box
cap. A counter exposes truncation and empty selections. The preference is
browser-local, not an authored scene setting, and Game/camera/static previews
never draw it. It does not add PhysX/Chaos, capsule/mesh collision debugging,
contact/force visualization or terrain-contour collision validation.

## Official comparison sources

- Unity 6 layer-based collision detection: https://docs.unity.com/en-us/engine/6000.0/manual/physics-section/physics-overview/collision-section/collision-detection/layer-based-collision
- Unreal Engine traces/channels: https://dev.epicgames.com/documentation/unreal-engine/traces-in-unreal-engine---overview
- Unreal Engine Lumen: https://dev.epicgames.com/documentation/unreal-engine/lumen-global-illumination-and-reflections-in-unreal-engine
- Unreal Engine Nanite: https://dev.epicgames.com/documentation/unreal-engine/nanite-virtualized-geometry-in-unreal-engine
- Unity sweep-based CCD: https://docs.unity.com/en-us/engine/6000.6/manual/physics-section/physics-overview/collision-section/collision-detection/continuous/sweep-based-ccd
- Unreal physics bodies / Use CCD: https://dev.epicgames.com/documentation/unreal-engine/physics-bodies-reference-for-unreal-engine
- Unity LOD groups: https://docs.unity.com/en-us/engine/6000.5/manual/analysis/graphics-performance-profiling/lod/lod-group/class-lodgroup
- Unreal LOD screen sizes: https://dev.epicgames.com/documentation/unreal-engine/optimizing-lod-screen-size-per-platform-in-unreal-engine
