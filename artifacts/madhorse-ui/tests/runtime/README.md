# Imported-script browser regression checks

From the repository root:

```sh
pnpm --filter @workspace/madhorse-ui run test:runtime:install
pnpm --filter @workspace/madhorse-ui run test:runtime
```

The suite builds the real app, starts its production file server on the reserved
test port 4174, and runs the same suite in Chromium, Firefox, and WebKit with
fresh browser storage per test. WebKit is Playwright's Safari-engine coverage,
not a claim that physical iOS devices or released Safari versions were tested. It never
deploys anything, calls real private APIs, or changes existing user projects.
Do not run multiple copies against the same port.

## Imported 3D file rendering and reload checks

```sh
REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE=/repl/tools/bin/chromium \
  pnpm --filter @workspace/madhorse-ui run test:runtime editor.spec.ts \
  --project=chromium --grep 'GPU (glb|gltf|obj|fbx|dae|invalid|local model)'
```

Omit the executable override on hosts using Playwright's installed Chromium.
The cases also participate in the normal three-engine suite. WebGL 2 is required:
an unavailable context fails explicitly, never skips or passes using the SVG
fallback. Capability/renderer details and canvas screenshots accompany results.

The small, self-authored fixtures in `model-fixtures.ts` exercise real GLB,
glTF, OBJ, ASCII FBX and Collada loaders. Each imports through the asset input,
assigns through the editor, and checks the actual game canvas's scalene triangle
silhouette against projected vertices, then repeats after a genuine reload.
The stored model reference and editor ready notice are checked as well.
Malformed files must retain their filename-specific error after reload without
a ready/loading notice or a whole-viewport graphics failure. A glTF with an
encoded relative PNG path checks local texture resolution and IndexedDB
persistence; a missing texture must produce the dependency-specific error.
These are deliberately small static models, not proof of all exporter variants,
binary FBX, skeletal animation, or hardware-GPU compatibility.

## Animation interpolation and looping checks

```sh
node --test artifacts/madhorse-ui/tests/runtime/animation-tracks.test.mjs
pnpm --filter @workspace/madhorse-ui run test:runtime animations.spec.ts --project=chromium
```

Use the Chromium executable override below when needed in Replit. The browser
spec also runs in the configured Firefox and WebKit projects on supported hosts.
The sampler checks all position/rotation axes and scale at intermediate times,
uneven keyframe intervals, exact keys, and clamped/held endpoint poses. Panel 3
checks forward/backward scrubbing and uses Playwright's clock to advance the
actual preview interval across two loop boundaries. It checks the elapsed-time
remainder rather than accepting a reset to zero, then verifies Stop restores
the authored pose, cancels subsequent frames, and permits restarting playback.
The timeline slider rounds to 0.01 seconds; scene transforms must retain the
unrounded playback time. No production code is replaced or mocked.

## Game Camera graphics checks

Run the focused WebGL output checks (no SVG/DOM fallback counts as a pass):

```sh
REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE=/repl/tools/bin/chromium \
  pnpm --filter @workspace/madhorse-ui run test:runtime \
  game-camera.spec.ts editor.spec.ts --grep 'GPU|WebGL 2 renderer' --project=chromium
```

Omit the executable override on a normal Playwright host. Use `--project=firefox`
or `--project=webkit` for the other installed engines. The new cases run at
1280px and 402px; 402px uses touch input capability and device scale factor 2.
These are phone-sized browser contexts, **not physical Android/iOS devices**.

`webgl2-capability` records the actual renderer, WebGL version and user agent.
A missing WebGL 2 context fails explicitly as `ENVIRONMENT`; it is never skipped.
A capable browser that fails to produce the app's WebGL canvas or expected
pixels fails as an application/test assertion. Browser executable/loader errors
occur before the capability check and remain environment failures.

The PNG attachments are compositor captures of the actual WebGL canvas.
Two-color image imports prove top/bottom texture orientation. Active green
sprites are positive controls before testing inactive objects and descendants.
An unlit, scalene glTF triangle proves actual imported geometry rather than
a loader placeholder, with independently projected translated/rotated/scaled
vertex bounds checked against both game and editor output. Returning from the
editor must preserve bounds/centroid within 1.5 CSS pixels and colored area
within 3% (mobile antialiasing changes edge coverage). Inactive models must
disappear. Background pixels outside the central fixture detect editor
grid/axes/gizmos leaking into Game Camera output; editor output provides the
positive control. Only DOM orbit buttons and model notices are temporarily
hidden for the canvas captures; no rendered scene graphics are masked.
The editor triangle's color analysis uses its projected region to exclude
unrelated camera transform handles; the full unmasked screenshot is retained.

Workspace evidence on 2026-10-23 used Chromium 152 with WebGL 2 through
**ANGLE/Vulkan SwiftShader**, not a hardware GPU. It exposed an upside-down
imported texture in the shared sprite renderer, corrected in both views.
The accepted verification scope is Chromium software-rendered WebGL at desktop
and touch/high-DPI phone-sized viewports. This is not cross-engine or physical
device release approval.
Desktop and touch/high-DPI phone-sized checks exercise the real Three/WebGL
path, but do **not** establish hardware-GPU or physical-phone compatibility.
Firefox 1555 and WebKit 2370 could not launch because their Playwright
executables are missing. Matching browsers/host libraries and real
WebGL-2-capable desktop/phone hardware remain necessary for that sign-off.
On those devices verify the same red-over-blue sprite, scalene model with
matching editor transforms, centered aimed square, hidden inactive objects,
and absence of grid/axes/gizmos in game output; record device, OS, browser,
renderer and screenshots. Do not label emulation or SwiftShader as that sign-off.

## CI release gate

`.github/workflows/script-runtime.yml` runs on every pull request, push (including
tags), merge-queue update, and manual dispatch. It uses Ubuntu 24.04, Node 24,
pnpm 10.26.1, a frozen lockfile, and the workspace's own Playwright CLI to install
Chromium, Firefox, WebKit **and** their OS dependencies with `install --with-deps`.
This keeps browser revisions matched to the installed Playwright version.
CI never uses the Replit Chromium override or substitutes one engine for another.

The gate first runs `pnpm --filter @workspace/madhorse-ui run test:runtime:memory`
and `pnpm --filter @workspace/madhorse-ui run test:runtime:stack`
against the source adapter and generated browser bundle, and
`pnpm --filter @workspace/madhorse-ui run test:runtime:interpreters` for Python,
Lua and .NET memory boundaries, then runs
`pnpm --filter @workspace/madhorse-ui run test:runtime` once.
The config keeps one worker, disables parallel mode and retries, and rejects
focused (`test.only`) tests in CI. Do not add browser matrices, shards, skips,
`continue-on-error`, or failure-to-success fallbacks. Missing browsers, missing
features, and failing assertions must fail the gate.

Every run uploads `generated-artifacts/script-runtime/` as
`script-runtime-<run-id>-<attempt>` for 14 days, including failed runs. It contains
HTML/JSON reports, traces, screenshots and attachments when produced, plus
dependency-install, browser-install, and test logs so failures before browser
startup are visible too. These generated files remain ignored by Git and
deployment packaging.

Repository administrators must require the check
**Script runtime (Chromium, Firefox, WebKit)** in the protected release branch's
ruleset/branch protection (including merge queues). Adding a workflow file alone
does not configure repository protection. There is currently no automated
publisher in this repository. A future publishing workflow must call this
workflow as a reusable job (`uses: ./.github/workflows/script-runtime.yml`) and
make publishing depend on that job with `needs`, without an `always()` bypass.
Tag-triggered checks alone cannot block an independent publishing workflow.

### Future publishing and dry-run verification

There is still **no automated publisher**. The manual-only
`.github/workflows/release-dry-run.yml` is a safe integration reference:
`runtime-gate` calls `./.github/workflows/script-runtime.yml`, and
`publish-dry-run` has `needs: runtime-gate`. It only records approval; it has
read-only permissions, no publishing credentials, and no deployment command.
Neither publishing jobs nor publishing steps may use `always()`,
`continue-on-error`, or another failure bypass.

The reusable gate and dry-run checkout both pin `ref: ${{ github.sha }}`.
The gate returns the actual checked `tested-sha`; the dry-run requires that it
matches both the event SHA and its own checkout before approval. For a tag,
this tests the commit selected by that event, not whatever the tag points to
later. A future publisher must build/upload that same checked commit (or consume
artifacts built from it), never fetch a moving branch/tag or approve a different
commit based on an earlier successful workflow. Keep the SHA assertions before
any side effect. Do not add a free-form release ref without resolving it once
and sharing that immutable SHA between the gate and publisher.

Verification without deployment:

```sh
pnpm --filter @workspace/scripts run test:release-gate
```

These local contract tests parse the real workflows, execute the failing and
passing fixture commands, model default dependency scheduling, check bypass
mutations, and execute the actual approval shell against matching/mismatched
commits. They do **not** run GitHub's scheduler or claim browser compatibility.
The real runtime gate also runs them after dependency installation and preserves
their output in `release-gate-test.log`.

On GitHub, manually run **Verify release dependency blocking (no deployment)**
from `.github/workflows/release-gate-verification.yml`. Expected job results:
`passing-gate: success`, `failing-gate: failure`, `allowed-publish: success`,
`blocked-publish: skipped`, `verify: success`. The overall workflow is
**intentionally red** because its negative gate genuinely fails; do not make
it green with `continue-on-error` or require this negative-control workflow
as a protected-branch check. Only the final verification observer uses
`always()` to inspect results; neither publishing sentinel uses it.

Then manually run **Release readiness (no deployment)** on the exact release
branch/tag. Real browser-check failures must skip `publish-dry-run`; passing
checks allow its approval message. Both workflows are non-deploying. Preserve
the run links/results as release evidence. Local checks alone are not evidence
that either workflow has run on GitHub or that the browser matrix passed.

## Local setup and coverage

In Replit, the suite uses `REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE` when supplied
to select the system browser with its required Linux libraries. Elsewhere it
uses the Chromium installed by `test:runtime:install`.
The Chromium executable override applies only to Chromium; Firefox and WebKit
always use their matching Playwright builds. On supported Linux hosts, install
browser OS dependencies with `pnpm --filter @workspace/madhorse-ui exec playwright install-deps`.
In managed environments use the supported system dependency setup instead.
Missing browsers/libraries are setup failures, never unsupported-runtime passes.

All seven runtimes must be installed with the workspace dependencies. Native and
C# compilation can be slow on cold machines; loading/compilation has a separate
180-second allowance. The execution deadline is still checked against real wall
time (five seconds, with scheduler tolerance), not a fake clock. Tests run with
one worker to avoid multiple compiler runtimes exhausting memory. No retries
hide intermittent failures.

Coverage includes real file import and output, syntax failure followed by rerun,
runaway termination and manual Stop for every language, genuine C17 semantics,
empty JS/Python host capabilities, outer opaque-frame/CSP isolation, lazy runtime
downloads, a 390px Script panel, and production GET/HEAD/304 CORS and MIME headers.
Explicit compatibility checks observe the real classic-worker bootstrap in its
opaque origin, dynamic runner import, WASM instantiation, and anonymous Python
WASM loading. The 390px mobile layout, Stop, timeout and recovery checks run in
every engine, not just Chromium.
Scene coverage includes movement through every language, exact command schema
validation, ordered relative movement, invalid JSON, unknown actions and objects,
out-of-bounds positions, command quotas, forged worker messages, reset, Stop,
timeout, and project switching. See `runtime/GAME_API.md` for the API contract.

HTML and JSON reports, traces, diagnostic attachments and failure screenshots are under
`generated-artifacts/script-runtime/` at the repository root, ignored by Git and
deployment packaging. To inspect a failure:

```sh
pnpm --filter @workspace/madhorse-ui exec playwright show-report ../../generated-artifacts/script-runtime/report
```

For a focused rerun, append `--grep "C is compiled"` (or another test title) to
`test:runtime`. A full run is required before shipping runtime changes.
Select an engine with `--project=firefox` or `--project=webkit`.

## Bounded resource and teardown regressions

Run the focused cases with:

```sh
pnpm --filter @workspace/madhorse-ui run test:runtime resources.spec.ts
```

These cases use the real Script panel and production runtime with one worker:

- Exactly 16,000 output characters including the emitted newline; rejection of
  an oversized line, cumulative lines, and embedded newlines.
- Oversized thrown errors rejected with a short diagnostic before host copying.
- Shared finite log cases for source, minified bundle and Script panel: nested
  strings/objects, wide arrays/objects, cycles, expanding shared graphs, escaping,
  custom `toJSON`, replaced intrinsics and large error payloads.
- Finite memory allocation (96 arrays of 65,536 slots, approximately 48 MiB of
  QuickJS values) and finite 20,000-level recursion against the configured
  32 MiB heap / 64 KiB stack limits. Never use unbounded host-memory stress.
- Three cycles of completion, failure, and Stop, fresh globals/output,
  removal of sandbox frames, and recovery beyond the old execution deadline.
- Stop while either the worker bootstrap or JavaScript runtime asset is held
  at the network boundary. A subsequent run completes before the old real
  asset is released, and late delivery must not alter its result.

Each case checks teardown and successful subsequent execution. Resource cases
also attach the original status/output and successful recovery as
`resource-limit-observation`. Stop locators explicitly target the Script panel,
not the separate game Stop control.

### Python, Lua, C# and native memory budgets

| Runtime | Enforced boundary | Notes |
| --- | --- | --- |
| Python / Pyodide 0.29.4 | 64 MiB total WASM linear memory | Less is available to Python objects after interpreter overhead |
| Lua / Wasmoon 1.16.0 (Lua 5.4) | 16 MiB live Lua allocator budget; 32 MiB total WASM linear memory | Raw Lua C API only; no JS proxies or object injection |
| C# / wasmsharp 0.10.2 | 256 MiB total WASM linear memory | Includes .NET, loaded assemblies, Roslyn compilation and guest heap |
| C / C++ | Existing 64 MiB guest WASM linker maximum | Native compiler's own memory is separate; this does not cap compilation |

Fengari 0.1.5 has no usable allocator control: `lua_getallocf` and
`lua_setallocf` only warn that they are unavailable. Its tables and strings
are browser JavaScript allocations, and instruction hooks cannot stop a single
large native string/table allocation. Polling heap usage, replacing a few
library functions or limiting the worker lifetime would not provide a memory
boundary. Lua therefore uses a WASM-backed interpreter instead of pretending
Fengari is bounded. This changes Lua 5.3 / Fengari's 32-bit integer semantics
to Lua 5.4's 64-bit integers. Existing restricted libraries remain `_G`, table,
string, math, utf8 and coroutine. io, os, package, debug, require, dofile,
loadfile and Wasmoon JS bridges are not exposed. The outer five-second worker
deadline still governs execution; it is not allocation enforcement.

Preparation makes guarded changes to **cached runtime assets**, never
`node_modules` package sources or checked-in binaries:

- Pyodide imports its memory. Its generated loader creates a bounded memory
  with maximum 1,024 pages. The exact pinned constructor must match once or
  preparation fails, rather than silently shipping an uncapped loader.
- .NET and Lua **define/export** their memory. `Module.wasmMemory` cannot
  override it. Preparation rewrites only the WASM memory section to maxima of
  4,096 and 512 pages, respectively. It validates the input/output modules and
  rejects missing/multiple memories, shared/memory64 layouts, incompatible
  initial sizes and unexpectedly smaller upstream maxima.
- Lua additionally uses `lua_newstate` with an allocator that checks live
  malloc/realloc sizes before allocating, including native library operations.
  Freeing an allocation returns its budget. Catching a Lua allocation error
  cannot increase either ceiling.
- C/C++ keep the existing `-Wl,--max-memory=67108864` flags; browser tests
  exercise real `memory.grow` and `malloc` rejection without replacing them.

Wasmsharp's `success` flag indicates **compilation** success, not successful
execution. The pinned runtime catches guest exceptions and prints their stack
to stderr while returning `success: true`. The adapter conservatively recognizes
`System.OutOfMemoryException:` in stderr and reports a failed run. This is only
diagnostic classification, not the enforcement mechanism; guest-written stderr
can mimic that diagnostic. A guest-caught OutOfMemoryException can finish
normally and still cannot exceed the physical ceiling.

None of these numbers is a total browser/worker RSS limit. Download buffers,
compiled WASM code, JS adapters, filesystem backing storage and compiler
overhead outside WASM remain outside the physical ceiling. No new guest host
APIs, network access or additional workers are added. Each execution still uses
one fresh worker in the opaque-origin frame, so memory is not shared across
runs. Main source is capped at 262,144 UTF-16 code units; at most 64 companion
files with names of at most 255 code units are accepted, and source plus copied
companion contents are capped at 1,048,576 code units before interpreter loading.
These are character limits, not byte/RSS measurements.

Run direct checks with:

```sh
pnpm --filter @workspace/madhorse-ui run test:runtime:interpreters
```

They instantiate the actual prepared Lua/.NET binaries, grow exported memory
to the ceiling and assert that one additional page fails. Python's test captures
the real memory created during initialization, verifies the interpreter uses
it, and tests its physical maximum after finite guest allocations. Python and
Lua single allocations, retained allocations, strings/tables, caught failures,
small useful allocations and recovery are checked independently. Source-set
rejection is checked before runtime loading. Layout changes fail closed.

The browser resource suite exercises the prepared production adapters with
single and retained allocation failures and same-language fresh-run recovery
for Python, Lua and C#. Probes remain finite even if a guard regresses:
Python requests at most 80 MiB; Lua 20 MiB in one request or 24 retained 1 MiB
strings; C# 272 MiB in one request or 72 retained 4 MiB blocks (288 MiB).
Assertions distinguish memory diagnostics from the five-second timeout,
startup errors, bounded editor output, frame removal and recovery. Additional
C# coverage catches failures repeatedly and performs useful work in a fresh run.
Ordinary execution, syntax errors, Stop, timeout and isolation remain separate
required browser tests. The .NET baseline needs a larger budget because Roslyn
and assemblies share the same linear memory as the guest; this is not a promise
of 256 MiB usable guest heap.

Pinned implementation references:
- Pyodide: installed `pyodide/pyodide.asm.js` (`initMemory`, resize heap) and
  https://github.com/pyodide/pyodide/tree/0.29.4
- Fengari: https://github.com/fengari-lua/fengari/blob/v0.1.5/src/lapi.js
- Wasmoon: installed `wasmoon/dist/index.js` (`Global` allocator and `LuaWasm`)
  and https://github.com/ceifa/wasmoon
- wasmsharp: installed `@wasmsharp/core/dotnet.native.js` (`receiveInstance`,
  `growMemory`) and https://github.com/JakeYallop/WasmSharp

Verification on 2026-10-23: five direct interpreter/source-input checks passed,
as did the four existing JavaScript source/bundle memory and stack checks,
application and browser-test TypeScript checks, and five release-gate contract
checks. The focused Chromium production run passed **40/40** tests across
`resources.spec.ts`, `execution.spec.ts` and `isolation.spec.ts`, including all
seven languages' execution/syntax/Stop/timeout checks, every new allocation
probe, same-language recovery, caught C# failures and native growth/malloc
rejection. The app workflow restarted cleanly and the editor loaded. The
preview browser still reported the existing WebGL-context environment failure;
no graphics claim is made. Firefox/WebKit and the complete unrelated editor
suite were not rerun for this change; this is not full cross-engine release
approval. Matching browser builds/host libraries are still required as described
below.

### Enforced JavaScript memory budget

The adapter keeps QuickJS's `setMemoryLimit(32 MiB)` but does **not** trust it
as the enforcement boundary. In the pinned QuickJS 0.32.0 single-file browser
release variant, upstream `vendor/quickjs/quickjs.c` returns zero from
`js_def_malloc_usable_size` under `EMSCRIPTEN`. The malloc/free/realloc accounting
therefore omits allocation payloads. The original finite array probe retained
about 48 MiB while `computeMemoryUsage` reported that usage and a 32 MiB limit.
The bundler did not remove the limit call; the underlying allocator accounting
was defective.

`runtime/javascript.mjs` now supplies its own `WebAssembly.Memory` through
`newVariant`, with 256 initial pages (16 MiB) and a maximum of 512 pages (32 MiB).
It verifies the engine actually uses that memory and fails initialization
otherwise. The WebAssembly maximum bounds **all linear memory**, including
guest allocations, engine state, stack and FFI overhead. Consequently the usable
guest heap is somewhat less than 32 MiB. This is not a total browser/worker RSS
limit: the browser, compiled WASM code, adapter JS and TypeScript transpiler
remain outside linear memory. It does not expose the memory or any new host API
to guest scripts. The existing one-worker, input/output and wall-clock limits
remain unchanged.

The existing variant honors supplied memory and returns allocation failure when
growth is refused. QuickJS turns that into a bounded `out of memory` diagnostic;
this works even for one large native allocation that cannot be stopped by
periodic interrupts. No memory-usage polling or timeout is used as the memory
guard. Dev and production both bundle this adapter through `prepareRuntimes`.

Run the finite direct-engine regressions (source **and** the real minified browser
bundle) with:

```sh
pnpm --filter @workspace/madhorse-ui run test:runtime:memory
```

They check retained arrays, ArrayBuffers, strings, array reallocation and a
single oversized allocation; success below the budget with growth beyond the
initial memory; caught failures not bypassing the limit; host API isolation;
and fresh-context recovery after every failure. The browser memory regression
is now an ordinary required assertion in every engine, independently of cleanup.

Verification after this fix: both direct-engine checks passed. The focused
Chromium run completed 17 ordinary passes (including the memory regression,
JavaScript/TypeScript execution, timeout/Stop/recovery, output limits and
isolation) and the one existing expected stack-diagnostic failure. Its memory
observation was `Script stopped with an error.`, `out of memory`, successful
recovery and zero remaining sandbox frames. Test TypeScript checking passed.
Firefox and WebKit were not rerun for this change; their missing-browser setup
blocker documented below remains, and three-engine release approval is not claimed.

Upstream references for the pinned build:
- https://github.com/justjake/quickjs-emscripten/blob/v0.32.0/vendor/quickjs/quickjs.c
- https://github.com/justjake/quickjs-emscripten/blob/v0.32.0/templates/pre-wasmMemory.js
- https://github.com/justjake/quickjs-emscripten/blob/v0.32.0/packages/variant-quickjs-singlefile-browser-release-sync/Makefile

### JavaScript stack diagnostics and safe disposal

The former Chromium stack expected-failure annotation has been removed. The
same finite 20,000-level recursion must now report `stack overflow` normally;
bounded output, frame removal, enabled controls and subsequent execution remain
independent assertions. The test also rejects disposal assertions and native
`Maximum call stack size exceeded` errors.

The old 512 KiB QuickJS stack setting bounded the engine's linear-memory stack,
not native WASM call frames. A direct probe showed `evalCode` throwing a host
`RangeError: Maximum call stack size exceeded` before returning any result/error
handle. Because this bypasses QuickJS's normal unwinding, `JS_FreeRuntime` then
asserted `list_empty(&rt->gc_obj_list)` and masked the original failure. This was
not an ordinary leaked evaluation-error handle. Both source and the production
bundle reproduced it under V8.

The adapter now uses a stricter **64 KiB guest stack ceiling** so QuickJS raises
its own catchable `InternalError: stack overflow` and unwinds before the native
stack is exhausted. This deliberately reduces allowed recursion rather than
enlarging host limits or reclassifying a native trap as a successful guest guard.
It is not a general guarantee about every browser's native stack size.
The 32 MiB physical WASM memory ceiling, opaque frame, worker boundary, output
cap and wall-clock deadline are unchanged.

Error handles are released in `finally`, including when bounded guest formatting
fails. Thrown Promise payloads are not unwrapped. Logger/console setup handles are similarly protected. Both
context and runtime disposal are attempted; if cleanup also fails, an
`AggregateError` retains the original failure first and includes every cleanup
failure in its visible message. No assertion is caught and silently discarded.

### Bounded JavaScript log/error conversion

The trusted formatter runs inside QuickJS and retains captured intrinsics in a
private closure. The only logging bridge receives an already bounded string;
neither logs nor exceptions use host-side `context.dump` or graph serialization.
The guest checks the remaining 16,000-character per-run allowance (including
newlines) before crossing the bridge. Nested strings and keys are length-checked
before escaping, then checked again for expansion. Traversal rejects more than
32 levels, 1,024 visited values/keys or circular references. Shared acyclic
values remain valid until they reach the traversal or character budget.

Ordinary `print` and console methods, JSON-like objects/arrays, custom `toJSON`
and Error diagnostics remain supported. Getters, proxy traps and `toJSON` execute
only inside the guest, under the existing memory, stack and deadline limits.
Oversized/unformattable uncaught errors get a fixed short diagnostic instead of
dumping their payload; ordinary error messages remain readable. No guest
reflection method or host API is added. The runner/editor output caps remain
independent defenses; this is not a total host-JavaScript/RSS memory guarantee.

Run the direct finite source/bundle checks with:

```sh
pnpm --filter @workspace/madhorse-ui run test:runtime:stack
```

They reuse one initialized WASM module through repeated stack failures and fresh
runtimes, check ordinary recursion, guest-caught stack errors (also in pending
Promise jobs), and ordinary/primitive/Promise exceptions. The original browser
resource case remains responsible for frame teardown and editor recovery.

Stack-fix verification on 2026-10-22: both direct source/bundle stack tests and
both direct memory tests passed, as did app and browser-test TypeScript checks.
The full 186-test browser matrix was run once with one worker, no retries and no
skips. Chromium passed 51/62 tests, including **all ten resource/teardown tests**,
all seven languages' execution/Stop/timeout checks, and all isolation checks.
The stack observation was `Script stopped with an error.`, `stack overflow`,
successful recovery and zero remaining sandbox frames, with no expected failure.

The full matrix still exits nonzero: Chromium's eleven other failures concern
WebGL canvas creation, the unavailable model-status element, seven scene
accessible-name expectations missing the current `z` coordinate, and two saved
scene-position assertions. Firefox and WebKit each passed two server-only tests
and failed sixty browser tests before their bodies because the matching
`firefox-1555` and `webkit-2370` executables are absent. These failures were not
changed, skipped, or relabeled as stack failures. Full cross-engine release
approval is not claimed. The ignored JSON/HTML reports preserve all results.

Historical verification before the memory fix on 2026-10-22: test TypeScript check passed; Chromium had
8 ordinary passes and the 2 documented expected failures, with teardown and
recovery passing for all 10 cases. The other 20 cases failed before test bodies
because the matching Firefox 1555 and WebKit 2370 browser executables were absent.
The focused three-engine command therefore exits nonzero; compatibility remains
unverified until those engines and their matching host libraries are available.
No runtime implementation was changed as part of this regression-only work.

## Unsupported features and release failures

There are no engine-wide skips, automatic retries, or catch-and-pass fallbacks.
All seven language tests remain required in all three engines. A missing runtime
feature must fail with the visible Script status/output and browser errors in
the `runtime-diagnostics` attachment; worker capabilities are attached separately.
Do not relabel download errors, missing Linux libraries, timeouts, or generic
startup errors as an unsupported language. Confirm the exact missing engine
feature first and record its affected engine/version, language, error and
reproduction here before considering any narrowly scoped expected failure.
An expected failure must also fail the suite when it unexpectedly starts passing.
No language-wide unsupported runtime features have been confirmed or exempted.
The historical Chromium resource defects above are recorded separately;
they no longer have expected-failure annotations.

### Workspace verification: 2026-10-22

Both the application and runtime-test TypeScript checks passed. The complete
111-test matrix was attempted without retries or skips:

| Project | Passed | Failed | Result |
| --- | ---: | ---: | --- |
| Chromium | 37 | 0 | All runtime, isolation, mobile and server checks passed |
| Firefox | 2 | 35 | Server-only checks passed; browser launch blocked by host libraries |
| WebKit | 2 | 35 | Server-only checks passed; browser launch blocked by host libraries |

Firefox's downloaded build could not load `libgtk-3.so.0` / XPCOM. WebKit
reported missing GTK, GStreamer, ICU 74 and other shared libraries before launch.
These are **environment setup failures, not confirmed unsupported runtime
features**. Firefox and WebKit runtime compatibility therefore remains
unverified, and the full matrix exits nonzero. Do not treat the server-only
passes as browser coverage or release approval. Install matching host
dependencies on a supported runner and rerun both engine projects before release.
The JSON/HTML reports preserve all 70 launch failures under the ignored evidence
directory.
