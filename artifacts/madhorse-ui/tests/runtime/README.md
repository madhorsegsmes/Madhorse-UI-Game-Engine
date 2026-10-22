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
No unsupported runtime features have been confirmed or exempted yet.

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
