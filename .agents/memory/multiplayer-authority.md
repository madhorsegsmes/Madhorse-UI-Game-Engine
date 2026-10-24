---
name: Multiplayer authority
description: Authority boundaries for Madhorse's lightweight multiplayer play tests.
---

Shared scene-object transforms are host-authoritative; each participant supplies only their own player transform. Never feed the host's earlier shared-object snapshot back into its own running simulation.

**Why:** Accepting every client's copy of a shared transform creates competing writers. Reapplying the host's delayed snapshot every frame also resets its current movement between network updates.

**How to apply:** Preserve this separation when improving synchronization or moving from polling to another transport. A future ownership-transfer feature needs explicit server-side authority rather than trusting a client flag.
