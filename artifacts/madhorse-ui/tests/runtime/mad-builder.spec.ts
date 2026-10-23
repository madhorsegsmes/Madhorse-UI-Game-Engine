import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { compileBuilderPlan, isBuilderDraft } from '../../src/lib/mad-builder';
import { createDefaultPlayer, getPrimitive, getTransform, getWorldTransform, getUICanvas, isSceneGraph } from '../../src/lib/scene-model';
import { capturePrefab, instantiatePrefab } from '../../src/lib/scene-authoring';
import { sceneEntityFocus } from '../../src/lib/scene-view-geometry';
import type { BuilderPart, MadBuilderPlan } from '@workspace/api-client-react';

const part = (changes: Partial<BuilderPart> = {}): BuilderPart => ({
  key: 'floor', parentKey: null, kind: 'box', name: 'Floor',
  position: { x: 0, y: .1, z: 0 }, rotation: { x: 0, y: 0, z: 0 },
  size: { x: 6, y: .2, z: 5 }, color: '#777777', ...changes,
});
const plan = (parts = [part()]): MadBuilderPlan => ({
  title: 'Test house', summary: 'Editable house parts with translucent glass.', warnings: [], parts,
});

test('phone prompt appears first and sends typed requests to Mad Builder without applying them', async ({ page }) => {
  let submitted = '';
  await page.route('**/api/mad-builder/plan', async (route) => {
    submitted = route.request().postDataJSON().prompt;
    await route.fulfill({ json: plan() });
  });
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto('/');
  await page.getByTestId('button-open-mad-builder').click();
  const prompt = page.getByRole('textbox', { name: 'Tell Mad Bot what to build' });
  await expect(prompt).toBeInViewport();
  expect(await page.getByTestId('panel-mad-builder').locator('.mb-body > :first-child').getByTestId('input-builder-prompt').count()).toBe(1);
  await expect(page.getByTestId('button-builder-plan')).toBeDisabled();
  await prompt.fill('Build a 3D house with windows and a red roof');
  await page.getByTestId('button-builder-plan').click();
  await expect(page.getByTestId('text-plan-title')).toHaveText('Test house');
  expect(submitted).toBe('Build a 3D house with windows and a red roof');
  await expect(page.getByTestId('button-builder-apply')).toBeEnabled();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('madhorse-ui-projects') ?? '[]')[0]?.entities?.length)).toBe(1);
  await page.screenshot({ path: '../../generated-artifacts/mad-builder-prompt-phone.jpg' });
});

test('builder compiles editable grouped geometry, glass, UI and prefabs without changing existing objects', () => {
  const existing = [createDefaultPlayer()];
  const before = structuredClone(existing);
  const input = plan([
    part(), part({ key: 'group', kind: 'group', name: 'Windows', position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 } }),
    part({ key: 'glass', parentKey: 'group', name: 'Window glass', position: { x: 1, y: 1.5, z: -2.5 },
      size: { x: 1, y: 1, z: .03 }, opacity: .28, color: '#b5e7ff' }),
    part({ key: 'roof', name: 'Roof left', rotation: { x: 0, y: 0, z: 30 } }),
    part({ key: 'light', kind: 'light', name: 'House light' }),
    part({ key: 'camera', kind: 'camera', name: 'House camera' }),
    part({ key: 'ui', kind: 'ui-button', name: 'Start button', text: 'Start' }),
  ]);
  const build = compileBuilderPlan(input, existing, []);
  expect(existing).toEqual(before);
  expect(isSceneGraph([...existing, ...build.entities])).toBe(true);
  expect(build.entities[0].isGroup).toBe(true);
  expect(getPrimitive(build.entities.find((entity) => entity.name === 'Window glass')!)?.opacity).toBe(.28);
  const windowTransform = getWorldTransform(build.entities, build.entities.find((entity) => entity.name === 'Window glass')!.id)!;
  expect(windowTransform.position).toEqual({ x: 60, y: 25, z: 15 });
  expect(getTransform(build.entities.find((entity) => entity.name === 'Roof left')!).rotation.y).toBe(-30);
  expect(getUICanvas(build.entities.find((entity) => entity.name === 'Start button')!)?.frame).toBe(false);
  expect(build.uiControls[0].label).toBe('Start');
  const prefab = capturePrefab(build.entities, build.rootId, input.title, build.uiControls);
  const copy = instantiatePrefab(prefab);
  expect(isSceneGraph(copy.entities)).toBe(true);
  expect(copy.entities.every((entity) => !build.entities.some((source) => source.id === entity.id))).toBe(true);
  expect(copy.uiControls[0].id).not.toBe(build.uiControls[0].id);
  expect(sceneEntityFocus(build.entities, build.rootId)?.radius).toBeGreaterThan(3);
  expect(isBuilderDraft(input)).toBe(true);
});

test('invalid AI graphs, missing assets, unsafe dimensions and code cannot cross the builder boundary', () => {
  const existing = [createDefaultPlayer()];
  const before = structuredClone(existing);
  for (const input of [
    plan([part({ parentKey: 'missing' })]),
    plan([part({ parentKey: 'floor' })]),
    plan([part(), part()]),
    plan([part({ assetId: 'missing' })]),
    plan([part({ kind: 'model' })]),
    plan([part({ size: { x: Infinity, y: 1, z: 1 } })]),
    plan([part({ opacity: -1 })]),
    plan(Array.from({ length: 81 }, (_, index) => part({ key: String(index) }))),
    plan([part({ kind: 'script' as BuilderPart['kind'] })]),
  ]) expect(() => compileBuilderPlan(input, existing, [])).toThrow();
  const malicious = 'globalThis.__MAD_BUILDER_EXECUTED__ = true';
  compileBuilderPlan({ ...plan([part({ name: malicious })]), code: malicious }, existing, []);
  expect((globalThis as typeof globalThis & { __MAD_BUILDER_EXECUTED__?: boolean }).__MAD_BUILDER_EXECUTED__).toBeUndefined();
  expect(existing).toEqual(before);
  expect(isBuilderDraft({ parts: [] })).toBe(false);
});

test('a real AI house response compiles into project data and has windows, glass and framing bounds', async () => {
  const source = await readFile(new URL('../../../../generated-artifacts/mad-builder-live-plan.json', import.meta.url), 'utf8').catch(() => null);
  test.skip(source === null, 'Optional live-AI smoke evidence is not present in this checkout.');
  const input = JSON.parse(source!);
  const build = compileBuilderPlan(input, [createDefaultPlayer()], []);
  expect(build.entities.length).toBeGreaterThan(5);
  expect(build.entities.some((entity) => /window|glass/i.test(entity.name))).toBe(true);
  expect(build.entities.some((entity) => (getPrimitive(entity)?.opacity ?? 1) < 1)).toBe(true);
  const focus = sceneEntityFocus(build.entities, build.rootId)!;
  expect(focus.radius).toBeGreaterThan(1);
  expect(Number.isFinite(focus.radius)).toBe(true);
  expect(isSceneGraph(build.entities)).toBe(true);
});
