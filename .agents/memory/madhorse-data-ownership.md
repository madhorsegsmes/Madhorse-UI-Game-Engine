---
name: Madhorse data ownership
description: Separate protected engine reference data from editable game-project data.
---

The engine's system reference library is maintained by the system and is not user-editable. Users can adapt its defaults inside a project; game rules and saved project content belong to the project-data layer.

Saved project data stays in this browser; do not sync it to a server or other devices unless the user changes this choice.

**Why:** The user defined separate system knowledge and editable project data for Madhorse Engine.

**How to apply:** Keep reference catalogs, per-game rules, and saved project content distinct in storage and UI. Users should edit game rules through projects, not directly edit system reference data. Keep saved projects browser-local.
