---
name: Runtime browser environment
description: Why regression tests must support the supplied system Chromium in Replit.
---

Use the environment-supplied Chromium for browser regressions in this workspace
when it is available; keep downloaded Playwright Chromium as the portable default
for other machines.

**Why:** The downloaded Chromium headless shell failed before browser startup
because `libglib-2.0.so.0` was unavailable. Replit's supplied Chromium ran the same
runtime checks successfully. A browser launch failure is not a sandbox regression.

**How to apply:** When browser checks fail before their test bodies, distinguish
missing Linux libraries from application failures and preserve the system-browser
override rather than weakening assertions or skipping browser coverage.

Firefox and WebKit need their own matching Playwright builds and host libraries;
the supplied Chromium path is not a cross-engine fallback. Do not combine all
`/repl/tools/*/lib` directories into `LD_LIBRARY_PATH`.

**Why:** Mixing the supplied Nix libraries with downloaded Ubuntu browser
binaries produced glibc ABI errors before browser startup. WebKit also needs
the exact ICU SONAMEs its build targets; a newer unrelated ICU is not a substitute.

**How to apply:** Treat missing-library and loader failures as environment
blockers, preserve their failure reports, and run on a host with the matching
Playwright dependencies. Do not weaken sandbox isolation or mark tests skipped
to work around browser launch problems.

The supplied capture/test Chromium's WebGL 2 availability varies by environment.
It has failed context creation with `BindToCurrentSequence failed`, including
with software-rendering flags; it has also successfully rendered through
ANGLE/Vulkan SwiftShader without launch flags.

**Why:** A browser that can run editor and script tests is not necessarily able
to initialize WebGL. Conversely, a past context-creation failure is not proof
that a future environment remains blocked.

**How to apply:** Probe actual WebGL 2 availability and the unmasked renderer
before attributing a blank 3D viewport to scene code. Keep graphics failures
local to the viewport so project tools remain usable. Report verification as
blocked when no context can be created. Real canvas pixels through SwiftShader
prove the WebGL render path, not hardware-GPU or physical-phone compatibility;
DOM-only checks prove neither.

Browser-test storage fixtures must be installed after an old document's
pagehide/autosave flush, not just before reloading.

**Why:** Directly writing a project snapshot then reloading let the editor's
pending save overwrite the fixture. Tests unknowingly inspected the old scene.

**How to apply:** Consume a one-shot pending snapshot during new-document
initialization, then assert the intended scene/camera loaded. Avoid persistent
init overrides that would erase later real UI edits.

Graphics startup compatibility must not overwrite the creator's quality choices.
Try the requested context first, then bounded WebGL 2 compatibility configurations;
do not substitute WebGL 1 or label arbitrary scene exceptions as unsupported GPUs.

**Why:** A browser may reject a GPU preference or hardware antialiasing while still
supporting WebGL 2. Separately, a model/rendering exception is not evidence that the
browser lacks WebGL. Browser-disabled graphics cannot be enabled by application JavaScript.

**How to apply:** Preserve saved render settings, surface context-creation reasons,
and keep a lost canvas mounted with its loss event cancelled so Three.js and the
browser can restore it. Treat automatic restoration and a user-requested graphics
restart as different recovery paths, neither of which should rewrite scene data.

Software mesh previews, including full editor fallbacks, need their own rendering budget and depth-sort checks;
never substitute unrelated illustration art when a preview must show actual models.

**Why:** SVG mesh rendering has no depth buffer. Excessive tessellation can stall
the browser, while very large ground triangles can paint over characters' legs
even when their camera-space bounds are correct.

**How to apply:** Preserve full-detail source/WebGL models, use appropriately
sampled geometry for software previews even in the full editor, subdivide broad ground surfaces
enough for painter sorting, and inspect the resulting image rather than trusting
face counts or element presence alone.

Changing a custom hook's hook count during a live Vite session can leave an
existing component with its old layout and cause a hook-order error.

**Why:** Adding a ref during a running browser check triggered this error;
restarting and reloading restored a healthy fresh mount.

**How to apply:** Keep source stable during browser verification. After changing
hook layouts, reload before diagnosing normal navigation as broken.

When cheap checks time out after browser testing, inspect process memory before
assuming a new application regression.

**Why:** Screen recorders left over from completed browser tests retained several
gigabytes of memory and stalled unrelated Node checks. Ending only those
completed-test recorders restored normal check performance.

**How to apply:** Check process ownership and whether the test is finished before
cleaning up a recorder. Do not terminate active tests or user application services.

An exported Three.js constant is not proof that the renderer still supports it.
`PCFSoftShadowMap` remains exported but the installed renderer warns and falls
back to `PCFShadowMap`; use supported PCF filtering and the light's shadow radius.

**Why:** Inspecting the installed renderer exposed a removed shadow mode that
still passed TypeScript checks. Selecting it would not deliver a new feature.

**How to apply:** Check current renderer behavior rather than old examples when
upgrading graphics. Do not describe a deprecated fallback as a visual improvement.

Standalone esbuild UI fixtures need an explicit automatic JSX transform and a
single resolved React instance; they do not automatically inherit Vite's React plugin.

**Why:** A fixture compiled JSX to an unbound `React` global even though the real
Vite application built successfully, producing a misleading blank screenshot.

**How to apply:** Set esbuild `jsx: 'automatic'`, resolve React consistently with
the app, and surface fixture-root render errors before diagnosing application bugs.

Installing Playwright's clock does not pause it. Do not immediately pause at the
same timestamp supplied to installation; select a comfortably later instant.

**Why:** A same-instant pause passed once but failed on the next run with
`Cannot fast-forward to the past` because time advanced between protocol calls.

**How to apply:** Install and pause before starting the behavior under test,
then advance with `runFor`. Leave a generous future margin when pausing so
test-host latency does not become a playback regression.

Browser tutorial playback needs an open-codec alternative to H.264 MP4.

**Why:** The automated browser delivered a byte-identical valid MP4 but reported
`DEMUXER_ERROR_NO_SUPPORTED_STREAMS`; its H.264 capability was empty while VP9
WebM was supported. Generic `video/mp4` capability returned only `maybe`.

**How to apply:** Keep the full-resolution MP4 downloads, provide silent VP9 WebM
for browser playback, and verify actual playback time advances. Successful HTTP
ranges and ffprobe validation alone do not prove browser decoder compatibility.

An unchanged initial status in a screenshot is not proof that an asynchronous
worker failed; capture browser `pageerror` events before changing runtime code.

**Why:** Static screenshot logs omitted a React initialization exception while a
raw Vite-served verification page remained on “Preparing.” A focused browser
check caught the missing React Refresh preamble and confirmed no worker started.

**How to apply:** Raw verification HTML that imports Vite-transformed TSX needs
the React Refresh preamble, or prebundled React components. When initialization
stalls without a console error, inspect page exceptions and loaded resources
rather than repeatedly taking the same screenshot or weakening worker checks.

## Gizmo verification boundary

Validate transform behavior against the implementation actually used by Drei,
not a different Three.js examples implementation.

**Why:** Those control implementations can differ in drag mathematics. A
camera-aligned named rotation axis can produce zero movement while the
screen-facing roll control still works; testing the wrong implementation or
an unsuitable interaction can falsely suggest a snapping defect.

**How to apply:** Use the installed viewport control implementation for
renderer-free pointer/transform checks when GPU capture is unavailable, and
keep that evidence distinct from visual verification of the real GPU viewport.
