---
name: Madhorse data ownership
description: Separate protected engine reference data from editable game-project data.
---

The engine's system reference library is maintained by the system and is not user-editable. Users can adapt its defaults inside a project; game rules and saved project content belong to the project-data layer.

Saved project data stays in this browser; do not sync it to a server or other devices unless the user changes this choice.

The separate Studio artifact must not write to the original editor's saved-project or asset stores. Existing content may be copied into Studio, never moved or deleted from the original as part of that process.

**Why:** The user requested a new functional artifact from the approved design while keeping the previous app and saved projects intact.

**How to apply:** Preserve independent save ownership for the two editors. Any future migration, shared engine extraction or asset cleanup must keep the original records unchanged unless the user explicitly requests otherwise.

Animation clips are saved with their project. Playback should apply temporary scene transforms only; stopping or leaving preview restores the saved scene without changing project transforms or script-runtime state.

**Why:** The user defined separate system knowledge and editable project data for Madhorse Engine.

**How to apply:** Keep reference catalogs, per-game rules, and saved project content distinct in storage and UI. Users should edit game rules through projects, not directly edit system reference data. Keep saved projects browser-local. Treat animation playback as a view over saved scene data, not a scene edit or script command.

The game-type development library is protected system reference material, available as a read-only PDF only inside System Presets & Data.

**Why:** The user requested a broad game-type build guide in PDF form that users can only read in System Presets & Data.

**How to apply:** Keep the guide embedded in that settings section, not as an editable project asset or general download. Update its source only as system-maintained reference data.

Prefab definitions are reusable snapshots; placed instances are independent.
Removing or changing a library definition must not silently change existing
scene instances.

**Why:** Creators may customize placed instances; template management must not
discard their project edits.

**How to apply:** Any future source-to-instance update needs an explicit user
action and must preserve or clearly resolve instance-specific edits.

One-time starter-scene upgrades must not reseed an object the user removed.
Mark projects as initialized even when their custom scene is ineligible for the
new starter object.

**Why:** Saved project content belongs to its creator; app updates must not undo
an intentional removal or overwrite their customized camera and physics.

**How to apply:** Seed only unmodified starter projects and persist the
initialization marker in browser-local project data. Preserve customized scenes.

Debugger history is transient engine-session data, not saved game content or
protected system-reference knowledge. Persist or upload diagnostic reports only
after an explicit user choice.

**Why:** Logs can contain creator script output, error details, and transient
failures; silently embedding them in project saves risks privacy and unnecessary
project growth.

**How to apply:** Keep diagnostic collection bounded and session-local. Offer
explicit report downloads, sanitize credential-like strings, and never include
request bodies, headers, or browser-storage dumps in automatic capture.

Read-only project checks must not migrate or copy imported assets as a side effect.
An unreadable file is unverified, not proven missing; an incomplete scan is not a pass.

**Why:** Compatibility-loading paths may write migrated copies, and browser storage
failures must not produce misleading claims about the creator’s data.

**How to apply:** Use explicitly read-only inspection for audits, keep reports
session-local unless downloaded, and clearly distinguish missing, failed and partial checks.

Authoring Undo/Redo is session-local and separate from simulated game state,
assistant audit logs, and protected system knowledge. Imported file bytes must
remain available while an undo or redo step can reference them.

**Why:** Rewinding an edit must restore a usable object, not metadata pointing to
deleted files. Recording Play/Test motion as authored edits would overwrite the
creator's scene, while saving history indefinitely adds private source and size
to project files unnecessarily.

**How to apply:** Include linked project metadata in the same scene transaction,
retain the referenced asset-vault bytes, and make future asset garbage collection
aware of active history. Keep history bounded and reset it between project editing
sessions; never use it to modify engine reference definitions.
