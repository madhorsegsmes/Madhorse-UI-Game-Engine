---
name: Game script safety
description: Safety boundary for importing and executing user-provided game scripts.
---

Game scripts may be imported and stored as project data, but must not execute directly in the app or on the server. Enable execution only through a runtime isolated from the app, host, and other users, with explicit limits on available APIs and resources.

**Why:** Uploaded scripts are untrusted code and can access or disrupt systems if run without isolation.

**How to apply:** Keep import, language display, and project storage separate from execution. Do not enable a Run action until a constrained runtime has been designed and verified for each supported language.

Bind each isolated run's scene commands to one assigned object. Let scripts name that capability as `self`, validate all commands against the trusted target ID in the editor, and never expose scene/editor objects or project access to the worker.

**Why:** A script attached to one scene object must not gain authority over the Player or other project objects just because it can print a valid command.

**How to apply:** When expanding the scene API, keep the object binding in the host-side runtime context, not in script-provided data; preview changes remain temporary and object-local.

The user chose “All listed languages” and “Keep all languages; load runtimes only when needed”: Python, C, C++, JavaScript, TypeScript, Lua, and C#.

**Why:** The user explicitly chose full language coverage rather than reducing the supported languages to reduce runtime size.

**How to apply:** Preserve that coverage and on-demand loading when changing the runtime architecture.

Opaque-origin sandbox frames cannot reliably start Blob **module** workers in the preview browser. A classic Blob worker can dynamically import the module runtime while retaining the opaque origin and inherited CSP.

**Why:** Browser verification failed before any runtime request with Blob module workers, but the classic-worker bootstrap successfully ran JavaScript, TypeScript, Python, and Lua.

**How to apply:** Keep the opaque-origin boundary; do not add `allow-same-origin` just to work around worker startup. Verify the bootstrap in the actual preview browser when changing it.

For the first scene, prefer a shared, reserved stdout command protocol over
adding a host-object bridge separately to each language.

**Why:** All seven runners already expose stdout, including compiled WASI and
buffered C#. Reusing it preserves language parity without expanding each
interpreter's host capabilities. Validation must still happen independently in
the editor; worker-side parsing is not a trust boundary.

**How to apply:** Keep the scene API narrow and versioned. Treat buffered
languages as buffered rather than promising live per-frame updates. Future
animation or readback needs a separate constrained design, not direct editor
references.

Keep the saved starting position shared between the scene editor and explicit
starting-coordinate controls, rather than persisting two independent starts.

**Why:** Dragging or Inspector edits and a separate start field would otherwise
disagree about where Reset and reload should put the player. Preview-only script
movement must never become a saved editor edit.

**How to apply:** When integrating scene editing with scripting, preserve one
saved starting state and a separate runtime preview. Migrate older starts without
overwriting newer scene edits.

Do not treat a configured interpreter memory or stack limit as proof that the
selected WebAssembly build enforces it. Verify with bounded allocations and
finite recursion, separately from worker termination and subsequent-run recovery.

**Why:** Bounded probes against the selected QuickJS build accepted retained
allocations above its configured heap limit; JavaScript therefore needs an
independent physical WASM memory ceiling (see `javascript-memory-boundary.md`).
An oversized guest-stack budget let native WASM stack exhaustion prevent normal
unwinding, obscuring it with a disposal assertion (see `javascript-stack-boundary.md`). Worker/frame
cleanup and successful reruns still worked, so recovery alone did not prove
either resource guard.

**How to apply:** Preserve separate assertions for resource enforcement,
bounded diagnostics, cleanup, and recovery when changing interpreter builds.
Do not weaken isolation or stress machine-wide memory to validate a guest limit.
