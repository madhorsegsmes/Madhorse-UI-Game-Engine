import assert from 'node:assert/strict';
import test from 'node:test';
import { createMadBuilderLogPdf } from '../src/lib/mad-builder-build-log';

test('Mad Builder PDF is a static read-only report without interactive or editing fields', async () => {
  const pdf = createMadBuilderLogPdf('Scene 1', [{
    id: 'build-1', createdAt: '2026-10-24T00:00:00.000Z', request: 'Make a cube',
    plan: {
      title: 'Cube', summary: 'One editable cube.', warnings: [],
      parts: [{ key: 'cube', parentKey: null, kind: 'box', name: 'Cube',
        position: { x: 0, y: 0.5, z: 0 }, rotation: { x: 0, y: 0, z: 0 },
        size: { x: 1, y: 1, z: 1 }, color: '#aaaaaa' }],
    },
    objectNames: ['Cube'], uiControlNames: [], prefabSaved: false,
  }]);
  const contents = await pdf.text();
  assert.match(contents, /^%PDF-1\.4/);
  assert.match(contents, /MADHORSE STUDIO - MAD BUILDER BUILD LOG/);
  assert.match(contents, /Make a cube/);
  assert.doesNotMatch(contents, /\/AcroForm|\/Annots|\/OpenAction|\/JavaScript/);
});
