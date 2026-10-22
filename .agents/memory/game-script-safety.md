---
name: Game script safety
description: Safety boundary for importing and executing user-provided game scripts.
---

Game scripts may be imported and stored as project data, but must not execute directly in the app or on the server. Enable execution only through a runtime isolated from the app, host, and other users, with explicit limits on available APIs and resources.

**Why:** Uploaded scripts are untrusted code and can access or disrupt systems if run without isolation.

**How to apply:** Keep import, language display, and project storage separate from execution. Do not enable a Run action until a constrained runtime has been designed and verified for each supported language.

The user chose “All listed languages” and “Keep all languages; load runtimes only when needed”: Python, C, C++, JavaScript, TypeScript, Lua, and C#.

**Why:** The user explicitly chose full language coverage rather than reducing the supported languages to reduce runtime size.

**How to apply:** Preserve that coverage and on-demand loading when changing the runtime architecture.

Opaque-origin sandbox frames cannot reliably start Blob **module** workers in the preview browser. A classic Blob worker can dynamically import the module runtime while retaining the opaque origin and inherited CSP.

**Why:** Browser verification failed before any runtime request with Blob module workers, but the classic-worker bootstrap successfully ran JavaScript, TypeScript, Python, and Lua.

**How to apply:** Keep the opaque-origin boundary; do not add `allow-same-origin` just to work around worker startup. Verify the bootstrap in the actual preview browser when changing it.
