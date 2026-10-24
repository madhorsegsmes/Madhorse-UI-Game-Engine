---
name: Madhorse Studio Clerk React compatibility
description: React version alignment required by the Clerk SDK installed in Madhorse Studio.
---

Keep React and ReactDOM matched at 19.1.4 in Madhorse Studio while its Clerk packages require that peer range; the workspace catalog remains at 19.1.0.

**Why:** Clerk did not accept the workspace catalog version, and a React/ReactDOM mismatch prevented the Studio app from mounting.

**How to apply:** When updating Clerk or React in Madhorse Studio, verify the SDK's peer requirements and update both React packages together. Rebuild the app and refresh Vite's optimized dependency cache after version changes.
