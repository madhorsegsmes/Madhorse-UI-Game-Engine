---
name: JavaScript stack boundary
description: Guest linear-stack accounting does not bound native WASM call frames.
---

Keep the QuickJS guest stack ceiling conservatively below the host's native
WASM call-stack limit. Do not increase it based only on available linear memory.

**Why:** A 512 KiB guest setting allowed V8 to throw a native stack RangeError
before QuickJS could unwind, leaving live engine objects; disposal then masked
the original failure with a GC assertion. A stricter 64 KiB ceiling permits a
normal catchable guest stack error and clean disposal.

**How to apply:** Check finite recursion in both source and browser bundle and
the actual isolated browser worker when changing the engine or stack budget.
Recovery after discarding a worker does not prove clean unwinding. Preserve
both original and cleanup errors if disposal itself fails; never hide the
assertion or translate a native trap into claimed guest-stack enforcement.
