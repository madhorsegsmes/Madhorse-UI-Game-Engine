---
name: Modeling and Blender scope
description: User-selected scope for roomy modeling, rigged modular characters, and Blender exchange.
---

Provide both Madhorse-native modeling/rig tools and Blender-compatible GLB/glTF import/export. This is not a request to embed the entire desktop Blender application or claim native `.blend` editing.

**Why:** The user asked for Blender, more room for modeling, better rigs, and modular characters, then selected “Both: Madhorse modeling tools and Blender import/export” after the distinction was explained.

**How to apply:** Keep the existing editor layout and saved content intact; use an expanded workspace for these tools. Explain Blender-only limitations plainly rather than suggesting constraints, modifiers, drivers, or procedural shaders transfer automatically.

Do not apply generic topology operations to skinned meshes or shape-key meshes unless the operation preserves all bone weights and morph targets. Use sculpting and weight painting for rigged surfaces.

**Why:** The user requested better editable rigs; ordinary mesh edits can otherwise break deformation weights or shape-key data.

**How to apply:** Restrict face and vertex topology edits to compatible meshes and explain the limitation in the tool rather than silently dropping rig or morph data.

Editing an imported model should make a working copy; saving a model to a project must not silently overwrite its source asset.

**Why:** Rich modeling/rig edits can be destructive, and the user has repeatedly requested preservation of existing features and project data.

**How to apply:** Save a separate model asset unless the user explicitly chooses replacement. Treat animation preview as temporary, not a persistent pose edit.

Check the full content bounds when verifying responsive modeling panels, not just the panel rectangles.

**Why:** A panel can occupy the correct grid cell while its compressed contents visibly overflow into the next panel.

**How to apply:** At stacked tablet/phone widths, verify the complete controls fit their sections and remain reachable by scrolling.

Trace suspicious viewport lines before assuming they are rig helpers.

**Why:** A generated body surface artifact resembled a floating helper line; disabling the skeleton did not remove it.

**How to apply:** Toggle overlays to distinguish helper visuals from mesh geometry, then verify the actual source rather than hiding unrelated controls.
