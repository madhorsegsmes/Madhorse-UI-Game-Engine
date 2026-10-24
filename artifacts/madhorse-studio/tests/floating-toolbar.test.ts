import test from 'node:test';
import assert from 'node:assert/strict';
import { clampToolbarPosition, parseToolbarPosition } from '../src/lib/floating-toolbar';

test('toolbar can leave its viewport but stays reachable within the screen', () => {
  const screen = { width: 1920, height: 1080 }, size = { width: 124, height: 32 };
  assert.deepEqual(clampToolbarPosition({ x: 1700, y: 900 }, screen, size), { x: 1700, y: 900 });
  assert.deepEqual(clampToolbarPosition({ x: -50, y: 2000 }, screen, size), { x: 0, y: 1048 });
  assert.deepEqual(clampToolbarPosition({ x: 1900, y: 900 }, { width: 800, height: 600 }, size), { x: 676, y: 568 });
});
test('saved toolbar coordinates reject corrupt and nonnumeric values', () => {
  assert.deepEqual(parseToolbarPosition('{"x":100,"y":200}'), { x: 100, y: 200 });
  for (const value of [null, '{}', 'bad', '{"x":"100","y":200}', '{"x":1e999,"y":2}']) assert.equal(parseToolbarPosition(value), null);
});
