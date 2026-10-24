export const CHARACTER_CONTROLLER_REFERENCE = `CHARACTER CONTROLLER — MODELING AND EDITING GUIDE
Read-only system reference for Mad Builder and Madhorse creators

IMPORTANT ENGINE STATUS
Madhorse currently supports editable scene geometry, imported model and image assets, primitive color/texture assignment, transforms, and basic static/dynamic/kinematic physics settings. It does not yet expose a dedicated CharacterController component, capsule-collider type, controller movement motor, or custom movement-script component in Mad Builder. These four controller patterns below are design guidance, not a claim that their movement behavior is already implemented. Mad Builder must build only the supported visual scene data and clearly warn when a request requires missing controller runtime behavior.

COMMON CHARACTER MODEL WORKFLOW
1. Create a named character root at ground/foot level. Keep the character's forward direction consistent across body, camera, and input.
2. Build or import the visible model separately from its collision proxy. Group named editable parts under the character root; use a smooth capsule or rounded shapes for a simple placeholder, and use a supplied/imported model for a detailed mesh.
3. Keep collision dimensions proportional to the standing body. Do not stretch a collider to fit clothing, armor, hair, weapons, or accessories. Keep protruding visual details from making the collision envelope unnecessarily wide.
4. Add detail in layers: primary silhouette, torso and limbs, face or helmet, clothing/armor panels, then smaller fittings. Keep joints and moving limbs as separate parts when they need independent editing or animation.
5. Texture with an image asset already in the project. Assign it to supported surfaces through the Surface texture setting, or import a model asset with its own prepared materials. Use surface color and opacity for supported primitive materials. Madhorse currently has no UV-unwrapping, normal-map authoring, or controller-specific material editor; do not claim those were generated.
6. Edit the model through the hierarchy and object inspector: rename parts, adjust local position/rotation/scale, surface color/opacity/texture, and supported physics settings. Keep visual mesh edits separate from controller/collider dimensions.
7. Test scale and contact against the actual level geometry: floor, walls, doorways, stairs, slopes, ledges, moving platforms, and corners. A good-looking mesh alone does not prove movement or collision behavior.

1. BUILT-IN CHARACTERCONTROLLER
Behavior pattern: a capsule-based controller with collision detection that is independent of Rigidbody forces. It is appropriate for direct, predictable player movement.
Build/edit guidance: use one upright capsule envelope aligned to the character's height, centered over the feet; keep the visible mesh as a separate child. Tune radius and height to fit the torso and doorway clearance, then tune step height, slope limit, skin width, and ground contact in the real controller implementation. Do not use visual armor or accessories as the capsule dimensions. Test steps, slopes, walls, head clearance, and grounded/jump transitions.
Madhorse status: the dedicated capsule controller and its movement settings are not yet available to Mad Builder; a capsule primitive is visual geometry, not a working CharacterController.

2. RIGIDBODY CHARACTER CONTROLLER
Behavior pattern: a dynamic Rigidbody participates in the physics simulation and works with colliders for weight, forces, and physical interactions.
Build/edit guidance: use a capsule or a small set of simple colliders around the body; set the mass and gravity intentionally, keep friction/restitution appropriate, and constrain unwanted tipping where the game requires an upright character. Drive motion with physics-aware velocity/force updates rather than repeatedly teleporting the visual mesh. Test moving platforms, impacts, slopes, and collision tunneling at expected speeds.
Madhorse status: basic physics body settings exist, but Mad Builder does not yet attach a complete Rigidbody movement motor or configure a compound capsule-collider character automatically.

3. KINEMATIC CHARACTER CONTROLLER
Behavior pattern: movement is authored by game logic while collision is still considered; a kinematic body is not pushed around like a dynamic body.
Build/edit guidance: use an upright capsule envelope and a separate visual hierarchy. Advance the body through collision-aware kinematic movement (such as MovePosition/MoveRotation in a compatible runtime), preserve a stable ground check, and define how gravity, slopes, steps, and moving platforms are handled. Avoid unconstrained direct teleports that skip collision checks.
Madhorse status: a kinematic physics body type exists, but a character-specific movement/collision motor is not yet available in Mad Builder.

4. CUSTOM CHARACTER CONTROLLER
Behavior pattern: movement and collision rules are authored for a particular game, such as a dash-heavy, climbing, swimming, vehicle-like, or network-predicted character.
Build/edit guidance: first specify inputs, movement states, acceleration/deceleration, jump rules, grounded detection, slope/step behavior, collision recovery, and camera response. Keep the collision proxy and visual model separate. Build and test one movement mode at a time, then add transitions and edge cases.
Madhorse status: custom behavior requires a supported, isolated runtime component. Mad Builder must not invent or execute script code, claim custom movement is working, or represent a model-only build as a functioning controller.

MAD BUILDER RULE
When a request names one of these controllers, preserve the requested type in the explanation. Build the requested character appearance only from supported geometry or project assets. Do not invent controller components, collider shapes, runtime settings, movement scripts, or texture maps. If the user asks for actual movement/collision behavior that the current system cannot supply, include a clear warning and state which runtime capability is missing.`;
