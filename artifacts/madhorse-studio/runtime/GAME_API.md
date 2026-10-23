# First-scene script API (version 1)

Scripts remain browser-local. No runtime receives an editor object, browser
handle, database connection, or general message-sending capability.

Every language can print a reserved line to its normal stdout:

```text
MADHORSE_GAME {"version":1,"object":"player","action":"setPosition","x":75,"y":35}
```

This line is consumed by the worker's output adapter, not displayed in the
console. The adapter sends a `game` message over the existing isolated channel.
The editor independently validates its exact schema before changing the scene.
Normal output is still displayed as text; it is never evaluated.

- Exactly five command fields are required; additional fields are rejected.
- `version` must be the number `1`, and `object` must be `"player"`.
- `"setPosition"` sets absolute x/y, both numbers in [0, 100].
- `"move"` adds x/y offsets, each in [-100, 100]. The resulting position must
  also be in [0, 100]. Values must be finite numbers, not numeric strings.
- The origin is top-left; x increases right and y increases down.
- Commands are ordered, write-only, and limited to 128 per run. Each command
  line is limited to 512 characters. Command bytes count toward the existing
  16,000-character output budget. No reads, callbacks, object creation,
  arbitrary property access, physics, or animation loop is exposed.
- Invalid JSON, schema violations, and bounds/quota failures stop the run.
  Earlier valid commands are not rolled back. Stop and timeout revoke the
  channel; later messages cannot change the scene.
- C#'s existing runtime returns buffered stdout, so its commands are applied
  when it returns successfully, not while a long-running script is executing.
  Other runtimes deliver their ordinary line-buffered output during execution.
- New projects start at (50, 50). Reset, switching projects, and page reload
  restore that position. Position is preview-only and is not project storage.
  Importing a file never runs it.
  Creating or editing a script never runs it either.

## Creating and editing source

Use **Script → New script language → Create script** to add a movement starter
for Python, C, C++, JavaScript, TypeScript, Lua, or C#. New scripts receive a
language-appropriate extension and a unique `movement` filename. Each starter
sets the player to (75, 35) using the example below.

Select a script with **Script to run** to edit its source, including imported
source and headers. Edits update browser-local project data automatically, with
the same persistence as imported scripts; they do not save the preview position.
Browser storage failures are reported in the project status. Source is plain
text, limited to 256 KB per file and 1 MB per project, measured in UTF-8 bytes.
An edit exceeding either limit is rejected and the previous source is retained.
Stop a running script before editing its source. **Run script** or **Play**
is still required to execute it through the existing isolated runner. Creation,
selection, editing, and reload do not download language runtimes or execute code.

The Script panel contains a complete example for the selected language, including
the necessary string escaping for C, C++, C#, JavaScript, and TypeScript.
