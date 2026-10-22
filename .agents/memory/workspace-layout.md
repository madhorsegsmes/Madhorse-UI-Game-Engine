---
name: Numbered workspace panels
description: User-defined panel numbering, control grouping, and placement in Madhorse UI.
---

The left toolbar is **Panel 2**, containing **Hierarchy, Assets, Data**. The right toolbar is **Panel 1**, containing **Project, Game Type, Script**. Keep visible space between these two panels.

The lower panels run left to right: **Panel 3 — System**, **Panel 4 — Play/Test Game**, **Panel 5 — Error Displayer**.

Panel 3 has an **Animations** button, with **UI Controls** underneath it.

At the very top is one long bordered **Main Panel**, with a column divider and **File, Tools, Scene Preview** controls at its right corner.

**Why:** The user explicitly corrected the control placement and assigned these panel numbers.

**How to apply:** Use these names and sides when interpreting future layout requests. Preserve the grouping on phone layouts rather than combining all six toolbar controls into one box.

The visual preview's default appearance should be a blank canvas with a centered
square, like Unity. Keep the surrounding numbered panels unchanged.

**Why:** The user asked for a blank canvas with a centered square like Unity.

**How to apply:** Keep preview settings unobtrusive and preserve existing project
objects and saved positions when changing the presentation.

Canvas is the Game Camera's output from the same scene edited in 3D Preview,
not an independent 2D scene. Game Camera belongs in Panel 3 and initially points
directly at the square.

**Why:** The user asked for whatever is built in 3D Preview to display in Canvas
through the game camera.

**How to apply:** Preserve shared scene data and keep editor-only guides and
transform handles out of the camera output.

Show a spinning cog and adjacent loading bar whenever the system refreshes or
collects data, and keep the screen awake while the editor is being used.

**Why:** The user explicitly requested both behaviors.

**How to apply:** New data-loading paths must participate in the global activity
indicator. Do not trigger extra refreshes just to animate it. Respect browser
wake-lock restrictions and never claim the screen is awake when acquisition fails.
