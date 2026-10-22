# Imported-script browser regression checks

From the repository root:

```sh
pnpm --filter @workspace/madhorse-ui run test:runtime:install
pnpm --filter @workspace/madhorse-ui run test:runtime
```

The suite builds the real app, starts its production file server on the reserved
test port 4174, and uses Chromium with fresh browser storage per test. It never
deploys anything, calls real private APIs, or changes existing user projects.
Do not run multiple copies against the same port.

In Replit, the suite uses `REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE` when supplied
to select the system browser with its required Linux libraries. Elsewhere it
uses the Chromium installed by `test:runtime:install`.

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

HTML reports, traces, and failure screenshots are under
`generated-artifacts/script-runtime/` at the repository root, ignored by Git and
deployment packaging. To inspect a failure:

```sh
pnpm --filter @workspace/madhorse-ui exec playwright show-report ../../generated-artifacts/script-runtime/report
```

For a focused rerun, append `--grep "C is compiled"` (or another test title) to
`test:runtime`. A full run is required before shipping runtime changes.
