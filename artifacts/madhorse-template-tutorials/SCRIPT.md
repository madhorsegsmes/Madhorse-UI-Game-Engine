# Madhorse Template Tutorials — silent guides (16:9, no audio)

Treatment: Madhorse Hub brand (near-black #0e0f11, signal red #d8473a, bone ink), Barlow Condensed + JetBrains Mono.
Hero = an animated vector diagram of each template's starter world inside a Studio-style frame; a right-hand step rail
tracks progress; a caption bar states each action. Motion: cursor demonstrations with click ripples, keycaps that depress
in sequence while the world reacts, typed fields. All facts come from Studio source (studio-projects.tsx starter notes,
*_CONTROLS constants, game-feature-model.ts). Select a film with `?template=<slug>`.

Shots (every guide, ~55-62 s):
1. Intro 4.2s — big template number snaps in, kicker + title rise, live world diagram scales in at right.
2. Open & name 7.4s — Hub card highlighted, cursor clicks → URL shows `editor/?starter=<slug>`; template dialog rises,
   "Project name" types the example name, cursor presses the Create button → "Creating…".
3. Your scene 5.6s — Studio frame; Hierarchy items stagger in; "N editable objects" tag.
4. Play Test 3.8s — cursor clicks Play Test; button flips to Stop Test, viewport red-framed.
5. Controls 2.4s × steps — world reacts on the left, keycaps pulse on the right, list advances.
6. Objective 6.4s — headline goal, three facts land one by one, world plays out the goal.
7. Stop 4.2s — cursor clicks Stop Test; "Scene restored" card.
8. Edit 7.6s — select object in Hierarchy, Inspector slides in, real field edited, Save Changes → Saved.
9. Save 5.6s — Project menu (Save / Export Web Game / New / Rename / Exit to Hub / Open saved) → Save → download card.
10. Recap 4.4s — five step tiles snap in sequence, fade to loop.

Export: `node public/render/render-tutorials.mjs generated-artifacts/template-tutorials` (headless Chromium canvas → FFmpeg H.264, 30 fps, 1920×1080, no audio track).
