import assert from 'node:assert/strict';
import test from 'node:test';
import { createEgoCharacterScene } from '../src/lib/character-builder-starter';
import { detectEgoCharacterRequests } from '../src/lib/ego-character-anatomy';
import { createCharacterBodyMesh, isCharacterBuilderModelRoot } from '../src/lib/character-builder-geometry';

test('Ego detects humanoids, animals, and monsters with prompt-based sizes', () => {
  assert.deepEqual(
    detectEgoCharacterRequests('A small human, a tall orc, a vampire, and a giant wolf'),
    [
      { species: 'human', displayName: 'Human', heightMeters: 1.1 },
      { species: 'orc', displayName: 'Orc', heightMeters: 2.4 },
      { species: 'vampire', displayName: 'Vampire', heightMeters: 1.8 },
      { species: 'wolf', displayName: 'Wolf', heightMeters: 3.6 },
    ],
  );
});

test('Ego supports explicit height units and chosen size presets', () => {
  assert.deepEqual(detectEgoCharacterRequests('A 6 foot vampire'), [
    { species: 'vampire', displayName: 'Vampire', heightMeters: 1.8288000000000002 },
  ]);
  assert.deepEqual(detectEgoCharacterRequests('a 180 cm human'), [
    { species: 'human', displayName: 'Human', heightMeters: 1.8 },
  ]);
  assert.deepEqual(detectEgoCharacterRequests('a wolf', 'giant'), [
    { species: 'wolf', displayName: 'Wolf', heightMeters: 3.6 },
  ]);
  assert.equal(detectEgoCharacterRequests('a 1.65 m human')[0]?.heightMeters, 1.65);
  assert.equal(detectEgoCharacterRequests('a wolf creature').length, 1);
});

test('Ego recognizes several creature body plans and preserves names from the prompt', () => {
  assert.deepEqual(
    detectEgoCharacterRequests('Make a horse, an eagle, a dragon, a snake, a spider, a shark, and a goblin'),
    [
      { species: 'quadruped', displayName: 'Horse', heightMeters: 1.35 },
      { species: 'avian', displayName: 'Eagle', heightMeters: 1.6 },
      { species: 'dragon', displayName: 'Dragon', heightMeters: 2.4 },
      { species: 'serpentine', displayName: 'Snake', heightMeters: 1.6 },
      { species: 'insectoid', displayName: 'Spider', heightMeters: 1.6 },
      { species: 'aquatic', displayName: 'Shark', heightMeters: 1.35 },
      { species: 'monster', displayName: 'Goblin', heightMeters: 1.8 },
    ],
  );
  assert.equal(detectEgoCharacterRequests('Create a shadow beast')[0]?.displayName, 'Shadow');
});

test('generated body plans use named editable anatomy parts', () => {
  const expectedParts = {
    human: 'hand · finger',
    orc: 'orc tusk',
    vampire: 'vampire fang',
    wolf: 'wolf left front',
    quadruped: 'horse right hind leg upper',
    avian: 'wing · eagle left upper',
    dragon: 'wing · dragon left membrane',
    serpentine: 'snake body segment',
    insectoid: 'spider left leg 4',
    aquatic: 'shark dorsal fin',
    monster: 'goblin left hand',
  } as const;

  for (const [species, expectedPart] of Object.entries(expectedParts) as Array<[keyof typeof expectedParts, string]>) {
    const displayName = species === 'quadruped' ? 'Horse'
      : species === 'avian' ? 'Eagle'
        : species === 'aquatic' ? 'Shark'
          : species === 'monster' ? 'Goblin'
            : species === 'insectoid' ? 'Spider'
              : species === 'serpentine' ? 'Snake'
                : species === 'dragon' ? 'Dragon' : undefined;
    const build = createEgoCharacterScene(species, 2.1, { x: 0, z: 0 }, displayName);
    const root = build.entities.find((entity) => entity.id === build.characterId);
    assert.ok(root);
    assert.ok(isCharacterBuilderModelRoot(root));
    assert.ok(build.entities.some((entity) => entity.name.toLowerCase().includes(expectedPart)));
    assert.ok(build.entities.every((entity) => entity.id === build.setupId || entity.id === build.characterId || entity.parentId === build.characterId));
    const body = createCharacterBodyMesh(build.entities.filter((entity) => entity.parentId === build.characterId));
    assert.ok(body, `${species} should have a renderable body surface`);
    body.geometry.dispose();
  }
});
