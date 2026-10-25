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

The supplied capture/test Chromium may also fail WebGL 2 context creation with
`BindToCurrentSequence failed`, including when software-rendering flags are used.

**Why:** A browser that can run editor and script tests is not necessarily able
to initialize a GPU or software WebGL renderer in this environment.

**How to apply:** Check actual WebGL 2 availability before attributing a blank
3D viewport to scene code. Keep graphics failures local to the viewport so
project tools remain usable. Report graphics verification as blocked when no
context can be created; DOM-only editor checks do not prove 3D rendering works.

Software mesh thumbnails need their own rendering budget and depth-sort checks;
never substitute unrelated illustration art when a preview must show actual models.

**Why:** SVG mesh rendering has no depth buffer. Excessive tessellation can stall
the browser, while very large ground triangles can paint over characters' legs
even when their camera-space bounds are correct.

**How to apply:** Preserve full-detail source/editor models, use appropriately
sampled geometry for small software previews, subdivide broad ground surfaces
enough for painter sorting, and inspect the resulting image rather than trusting
face counts or element presence alone.

Changing a custom hook's hook count during a live Vite session can leave an
existing component with its old layout and cause a hook-order error.

**Why:** Adding a ref during a running browser check triggered this error;
restarting and reloading restored a healthy fresh mount.

**How to apply:** Keep source stable during browser verification. After changing
hook layouts, reload before diagnosing normal navigation as broken.
