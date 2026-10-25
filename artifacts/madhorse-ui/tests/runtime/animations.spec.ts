import { expect } from '@playwright/test';
import { test } from './fixtures';

test('Panel 3 scrubs intermediate positions rather than jumping between keyframes', async ({ page }) => {
  await page.goto('/');
  await page.locator('.system-panel-tools details').first().locator('summary').click();
  await page.getByTestId('create-animation').click();
  const editor = page.getByTestId('animation-editor');
  const firstFrame = editor.locator('.animation-keyframe').nth(0);
  const finalFrame = editor.locator('.animation-keyframe').nth(1);
  await firstFrame.getByLabel('Pos Z').fill('-8');
  await finalFrame.getByLabel('Pos X').fill('90');
  await finalFrame.getByLabel('Pos Y').fill('10');
  await finalFrame.getByLabel('Pos Z').fill('8');

  const player = page.getByTestId('scene-player');
  // Scrub backwards as well: each preview must be sampled from the clip, not
  // interpolated from the previously displayed pose.
  for (const [time, x, y, z] of [
    ['0.25', '60', '40', '-4'],
    ['0.75', '80', '20', '4'],
    ['0.5', '70', '30', '0'],
  ]) {
    await editor.getByLabel('Animation timeline').fill(time);
    await expect(player).toHaveAttribute('data-x', x);
    await expect(player).toHaveAttribute('data-y', y);
    await expect(player).toHaveAttribute('data-z', z);
  }
  await page.getByTestId('animation-stop').click();
  await expect(player).toHaveAttribute('data-x', '50');
  await expect(player).toHaveAttribute('data-y', '50');
  await expect(player).toHaveAttribute('data-z', '0');
});

test('Panel 3 loops with the elapsed-time remainder and Stop cancels further frames', async ({ page }) => {
  await page.goto('/');
  await page.locator('.system-panel-tools details').first().locator('summary').click();
  await page.getByTestId('create-animation').click();
  const editor = page.getByTestId('animation-editor');
  await editor.getByLabel('Animation duration').fill('2');
  await editor.locator('.animation-keyframe').nth(1).getByLabel('Pos X').fill('90');
  await editor.getByLabel('Loop preview').check();
  const savedEntities = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]')[0].entities);

  // Control performance.now and the real preview interval together. Using
  // multiples of its 33ms cadence avoids depending on wall-clock scheduling.
  const now = new Date();
  await page.clock.install({ time: now });
  // install() starts a running clock; pause in the future so protocol latency
  // cannot make pauseAt target an instant that has already passed.
  await page.clock.pauseAt(new Date(now.getTime() + 60_000));
  await page.getByTestId('animation-play').click();
  const player = page.getByTestId('scene-player');
  const timeline = editor.getByLabel('Animation timeline');
  const expectFrame = async (time: number) => {
    // The range input rounds to its 0.01s step, but the scene must use the
    // unrounded playback time (especially just after a loop boundary).
    await expect.poll(async () => Math.abs(Number(await timeline.inputValue()) - time)).toBeLessThanOrEqual(0.005001);
    await expect.poll(async () => Number(await player.getAttribute('data-x'))).toBeCloseTo(50 + 20 * time, 6);
    await expect(editor.getByRole('status')).toHaveText(`Playing · ${time.toFixed(2)}s`);
    await expect(page.getByTestId('animation-play')).toHaveText('Pause');
  };

  await page.clock.runFor(990);
  await expectFrame(0.99);
  await page.clock.runFor(990);
  await expectFrame(1.98);
  await page.clock.runFor(33);
  await expectFrame(0.013); // 2.013 seconds: wrap, retaining the remainder.
  await page.clock.runFor(990);
  await expectFrame(1.003);
  await page.clock.runFor(1023);
  await expectFrame(0.026); // A second wrap must not accumulate timing drift.

  await page.getByTestId('animation-stop').click();
  await expect(timeline).toHaveValue('0');
  await expect(player).toHaveAttribute('data-x', '50');
  await expect(editor.getByRole('status')).toHaveText('Preview · 0.00s');
  await expect(page.getByTestId('animation-play')).toHaveText('Preview');
  await page.clock.runFor(4092);
  await expect(timeline).toHaveValue('0');
  await expect(player).toHaveAttribute('data-x', '50');
  await expect(editor.getByRole('status')).toHaveText('Preview · 0.00s');
  expect(await page.evaluate(() =>
    JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]')[0].entities)).toEqual(savedEntities);

  // Stopping must leave the controls usable for a fresh preview.
  await page.getByTestId('animation-play').click();
  await page.clock.runFor(495);
  await expectFrame(0.495);
  await page.getByTestId('animation-stop').click();
  await expect(player).toHaveAttribute('data-x', '50');
});

test('Panel 3 creates, previews, edits, and saves an animation without saving its preview transform', async ({ page }) => {
  await page.goto('/');
  await page.locator('.system-panel-tools details').first().locator('summary').click();
  await page.getByTestId('create-animation').click();

  const editor = page.getByTestId('animation-editor');
  await expect(editor.getByLabel('Animation name')).toHaveValue('Player Animation');
  const finalFrame = editor.locator('.animation-keyframe').nth(1);
  await finalFrame.getByLabel('Pos X').fill('80');
  await finalFrame.getByLabel('Rot Z').fill('90');

  await page.getByTestId('animation-play').click();
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '80', { timeout: 5_000 });
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-y', '50');

  await expect.poll(() => page.evaluate(() => {
    const frame = JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]')[0]
      ?.animations?.[0]?.tracks?.[0]?.keyframes?.[1];
    return frame && { x: frame.position.x, rotation: frame.rotation.z };
  })).toEqual({ x: 80, rotation: 90 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]'));
  expect(saved[0].animations).toHaveLength(1);
  expect(saved[0].animations[0].tracks[0].keyframes[1].position.x).toBe(80);
  expect(saved[0].animations[0].tracks[0].keyframes[1].rotation.z).toBe(90);
  const savedPlayerTransform = saved[0].entities[0].components.find((component: { type: string }) => component.type === 'transform');
  expect(savedPlayerTransform.position.x).toBe(50);

  await page.getByTestId('animation-stop').click();
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '50');
  await page.reload();
  await page.locator('.system-panel-tools details').first().locator('summary').click();
  await expect(page.getByLabel('Animation name')).toHaveValue('Player Animation');
  await expect(page.getByTestId('animation-editor').locator('.animation-keyframe').nth(1).getByLabel('Pos X')).toHaveValue('80');
});

test('multiple object tracks share a timeline, persist, and can be removed during preview', async ({ page }) => {
  await page.goto('/');
  await page.locator('.system-panel-tools details').first().locator('summary').click();
  await page.getByTestId('create-animation').click();
  const editor = page.getByTestId('animation-editor');
  const savedEntities = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]')[0].entities);
  await editor.getByLabel('Animation duration').fill('4');
  await editor.locator('.animation-keyframe').nth(1).getByLabel('Pos X').fill('90');
  await editor.getByLabel('New track object').selectOption('starter-cube');
  await editor.getByRole('button', { name: '+ Add track', exact: true }).click();
  await expect(editor.getByLabel('Animation target')).toHaveValue('starter-cube');
  await editor.locator('.animation-keyframe').nth(0).getByLabel('Time', { exact: true }).fill('1');
  await editor.locator('.animation-keyframe').nth(0).getByLabel('Pos X').fill('10');
  await editor.locator('.animation-keyframe').nth(1).getByLabel('Time', { exact: true }).fill('2');
  await editor.locator('.animation-keyframe').nth(1).getByLabel('Pos X').fill('30');
  const scrub = async (time: string) => {
    await editor.getByLabel('Animation timeline').fill(time);
  };
  await scrub('1.5');
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '65');
  await expect(page.getByTestId('scene-object-starter-cube')).toHaveAttribute('data-x', '20');
  await scrub('3');
  await expect(page.getByTestId('scene-object-starter-cube')).toHaveAttribute('data-x', '30');

  // Scene preview updates immediately; browser-local autosave is debounced.
  // Wait for the final authored track, not an arbitrary delay before reload.
  await expect.poll(() => page.evaluate(() => {
    const tracks = JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]')[0]?.animations?.[0]?.tracks;
    return tracks?.map((track: { keyframes: { time: number; position: { x: number } }[] }) =>
      track.keyframes.map((frame) => [frame.time, frame.position.x]));
  })).toEqual([[[0, 50], [4, 90]], [[1, 10], [2, 30]]]);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]')[0]);
  expect(saved.animations[0].tracks).toHaveLength(2);
  expect(saved.animations[0].tracks[1].keyframes.map((frame: { time: number }) => frame.time)).toEqual([1, 2]);
  expect(saved.entities).toEqual(savedEntities);
  await page.reload();
  await page.locator('.system-panel-tools details').first().locator('summary').click();
  await expect(editor.getByLabel('Animation track').locator('option')).toHaveCount(2);
  await editor.getByLabel('Animation track').selectOption(saved.animations[0].tracks[1].id);
  await scrub('1.5');
  await editor.getByRole('button', { name: 'Remove track', exact: true }).click();
  await expect(page.getByTestId('scene-object-starter-cube')).toHaveAttribute('data-x', '50');
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '65');
  await page.getByTestId('animation-stop').click();
  await expect(page.getByTestId('scene-player')).toHaveAttribute('data-x', '50');
});
