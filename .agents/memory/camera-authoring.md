---
name: Camera authoring
description: Why Panel 3 camera edits use an explicit complete-pose Apply action.
---

Panel 3 position, aim point, and field of view use an explicit Apply action that validates the entire pose before saving.

**Why:** Mobile numeric editing temporarily produces blank or partial numbers, and changing several coordinates can temporarily put position and aim at the same point. Neither should overwrite a valid saved camera or prevent the creator from entering a valid final pose.

**How to apply:** Keep draft input separate from project state. Reject invalid complete poses visibly without changing the saved view. Explicit aim-point editing replaces a rotation override, so the requested aim actually controls the view; editor-camera and object transforms must stay separate.
