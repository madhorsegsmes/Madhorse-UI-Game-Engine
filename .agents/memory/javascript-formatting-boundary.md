---
name: JavaScript formatting boundary
description: Keep log and exception conversion within the guest until strings are bounded.
---

Bound both log formatting and exception formatting before copying values into
host JavaScript. Use a trusted guest closure with captured intrinsics and a
private string-only sink; do not restore unrestricted host graph dumping.

**Why:** A physical WASM memory ceiling does not bound host allocations made
while dumping a guest graph. Even a small shared guest graph can expand into a
very large serialized tree. A final editor output cap is too late to prevent it.

**How to apply:** Keep character, traversal and depth budgets inside the guest.
Treat getters, proxies and custom serialization as untrusted guest execution,
not host reflection. Check finite graphs and exception payloads in source,
the actual browser bundle and the Script panel, separately from cleanup/recovery.
Promise payloads must not be unwrapped just to report an exception.
