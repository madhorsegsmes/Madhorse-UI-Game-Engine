---
name: Interpreted memory boundaries
description: Why Lua moved off Fengari, and why interpreter memory must be bounded at the actual WASM allocation boundary.
---

Do not reintroduce Fengari as a memory-bounded Lua runner. Preserve a real Lua
allocator ceiling and a physical WASM memory ceiling, with only the raw Lua C
API exposed to the adapter, not object proxies or JS globals.

**Why:** Fengari's allocator APIs are unavailable; guest objects live on the JS
heap. Instruction hooks cannot reject one large native allocation. Wasmoon's
raw C API allows actual allocator rejection without installing host bridges.
The interpreter change deliberately accepts Lua 5.4 / 64-bit integer semantics
instead of Fengari's Lua 5.3 / 32-bit integer behavior.

**How to apply:** When replacing Lua builds, check ordinary scripts, restricted
libraries and coroutine behavior as well as finite single/retained allocations.
Do not substitute polling or worker teardown for allocator enforcement.

Bound the memory the selected interpreter actually uses. A runtime that defines
memory in its WASM binary ignores externally supplied Module.wasmMemory.

**Why:** The pinned .NET and Lua builds define/export memory, while Pyodide
imports it. Configuration that works for one shape is ineffective for the other.

**How to apply:** Fail preparation on unexpected memory layouts. Check growth
rejection against actual prepared binaries and run finite guest allocations
separately from cleanup/recovery. These ceilings are linear-memory limits,
not guarantees about compiler buffers, downloaded assets or total browser RSS.

Runtime preparation may encounter an already-patched loader cache.

**Why:** Studio startup failed on the Python adapter's exact-match guard even
though the cached loader already contained the required physical memory ceiling.
Removing the ceiling would fix startup by weakening isolation.

**How to apply:** Allow repeat preparation only for the exact supported capped
layout. Keep rejection of changed, mixed or duplicate layouts; test both a fresh
distribution and its already-adapted result.

Treat wasmsharp's success flag as compilation success, not proof the guest ran
without an exception.

**Why:** Its runtime prints uncaught guest OutOfMemoryException to stderr but
returns success true. Initial allocation tests exposed this despite correct
physical rejection and successful recovery.

**How to apply:** Preserve the memory diagnostic classification and tests for
both caught and uncaught allocation failure. Stderr recognition is conservative,
not a structured exception API or the safety boundary.
