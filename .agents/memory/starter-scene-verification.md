---
name: Starter scene verification
description: Test starter controls against the assembled map rather than only checking component presence.
---

Verify starter controls in the assembled scene, including their initial placement, before describing the starter as playable.

**Why:** During the RTS starter work, valid gather/craft/build components still produced blocked construction because nearby decorative geometry and following squad members occupied the starting build spot.

**How to apply:** Exercise the starter's advertised keyboard actions together on its actual map. Keep a clear initial construction area and account for automatic NPC movement; component-only validation is not sufficient.

Hub starter previews must correspond to the editable scene users receive, not just to a screenshot labeled as a reference.

**Why:** The user wants the RTS Hub image to match actual scene pieces that appear when the template is opened in Studio.

**How to apply:** Assemble the starter from editable objects, groups, and materials that visibly match its preview. Keep the Hub preview label clear that this is a template, and test the actual created scene.

FPS firing checks need clear, reachable shooting positions as well as deliberate
occluded shots.

**Why:** A fixed test offset behind each target placed the player inside cover,
making correct cover occlusion look like broken shooting.

**How to apply:** Inspect the actual first collider hit before changing aim logic.
Verify shots from clear positions damage targets and shots into cover do not;
do not weaken collision or occlusion to make a firing test pass.

Measure live combat by simulation time, not just the duration of a test key hold.

**Why:** Browser screenshots and tool calls can leave a real-time match running
unattended. A reported short movement input can be surrounded by enough idle
simulation for the CPU to finish rounds.

**How to apply:** Batch starting the match, combat inputs, and immediate assertions
where possible. Check an equivalent deterministic sequence before treating an
unexpected round result as a movement-timing defect.

Derive navigation-test targets from the assembled scene's world transforms rather than repeating assumptions about factory anchors.

**Why:** A kart-driving check used the wrong circuit origin and missed correctly placed checkpoint gates, initially looking like a placement defect.

**How to apply:** Read checkpoint positions from the created scene before steering a test driver. Compare actual world positions before changing placement or collision logic.
