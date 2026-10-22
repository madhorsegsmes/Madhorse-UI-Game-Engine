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
