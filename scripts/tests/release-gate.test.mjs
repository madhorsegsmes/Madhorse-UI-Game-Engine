import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { parse } from 'yaml';

const load = (name) => parse(readFileSync(
  new URL(`../../.github/workflows/${name}.yml`, import.meta.url), 'utf8',
));
const runtime = load('script-runtime');
const release = load('release-dry-run');
const verification = load('release-gate-verification');

function assertBlockedBy(job, dependency) {
  assert.equal(job.needs, dependency);
  // Deliberately stricter than expression parsing: publisher uses GitHub's
  // implicit success() condition, with no override or failure suppression.
  assert.equal(job.if, undefined);
  assert.equal(job['continue-on-error'], undefined);
  for (const step of job.steps ?? []) {
    assert.equal(step.if, undefined);
    assert.equal(step['continue-on-error'], undefined);
  }
}

test('release calls the real reusable gate and cannot bypass its result', () => {
  assert.ok(Object.hasOwn(runtime.on, 'workflow_call'));
  assert.equal(release.jobs['runtime-gate'].uses, './.github/workflows/script-runtime.yml');
  assert.equal(release.jobs['runtime-gate'].if, undefined);
  assert.equal(release.jobs['runtime-gate']['continue-on-error'], undefined);
  assertBlockedBy(release.jobs['publish-dry-run'], 'runtime-gate');
  assert.deepEqual(Object.keys(release.on), ['workflow_dispatch']);
  assert.deepEqual(release.permissions, { contents: 'read' });
});

test('gate and publisher use the immutable event commit, not a movable tag/branch', () => {
  const gate = runtime.jobs['script-runtime'];
  const publish = release.jobs['publish-dry-run'];
  for (const job of [gate, publish]) {
    const checkout = job.steps.find((step) => step.uses?.startsWith('actions/checkout@'));
    assert.equal(checkout.with.ref, '${{ github.sha }}');
  }
  assert.equal(runtime.on.workflow_call.outputs['tested-sha'].value,
    '${{ jobs.script-runtime.outputs.tested-sha }}');
  assert.equal(gate.outputs['tested-sha'], '${{ steps.source.outputs.sha }}');
  const record = gate.steps.find((step) => step.id === 'source');
  assert.equal(record.env.EXPECTED_SHA, '${{ github.sha }}');
  assert.match(record.run, /test "\$actual_sha" = "\$EXPECTED_SHA"/);
  const approval = publish.steps.at(-1);
  assert.equal(approval.env.TESTED_SHA, '${{ needs.runtime-gate.outputs.tested-sha }}');
  assert.equal(approval.env.EXPECTED_SHA, '${{ github.sha }}');
});

test('an intentionally failed gate skips publishing; a passing gate permits the sentinel', () => {
  // Local model of default needs/success() scheduling. GitHub's actual scheduler
  // is checked separately by the manual release-gate-verification workflow.
  for (const [gateId, publishId, expected] of [
    ['passing-gate', 'allowed-publish', 'success'],
    ['failing-gate', 'blocked-publish', 'skipped'],
  ]) {
    const gate = verification.jobs[gateId];
    const publish = verification.jobs[publishId];
    assertBlockedBy(publish, gateId);
    const result = spawnSync('bash', ['-e', '-c', gate.steps[0].run]);
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    const state = result.status === 0
      ? (spawnSync('bash', ['-e', '-c', publish.steps[0].run]).status === 0 ? 'success' : 'failure')
      : 'skipped';
    assert.equal(state, expected);
  }
});

test('release approval rejects missing or mismatched tested commits', () => {
  const approval = release.jobs['publish-dry-run'].steps.at(-1);
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  assert.match(sha, /^[a-f0-9]{40}$/);
  for (const [expected, tested, shouldPass] of [
    [sha, sha, true],
    [sha, '', false],
    [sha, '0'.repeat(40), false],
    ['0'.repeat(40), '0'.repeat(40), false],
  ]) {
    // Execute the real approval shell, with only the summary redirected away.
    const result = spawnSync('bash', ['-e', '-c', approval.run], {
      env: { ...process.env, EXPECTED_SHA: expected, TESTED_SHA: tested, GITHUB_STEP_SUMMARY: '/dev/null' },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status === 0, shouldPass);
  }
});

test('regression guard rejects publishing bypasses', () => {
  const original = release.jobs['publish-dry-run'];
  for (const mutation of [
    { needs: undefined },
    { if: '${{ always() }}' },
    { 'continue-on-error': true },
    { steps: [{ run: 'exit 1', 'continue-on-error': true }] },
  ]) {
    assert.throws(() => assertBlockedBy({ ...original, ...mutation }, 'runtime-gate'));
  }
});
