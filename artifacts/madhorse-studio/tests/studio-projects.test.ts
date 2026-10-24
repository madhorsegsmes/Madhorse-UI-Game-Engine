import test from 'node:test';
import assert from 'node:assert/strict';
import { LEGACY_STUDIO_PROJECT_ID, parseStudioProjects, studioProjectStorageKey, validateProjectName } from '../src/lib/studio-projects';

test('every new project must have a nonblank bounded name', () => {
  assert.equal(validateProjectName('  My Game  '), 'My Game');
  assert.throws(() => validateProjectName(' \n\t '));
  assert.throws(() => validateProjectName('A'.repeat(81)));
});
test('project registry keeps unique identities and rejects unnamed records', () => {
  const projects = [{ id: 'first', name: 'First' }, { id: 'second', name: 'Second' }];
  assert.equal(parseStudioProjects(JSON.stringify({ activeId: 'second', projects })).activeId, 'second');
  assert.equal(parseStudioProjects(JSON.stringify({ activeId: 'gone', projects })).activeId, 'first');
  assert.throws(() => parseStudioProjects(JSON.stringify({ projects: [{ id: 'new', name: ' ' }] })));
  assert.throws(() => parseStudioProjects(JSON.stringify({ projects: [projects[0], projects[0]] })));
});
test('legacy saves retain their original keys while new projects are isolated', () => {
  const key = 'madhorse-studio:fresh-workspace:v1';
  assert.equal(studioProjectStorageKey(key, LEGACY_STUDIO_PROJECT_ID), key);
  assert.notEqual(studioProjectStorageKey(key, 'new-one'), studioProjectStorageKey(key, 'new-two'));
  const boardKey = 'madhorse.vision-boards.v1';
  assert.equal(studioProjectStorageKey(boardKey, LEGACY_STUDIO_PROJECT_ID), boardKey);
});
