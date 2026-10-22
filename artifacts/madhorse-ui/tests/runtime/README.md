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

## CI release gate

`.github/workflows/script-runtime.yml` runs on every pull request, push (including
tags), merge-queue update, and manual dispatch. It uses Ubuntu 24.04, Node 24,
pnpm 10.26.1, a frozen lockfile, and the workspace's own Playwright CLI to install
Chromium, Firefox, WebKit **and** their OS dependencies with `install --with-deps`.
This keeps browser revisions matched to the installed Playwright version.
CI never uses the Replit Chromium override or substitutes one engine for another.

The gate first runs `pnpm --filter @workspace/madhorse-ui run test:runtime:memory`
against the source adapter and generated browser bundle, then runs
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
- A 32,000-character thrown error, bounded to the editor's 16,000-character
  console limit.
- Finite memory allocation (96 arrays of 65,536 slots, approximately 48 MiB of
  QuickJS values) and finite 20,000-level recursion against the configured
  32 MiB heap / 512 KiB stack limits. Never use unbounded host-memory stress.
- Three cycles of completion, failure, and Stop, fresh globals/output,
  removal of sandbox frames, and recovery beyond the old execution deadline.
- Stop while either the worker bootstrap or JavaScript runtime asset is held
  at the network boundary. A subsequent run completes before the old real
  asset is released, and late delivery must not alter its result.

Each case checks teardown and successful subsequent execution. Resource cases
also attach the original status/output and successful recovery as
`resource-limit-observation`. Stop locators explicitly target the Script panel,
not the separate game Stop control.

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

### Remaining confirmed Chromium resource defect

The stack diagnostic is a separate pre-existing defect:

| Guard | Expected | Observed |
| --- | --- | --- |
| 512 KiB stack | Bounded stack-overflow error | Disposal reports `Aborted(Assertion failed: list_empty(&rt->gc_obj_list) ... JS_FreeRuntime)` instead |

Only the stack's final diagnostic assertion is marked as an expected failure
in Chromium. **All preceding boundedness, teardown, and recovery assertions
must pass before that annotation is applied.** A corrected runtime unexpectedly
passing the final assertion fails the test, requiring removal of the annotation.
Firefox/WebKit have no such annotations because these defects have not been
confirmed in those engines. These are not language-wide skips, memory-safety
passes, or release approval. Teardown alone is not proof of resource enforcement.

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
The narrowly scoped Chromium resource defects above are recorded separately;
they do not exempt any language or engine from the existing execution checks.

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
