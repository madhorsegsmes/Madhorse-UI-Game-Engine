---
name: Mad Builder
description: Product placement, safe AI authoring boundaries, and reliable planner schema handling.
---

In the fresh Madhorse workspace, Mad Builder belongs in Panel 4. It should use
the engine's actual building tools to make editable project objects from
requests, not merely return instructions or a picture.

**Why:** The user directed that Mad Builder be placed in Panel 4; this supersedes
the earlier Panel 2 placement for the fresh workspace.

**How to apply:** Expand its tool catalog through bounded engine operations.
Keep AI output as validated construction data, not privileged host code. Review
before applying; preserve existing scene objects. Any future script execution
must use the separately isolated language runtimes and explicit run controls.

Favor high-definition, proportionate builds that explicitly include the
features named in the request rather than low-poly or generic box-only
blockouts. Use low-poly geometry only when the user asks for that style.

**Why:** The user wants professional-engine-level detail in Mad Builder output.

**How to apply:** Use smooth geometry, layered surface detail, supplied textures,
deliberate materials and purposeful editable subparts; keep dimensions and
requested counts faithful.

When a new prompt returns a valid plan, immediately create its editable objects
in the scene rather than stopping at a plan or requiring a second click. Keep
saved drafts available for retry and let users remove completed builds through
the generated hierarchy group.

**Why:** The user said Mad Builder must build with the world-building tools, not
just plan.

**How to apply:** Compile validated plan data into scene entities and preserve
the existing scene; never treat this as permission to execute generated code.

Keep the visibly labeled request composer first when Mad Builder opens.

**Why:** The user asked for a text prompt after the bot already had one; placing
help and history above it made it difficult to find on a phone.

**How to apply:** The phone's initial panel viewport should show the prompt and
planning button without scrolling. Put help and history below the composer.

Keep builder history and unapplied plans browser-local with the project. The
server may process a request and limited tool/asset context but must not silently
move saved projects into a server database.

**Why:** Projects are browser-local by the user's choice, and a reload must not
discard a paid, unapplied build plan.

**How to apply:** Preserve plan recovery across reloads; bind responses and Apply
actions to their originating project. Cancel or discard must not mutate scenes.

Include the full output/tool schema in the planner's system prompt as well as
the SDK's structured-output configuration; validate independently at both
server and editor boundaries.

**Why:** Live responses omitted required fields when the schema was supplied only
through the SDK option. Explicit prompt schema instructions produced valid
construction data.

**How to apply:** Derive both forms from the API contract, rather than maintaining
separate schemas or trusting a model's claim that its output is valid.

Generate the SDK schema directly from the API contract, rather than converting
the generated validators through a separate Zod conversion library.

**Why:** The existing generated validators and converter exposed incompatible
Zod type entrypoints. Direct contract generation avoids this version coupling
without weakening either validator.

**How to apply:** Keep schema export in the standard API generation pipeline.

Keep the API size bounds and planner instructions aligned with the editor's safe
world-scale ceiling; a narrower schema can reject otherwise buildable geometry.

**Why:** A 10-unit response limit rejected generated dimensions even though the
scene compiler safely accepts parts up to its 100-unit limit.

**How to apply:** Change the OpenAPI source, regenerate both client/server
validators, state the same bound in the planner prompt, and retain the compiler's
world-scale check.

Treat the user's Meshy reference as broad visual-quality guidance, not a request
to reuse Meshy assets. Do not connect Tripo3D; the user rejected its generation
charges.

**Why:** The user wants a polished game-asset look but does not want Tripo3D's
paid generation.

**How to apply:** Use the local Mad Builder style profile and original scene
geometry unless the user approves a different runtime model provider.

Keep Mad Builder's AI requests within conservative reasoning and output limits.
Higher reasoning and large output budgets previously hit the Replit AI request
timeout before returning a plan.

**Why:** The user-facing build flow cannot create scene objects until the AI
returns validated construction data.

**How to apply:** If changing model settings, confirm a complete request returns
before increasing generation budgets; report failures without applying partial data.
