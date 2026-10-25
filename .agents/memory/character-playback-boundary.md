---
name: Character playback boundary
description: Keep procedural character motion temporary and avoid remeshing during gameplay.
---

Animate generated humanoid fighters through a temporary skin rig. Keep their
editable anatomy and clothing in the authored scene, and leave imported-model
rigs and animation clips on their own asset pipeline.

**Why:** A fused smooth surface is expensive to generate. Treating a newly
allocated parts array as a geometry change repeatedly remeshes otherwise static
characters during play. Baking animation into authored transforms also risks
changing the user's saved model.

**How to apply:** Cache geometry by authored surface content, not array identity
or playback state. Allocate skinning resources only for animated characters,
update their bone palette at render cadence, and attach clothing to that same
palette. Stop Test must restore the original scene without pose edits. Do not
assume a humanoid rig is suitable for quadrupeds or arbitrary imported models.

Check fighter-facing direction against attack direction explicitly.

**Why:** The generic editor-to-Three rotation conversion reflects the ground
plane. Using it unchanged for a forward-facing fighter can make a punch point
away from the opponent even though the logical attack hits.

**How to apply:** Verify the model's actual front direction and both fighters'
world-space facing, not just numeric yaw values.

Preserve generated character identity when adding friendly athlete or NPC labels.
Put custom display labels on a grouping object rather than changing the identity
used to recognize the smooth body and skin rig.

**Why:** A sports starter's friendly mesh-root rename disabled native smooth-body
recognition and temporary rig playback, leaving the anatomy pieces uncombined.

**How to apply:** Check that newly assembled characters still qualify for the
native body renderer and receive a temporary animation pose before assessing
model quality. Verify clothing remains attached to that same rig.
