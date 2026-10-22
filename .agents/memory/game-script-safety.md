---
name: Game script safety
description: Safety boundary for importing and executing user-provided game scripts.
---

Game scripts may be imported and stored as project data, but must not execute directly in the app or on the server. Enable execution only through a runtime isolated from the app, host, and other users, with explicit limits on available APIs and resources.

**Why:** Uploaded scripts are untrusted code and can access or disrupt systems if run without isolation.

**How to apply:** Keep import, language display, and project storage separate from execution. Do not enable a Run action until a constrained runtime has been designed and verified for each supported language.
