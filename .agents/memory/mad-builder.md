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
