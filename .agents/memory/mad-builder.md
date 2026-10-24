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

For a recognized architectural reference with a supported procedural template,
ask the planner for one high-level architecture instruction and expand it locally
into named editable parts instead of asking the model for a long list of boxes.

**Why:** Image-guided house plans were flattening into generic shells, and
repetitive primitive lists were both less faithful and more likely to hit output
limits.

**How to apply:** Validate the architecture style at the API and editor
boundaries; build from a deterministic template, and label hidden elevations as
estimates rather than claiming exact reconstruction from one image.

Use a bounded contoured vehicle tool for recognized coupe references instead of
trying to correct a long primitive-only car plan with more prompt wording.

**Why:** The user's comparison images showed that repeated prompt refinements
still produced a yellow block cluster rather than the curved orange coupe in the
reference. Better instructions did not supply the missing surface geometry.

**How to apply:** Prefer coherent editable vehicle surfaces and aligned wheels,
preserve existing builds, and clearly identify template/hidden-view limitations.
Do not apply a coupe template to unrelated vehicle silhouettes.

Ask for a visual reference before a new Studio build and prioritize its visible
proportions, silhouette, spacing and openings over decorative part counts.

**Why:** The user reported that builds clumped objects together and requested
image-guided reconstruction instead.

**How to apply:** Send the reference to the vision planner, not just its filename.
Do not promise exact 3D reconstruction from one image or fabricate hidden details
without identifying them as estimates.

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

Mad Builder's selected default reference follows its build category: Vehicle uses
the orange coupe and House uses the provided Victorian house image; Automatic
follows the prompt and treats the coupe as finish guidance only. User targets
override the category reference's appearance. Modular builds stay editable and
the built-in module palette stores reusable project prefabs.

**Why:** The user chose coupe for Vehicle, Victorian for House, and requested
both separately editable parts and reusable modules.

**How to apply:** Keep the selected reference enabled by default and pass the
category to the planner. Never use the coupe as a house subject. Preserve the
custom target as separate input, and keep first-insert modules in the project's
reusable prefab collection so later inserts can instantiate them.

Keep Mad Builder logs inside the read-only System Presets & Data disclosure, and
generate the PDF as a static report with no edit controls.

**Why:** The user asked that build records stay in System Presets & Data and not
be changeable by users.

**How to apply:** Display builds as read-only data; do not add log-edit or PDF-edit
features. Explain that a downloaded copy can be modified outside Studio if asked.

Keep Mad Builder's AI requests within conservative reasoning and output limits.
Higher reasoning and large output budgets previously hit the Replit AI request
timeout before returning a plan.

**Why:** The user-facing build flow cannot create scene objects until the AI
returns validated construction data.

**How to apply:** If changing model settings, confirm a complete request returns
before increasing generation budgets; report failures without applying partial data.

Reserve enough output capacity for the full structured scene plan rather than
spending it on reasoning. Prefer concise required fields and purposeful parts
over large quantities of repetitive details.

**Why:** An image-guided request reached the AI but failed with a length cutoff;
upload-only tests could not detect that incomplete structured output.

**How to apply:** Check finish reason and token usage, reject incomplete JSON
atomically, and verify a representative vision request reaches actual scene
application when changing generation settings. Distinguish output-limit errors
from upload or schema errors.
