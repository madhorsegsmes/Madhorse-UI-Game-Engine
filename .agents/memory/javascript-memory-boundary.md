---
name: JavaScript memory boundary
description: Why the JavaScript runtime requires an actual WebAssembly memory ceiling, not just QuickJS heap accounting.
---

Keep an explicit WebAssembly linear-memory maximum as the JavaScript memory
boundary, even while also setting the interpreter's heap limit. The budget
includes interpreter, stack and FFI overhead, so guest-usable space is smaller;
it is not a total browser/worker RSS guarantee.

**Why:** The pinned Emscripten QuickJS allocator reports usable allocation size
as zero and undercounts retained allocations. Both direct and real-browser
finite probes completed above the interpreter's configured limit. A physical
WASM ceiling rejects growth even during a single native allocation, unlike
periodic polling. Retaining this variant avoids changing guest language
semantics or introducing a custom engine build.

**How to apply:** Verify replacement variants actually use the supplied bounded
memory and return bounded allocation errors. Test finite allocations against
both source and the browser bundle, separately from teardown and recovery.
Do not replace the hard ceiling with memory polling, timeout-only protection,
or a claim that successful worker disposal proves enforcement.
