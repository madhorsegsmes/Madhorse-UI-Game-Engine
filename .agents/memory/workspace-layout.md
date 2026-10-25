---
name: Numbered workspace panels
description: User-defined panel numbering, control grouping, and placement in Madhorse UI.
---

Panel 5 is labeled “World Building Tools,” with “3D Modeling Tools” directly
underneath and a “Preview Animation Scene” button below that.

**Why:** The user specified these labels and the animation preview button for Panel 5.

**How to apply:** Preserve the panel dimensions and leave its remaining space
blank until the user requests tools.

World Building Tools are for shaping terrain and scenery, such as raising or
lowering terrain, trees, and water—not generic empty-object, camera, or light creation.
Panel 5 presents world-building and 3D-modeling actions as clickable icons;
choosing a tool opens its relevant settings before the user applies it.

**Why:** The user distinguished world-building tools from Hierarchy creation tools and asked for both Panel 5 tool groups to reveal settings from their icons.

**How to apply:** Keep general object creation in Hierarchy; preserve Panel 5 as the world and modeling tool area, with parameters visible before applying changes and without resizing the workspace.

Right-clicking Hierarchy opens a two-column tool palette with **Beginner** and
**Advanced** groups. Keep all current creation, world, UI, asset, and scene-system
actions visible in their respective columns.

**Why:** The user asked for a medium-sized two-column right-click menu that presents all tools from beginner to advanced.

**How to apply:** Keep the context palette inside the viewport bounds, make each column independently scrollable when needed, and preserve the underlying workspace dimensions.

Keep context-menu action rows compact and provide a **Back** control that closes the palette and returns to the editor.

**Why:** The user asked for slimmer rows and a back button in the Hierarchy right-click menu.

**How to apply:** Reduce row height without making labels hard to read; Back dismisses the menu without changing project state.

The user rejected the rebuilt Studio layout and asked to remove everything visible so they can redo the layout fresh. Start blank, without panels or buttons, and add layout elements only as the user directs. Preserve engine code and saved projects.

**Why:** After trying the rebuilt interface, the user said “i dont like the way that looks remove everything and let me redo the whole layout fresh.”

**How to apply:** Do not restore the rejected layout or create another preset redesign unasked. Earlier placement notes below are historical context, not instructions to populate the fresh layout.

When adding content to an existing panel, preserve the other panel sizes by
default. Use contained scrolling or an overlay for larger tools instead of
expanding a shared grid row.

**Why:** The user reported that placing Mad Builder changed the size of all
panels and asked to fix the layout.

**How to apply:** Keep the workspace grid dimensions unchanged unless the user
asks to resize a panel; constrain new content within its panel or open it in an
overlay.

Workspace panels use a shared snap grid and can be dragged or keyboard-reordered; the initial arrangement is **Main Panel**, **Scene View**, camera controls, **Panel 2**, **Panel 1**, then Panels 3–5. Keep panel names, numbers, and control groupings intact when they move. Layout order is saved in the current browser, and Reset restores the initial arrangement.

**Why:** The user asked to move all panels to suit each user's preference and chose a flexible snap grid.

**How to apply:** Keep every workspace panel a direct grid item with an accessible move handle. Preserve its contents when reordered, persist layout separately from game data, and keep a reset path.

Panel 2 contains **Hierarchy, Assets, Data**. Panel 1 contains **Project, Game Type, Script**.

The default lower-panel order is **Panel 3 — System**, **Panel 4 — Play/Test Game**, **Panel 5 — Error Displayer**.

Panel 3 has an **Animations** button, with **UI Controls** underneath it.

At the very top is one compact, long bordered **Main Panel**, with a column divider and **File, Tools, Scene Preview** controls at its right corner.

**Why:** The user explicitly corrected the control placement and panel numbers, then asked for a smaller Main Panel.

**How to apply:** Keep its height compact with restrained padding and button sizing. Use the names and default placement when interpreting future layout requests; keep each toolbar's controls grouped at PC window sizes.

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

The Canvas game-camera view should render continuously and use automatic lighting
centered on the current camera target.

**Why:** The user asked Canvas to use automatic rendering and lighting.

**How to apply:** Keep the auto render loop scoped to Canvas, not the editable
Scene View, and keep lighting aligned when the Game Camera target moves.

Canvas drag-to-orbit changes the Game Camera pose around its existing target,
without rotating or moving scene objects. Canvas offers free 360°, Y-axis, and
X-axis orbit modes; movement eases after dragging and saves after it settles.
Every mode must preserve the exact target and camera-to-target distance. Reset
north restores the default pose.

**Why:** The user asked to orbit only the camera and then requested axis controls
and smoother motion.

**How to apply:** Persist camera orbit changes to the project camera and keep the
scene target and orbit radius fixed. Keep axis modes separate from scene-object
transforms and commit the final pose after damping completes.

The primary game camera sits **north of the square, looking back toward it**,
not south of it looking north. North is negative world Z, with world Y up.

**Why:** The user explicitly clarified this camera placement.

**How to apply:** North is the default/automatic placement, not a permanent lock.
The user subsequently requested a draggable, movable, rotatable scene camera.
Manual edits should preserve a custom camera pose rather than snapping back
north when the square changes; Reset north restores automatic placement. Keep
the Scene View marker visible and editor navigation independent of camera edits.

The 3D Scene View should navigate like a 3D editor viewport: scroll-wheel zoom,
middle-button drag to pan, and a wider continuous zoom range. These controls
change only the editor view, not the saved Game Camera or scene objects.

**Why:** The user asked for the Scene View to be scalable like Unity's Scene view.

**How to apply:** Keep editor zoom/pan separate from game-camera pose and object
transforms. Preserve mouse navigation and direct zoom controls. See
[editor platform scope](editor-platform-scope.md) for the PC-only authoring target.

The scene viewport should be large by default on desktop; users should not need
to resize it before they can work comfortably.

**Why:** The user clarified that the scene view remained too small even after
manual resizing.

**How to apply:** Give the viewport priority in desktop workspace layout while
keeping supporting panels available below it.

Resizing the Scene View height must be possible independently of changing its
width; provide top and bottom edge handles in addition to corner handles.

**Why:** The user clarified that vertical resizing should not require dragging a
corner.

**How to apply:** Edge drags adjust height only and retain keyboard accessibility.

Leave a clear gap below the Main Panel so the Scene View's top edge can grow
upward into that space without covering the panel.

**Why:** The user requested space between the Main Panel and Scene View to allow
more vertical scaling.

**How to apply:** Keep the Main Panel stationary and constrain upward scene
resizing to the available gap.

Keep CAM / Game Camera controls in their own bordered box outside the preview
frame, not overlaid on the 2D canvas.

**Why:** The user explicitly requested the camera controls outside the preview.

**How to apply:** Keep the box in normal page flow below the preview and available
in both Canvas and 3D Preview. Expanding controls must not cover the viewport.

Responsive component overrides must not rely on stylesheet import order.

**Why:** Desktop checks found the global base styles overriding active component
media-query styles, leaving controls at the smaller base size.

**How to apply:** Scope desktop rules beneath the workspace root so they have
greater specificity than global base rules; check computed sizes at desktop widths.

Restore a child control's saved panel sizing only after its ancestor host ref has
attached.

**Why:** Reading the ancestor ref in the child's layout effect returned null on
fresh mount: dragging worked, but a reload silently ignored the saved dimensions.

**How to apply:** Use a passive effect or another post-attachment mechanism for
ancestor-ref restoration, and verify a fresh reload, not just interactive edits.

Show a spinning cog and adjacent loading bar whenever the system refreshes or
collects data, and keep the screen awake while the editor is being used.

**Why:** The user explicitly requested both behaviors.

**How to apply:** New data-loading paths must participate in the global activity
indicator. Do not trigger extra refreshes just to animate it. Respect browser
wake-lock restrictions and never claim the screen is awake when acquisition fails.

Keep interface additions simple, using the established panel layout.

**Why:** The user said, “feel free to add more to the interface that we need just
keep the layout simple.”

**How to apply:** Prefer compact controls inside existing panels. Do not resize
or rearrange panels just to add another utility; avoid extra permanent help boxes.
