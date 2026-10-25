---
name: Standalone game export
description: Runtime parity, privacy, and build constraints for portable game exports.
---

Standalone games should use the same simulation and renderer as Play/Test, not a second simplified gameplay implementation. Export only runtime data and assets; leave editor sessions, assistant conversations, account data, and imported script source out.

**Why:** A separate demo player would drift from what creators test. Bundling editor state leaks unrelated project information, while executing uploaded scripts outside the existing isolated runners would bypass their safety limits.

**How to apply:** Expand standalone support by packaging the real engine capabilities and their isolation boundaries. Clearly report unsupported online services and scene-transition features; fail on missing assets instead of producing a partial game.

Passing a solver's unit tests and preserving its settings in export JSON do not
prove that Studio Play or the standalone game calls it.

**Why:** Physics work initially reached a legacy preview hook only; the main
3D scene runtime used a different path. Serialization tests passed despite the
missing runtime connection.

**How to apply:** Trace the current Play and export entry points, then test actual
simulation steps in both. When adding physical motion, preserve controller
movement authority and avoid silently opting old authored scenes into new motion.

When collecting third-party license notices from a Vite build, use real package paths represented in the emitted module graph, ignoring virtual module IDs.

**Why:** Package export maps can forbid resolving package.json, and Rollup's CommonJS proxy IDs can contain null bytes rather than filesystem paths.

**How to apply:** Treat virtual IDs as build metadata, not files. Collect licenses from real bundled packages and regenerate the player bundle during development startup and production builds.
