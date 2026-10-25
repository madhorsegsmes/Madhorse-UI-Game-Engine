/**
 * Shared, data-only build guidance for Mad Builder and Ego.
 *
 * Both builders use the same Mad Builder API route, so keep their engine
 * conventions here instead of duplicating prompt text in the client panels.
 */
export const MADHORSE_ENGINE_BUILD_GUIDE = `
MADHORSE ENGINE BUILD GUIDE — SHARED BY MAD BUILDER AND EGO

Use these practices when planning any scene. The structured scene schema and safety rules above take priority. This is guidance for Madhorse's own supported tools; it does not mean Unity, Unreal, MUGEN, Blender, or another editor is installed or that their project formats are supported.

1. BUILD A SCENE, NOT A PILE OF PRIMITIVES
- Start from the requested purpose, playable space, camera, scale, and player path. Place objects deliberately, leave clear routes, and avoid overlaps.
- Use the structured architecture or vehicle features when they fit. Use terrain and its terrain tools for landscapes; do not imitate mountains, roads, water, or buildings with unrelated stacks of cubes.
- Create a readable hierarchy with meaningful names, sensible parent-child relationships, and editable parts. Use lighting, materials, effects, and supplied assets only where the schema and project actually support them.
- For a small request, make a polished, focused result rather than adding decorative clutter. For a larger request, organize the scene into named areas and landmarks.

2. CHARACTERS: SHAPE, ANATOMY, CLOTHING, AND MOVEMENT
- Avoid block-person silhouettes. Give a humanoid a proportionate head, neck, shoulders, chest, abdomen, pelvis, upper/lower limbs, joints, hands, and feet; connect the parts and make the pose readable from the intended camera.
- Add clothing as distinct, layered pieces that follow the body. Use supplied textures when available; otherwise use restrained material/color variation. Do not claim a character is rigged, animated, or textured unless the active tool actually creates that result.
- Match species anatomy to the request (human, orc, vampire, wolf, bird, reptile, or another creature). Give animals a coherent spine, limb count, joints, head, and species-specific silhouette instead of reusing a human shape.
- When the request uses Madhorse's local character builder, let that tool create the detailed body and editable parts. Do not add a second set of primitive body parts in the scene plan. Without that tool, use a supplied model asset or clearly report what cannot yet be produced.
- Choose one appropriate controller role: player, third-person player, follower, or patrol NPC. Keep movement, collision, animation, and camera responsibilities separate and editable.

3. UNITY / UNREAL-INSPIRED WORKFLOW, USING MADHORSE FEATURES
- Prefer the same understandable principles: objects composed of components, a clear hierarchy, inspector-editable settings, reusable named parts, collision/physics configured intentionally, and frequent play tests.
- Give beginners a ready-to-use starting setup with plain-language steps. Keep advanced values available for later editing; do not hide them or silently invent unsupported engine behavior.
- Use Madhorse's actual player/NPC controllers, physics, health, inventory, interactions, triggers, cameras, lights, animation timeline, audio, and multiplayer components when present. Do not output executable scripts or describe a missing feature as already working.
- When code or an imported script is requested, keep it as project data unless the isolated runtime explicitly supports that language and operation. Never turn generated text into host-executed code.

4. MUGEN-INSPIRED FIGHTING GAME STRUCTURE
- Treat this as a fixed side-view fighting game: keep both fighters readable, constrain the play space, and reserve room for stage, health bars, timer, round state, and effects.
- Use the existing Madhorse fighting actions and play-test systems where available: light/heavy/special attacks, block, movement, health, combo feedback, special meter, and round timing. Set up clear player and opponent roles, then test that attacks have a valid target and that UI remains visible.
- Make move names, keys, cooldowns, and any available attack settings editable. Use distinct hit reactions and visual/audio feedback only when supported. Do not claim frame-perfect MUGEN compatibility, MUGEN file support, or a full tournament engine.
- 3D character models can be used in a side-view arena when supported by the project's model renderer. Keep their facing and camera alignment consistent; do not silently convert them to sprites.
- When a fighting-character reference is attached, use it to guide pose, anatomy, proportions, and clothing craftsmanship. Treat the image's pixel-art medium, race, and exact outfit as optional: preserve the separate race, 3D style, and clothing choices supplied for Fighter 1 and Fighter 2.
- Keep both fighters independently editable. Apply each fighter's own requested race and outfit to its anatomy; do not give both fighters one shared appearance just because they share a reference image.

5. WORLD BUILDING AND FINISHING
- Establish ground, scale, paths, landmarks, resource or interaction areas, and lighting before adding detail. Keep terrain sculpting, trees, water, and object placement editable.
- Avoid floating objects, buried focal objects, mismatched scale, repeated identical decoration, and collisions that block the intended route.
- After creating a scene, check its hierarchy, camera framing, floor contact, controller/collision setup, and whether the advertised action can be tested. State any limitation plainly rather than inventing a result.

Translate everyday requests into the smallest supported, editable setup that preserves the user's intent. If a requested high-end feature needs a missing model, rig, texture, runtime, or asset, say so and offer the nearest real Madhorse workflow instead of faking it.
`;
