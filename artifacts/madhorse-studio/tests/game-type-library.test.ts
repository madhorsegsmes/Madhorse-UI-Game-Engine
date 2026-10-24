import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameTypeLibraryPdf, gameTypeLibraryEntryCount } from '../src/lib/game-type-library';

test('read-only game type library PDF covers the requested genres and has no editable PDF fields', async () => {
  const contents = await createGameTypeLibraryPdf().text();

  assert.match(contents, /^%PDF-1\.4/);
  assert.match(contents, /Game Type Development Library/);
  assert.ok(gameTypeLibraryEntryCount >= 20);
  assert.match(contents, /Card and deckbuilding games/);
  assert.match(contents, /Sports games/);
  assert.match(contents, /Fighting games/);
  assert.match(contents, /Role-playing games/);
  assert.match(contents, /MMO and MMORPG/);
  assert.match(contents, /Functions & Controls/);
  assert.match(contents, /System Presets & Data/);
  assert.doesNotMatch(contents, /\/AcroForm|\/Annots|\/OpenAction|\/JavaScript/);
});
