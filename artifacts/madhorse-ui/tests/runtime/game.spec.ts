import { expect } from '@playwright/test';
import { applyGameCommand, gameExample } from '../../src/lib/game-api';
import { test, languages, openScripts, importSource, run, finished, status, output, frames, stopButton } from './fixtures';

const command = (updates: Record<string, unknown> = {}) => ({
  version: 1, object: 'player', action: 'setPosition', x: 75, y: 35, ...updates,
});
const player = (page: import('@playwright/test').Page) => page.getByTestId('scene-player');

test('editor boundary accepts only the exact finite, bounded command schema', () => {
  const start = { x: 50, y: 50 };
  expect(applyGameCommand(command(), start)).toEqual({ x: 75, y: 35 });
  expect(applyGameCommand(command({ action: 'move', x: -50, y: 50 }), start)).toEqual({ x: 0, y: 100 });
  for (const value of [
    null, [], 'setPosition', {}, { ...command(), extra: true },
    command({ version: 2 }), command({ object: '__proto__' }),
    command({ action: 'delete' }), command({ x: '75' }),
    command({ x: NaN }), command({ y: Infinity }), command({ x: -1 }),
    command({ y: 101 }), command({ action: 'move', x: 51 }),
    Object.assign(Object.create({ version: 1 }), { object: 'player', action: 'move', x: 1, y: 1 }),
  ]) expect(() => applyGameCommand(value, start)).toThrow('Invalid game command');
  expect(start).toEqual({ x: 50, y: 50 });
});

for (const language of languages) {
  test(`${language.name}: scene API moves the visible object and Reset restores it`, async ({ page }) => {
    await openScripts(page);
    await importSource(page, `scene.${language.extension}`, gameExample(language.name));
    await expect(player(page)).toHaveAttribute('data-x', '50');
    await run(page);
    await finished(page);
    await expect(player(page)).toHaveAttribute('data-x', '75');
    await expect(player(page)).toHaveAttribute('data-y', '35');
    await expect(player(page)).toHaveAccessibleName('Player object at x 75, y 35');
    await expect(output(page)).not.toContainText('MADHORSE_GAME');
    await page.getByRole('button', { name: 'Reset scene', exact: true }).click();
    await expect(player(page)).toHaveAttribute('data-x', '50');
    await expect(player(page)).toHaveAttribute('data-y', '50');
  });
}

test('ordered moves, invalid commands and malformed JSON never escape the scene API', async ({ page }) => {
  await openScripts(page);
  await importSource(page, 'ordered.js', `
console.log(${JSON.stringify(`MADHORSE_GAME ${JSON.stringify(command())}`)});
console.log(${JSON.stringify(`MADHORSE_GAME ${JSON.stringify(command({ action: 'move', x: -15, y: 5 }))}`)});
console.log('ordinary output');
`);
  await run(page);
  await finished(page);
  await expect(player(page)).toHaveAttribute('data-x', '60');
  await expect(player(page)).toHaveAttribute('data-y', '40');
  await expect(output(page)).toContainText('ordinary output');
  for (const value of [
    '{bad json', JSON.stringify(command({ object: 'editor' })),
    JSON.stringify(command({ action: 'fetch' })), JSON.stringify(command({ x: '25' })),
    JSON.stringify(command({ y: 200 })), JSON.stringify(command({ action: 'move', x: 90 })),
    JSON.stringify({ ...command(), url: '/api/private' }),
  ]) {
    await importSource(page, `invalid-${Math.random()}.js`, `console.log(${JSON.stringify(`MADHORSE_GAME ${value}`)})`);
    await run(page);
    await expect(status(page)).toHaveText('Script stopped with an error.');
    await expect(output(page)).toContainText(/Invalid game command/);
    await expect(player(page)).toHaveAttribute('data-x', '60');
    await expect(player(page)).toHaveAttribute('data-y', '40');
    await expect(frames(page)).toHaveCount(0);
  }
});

test('game command quota stops the run, and a fresh run still works', async ({ page }) => {
  await openScripts(page);
  await importSource(page, 'quota.js', `for (let i = 0; i < 129; i++) console.log(${JSON.stringify(`MADHORSE_GAME ${JSON.stringify(command())}`)});`);
  await run(page);
  await expect(status(page)).toHaveText('Script stopped with an error.');
  await expect(output(page)).toContainText('128 per run');
  await expect(frames(page)).toHaveCount(0);
  await importSource(page, 'recovery.js', gameExample('JavaScript'));
  await run(page);
  await finished(page);
  await expect(player(page)).toHaveAttribute('data-x', '75');
});

test('editor independently rejects forged worker envelopes, early commands and floods', async ({ page }) => {
  await openScripts(page);
  await importSource(page, 'forged.js', 'not executed by this test worker');
  const valid = { type: 'game', command: command() };
  const running = { type: 'phase', phase: 'running', message: 'Running script…' };
  for (const messages of [
    [valid],
    [running, { ...valid, arbitrary: true }],
    [running, { type: 'game', command: command({ action: 'openUrl' }) }],
    [running, ...Array.from({ length: 128 }, () => ({ type: 'game', command: command({ x: 50, y: 50 }) })), valid],
  ]) {
    await page.route('**/runtimes/runner.js', route => route.fulfill({
      contentType: 'application/javascript',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: `self.onmessage = () => { for (const message of ${JSON.stringify(messages)}) self.postMessage(message); };`,
    }));
    await run(page);
    await expect(status(page)).toHaveText('Script stopped with an error.');
    await expect(player(page)).toHaveAttribute('data-x', '50');
    await expect(player(page)).toHaveAttribute('data-y', '50');
    await expect(frames(page)).toHaveCount(0);
    await page.unroute('**/runtimes/runner.js');
  }
});

test('Stop and timeout revoke scene writes without rolling back valid moves', async ({ page }) => {
  await openScripts(page);
  await importSource(page, 'loop-scene.js', `${gameExample('JavaScript')}\nwhile (true) {}`);
  await run(page);
  await expect(player(page)).toHaveAttribute('data-x', '75');
  await stopButton(page).click();
  await expect(frames(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset scene', exact: true }).click();
  await expect(player(page)).toHaveAttribute('data-x', '50');
  await run(page);
  await expect(status(page)).toHaveText('Script stopped with an error.', { timeout: 8_000 });
  await expect(player(page)).toHaveAttribute('data-x', '75');
  await page.getByRole('button', { name: 'Reset scene', exact: true }).click();
  await page.waitForTimeout(500);
  await expect(player(page)).toHaveAttribute('data-x', '50');
});

test('switching projects revokes the old runner and resets the preview without saving position', async ({ page }) => {
  await openScripts(page);
  await importSource(page, 'switch-scene.js', `${gameExample('JavaScript')}\nwhile (true) {}`);
  await run(page);
  await expect(player(page)).toHaveAttribute('data-x', '75');
  await page.getByLabel('Script tools').click();
  await page.getByLabel('Project actions').click();
  page.once('dialog', dialog => dialog.accept('Other scene'));
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await expect(frames(page)).toHaveCount(0);
  await expect(player(page)).toHaveAttribute('data-x', '50');
  await page.getByLabel('Choose project').selectOption({ index: 0 });
  await expect(player(page)).toHaveAttribute('data-x', '50');
  await expect(frames(page)).toHaveCount(0);
  await page.reload();
  await expect(player(page)).toHaveAttribute('data-x', '50');
});
