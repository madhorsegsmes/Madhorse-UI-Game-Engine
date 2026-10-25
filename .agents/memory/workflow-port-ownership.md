---
name: Workflow port ownership
description: Diagnose stale listeners after managed workflow restarts without changing artifact routing or stopping unrelated services.
---

A failed managed workflow does not prove its old server process has stopped.

**Why:** After an automatic restart, Studio reported a port-in-use startup
failure while a Studio Vite process still held the expected listener. Changing
artifact ports would have hidden the process-lifecycle problem and risked routing.

**How to apply:** Verify the actual listener's PID, working directory and command
before stopping only the identified stale service. Then use its existing managed
workflow. Never broadly kill all Vite/Node processes or create replacement
workflows. Do not assume network diagnostic commands or IPv6 process files are
available in this container.
