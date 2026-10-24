import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'madhorse-ego-scripts-'));
try {
  const result = await build({
    stdin: {
      resolveDir: dirname(dirname(fileURLToPath(import.meta.url))),
      loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import { createEgoScript, reviewEgoScript } from './src/lib/ego-script-core';
        import { isScriptFileCollection, movementLanguages, scriptStorageError, sourceSize } from './src/lib/project-scripts';

        const files = [];
        for (const { language } of movementLanguages) {
          const starter = createEgoScript(language, 'move right by 8', files);
          const script = { ...starter, id: language };
          files.push(script);
          const review = reviewEgoScript(script.content, language);
          assert.equal(review.commandCount, 1, language + ' starter validates one command');
          assert.equal(review.finalPosition?.x, 58, language + ' movement uses expected preview position');
          assert.equal(review.finalPosition?.y, 50, language + ' does not change the other axis');
          assert(script.content.includes('MADHORSE_GAME'), language + ' includes the shared command protocol');
        }
        assert(isScriptFileCollection(files), 'all supported language starters validate for local project storage');
        assert.equal(scriptStorageError(files[0].content, files), '', 'script size is accepted');
        assert.equal(sourceSize(files[0].content), files[0].size, 'script byte size is recorded');

        const target = createEgoScript('JavaScript', 'move to 70, 35', files);
        const targetReview = reviewEgoScript(target.content, 'JavaScript');
        assert.equal(targetReview.finalPosition?.x, 70);
        assert.equal(targetReview.finalPosition?.y, 35);
        assert.throws(() => createEgoScript('Lua', 'make an advanced fighting AI', files), /For now, describe movement/);
        const malformed = reviewEgoScript('// MADHORSE_GAME {"version":1,"object":"self","action":"deleteProject","x":0,"y":0}', 'JavaScript');
        assert.equal(malformed.commandCount, 0, 'unsupported commands are rejected');
        assert(malformed.notes.some((note) => note.includes('not valid')));
        const unmarked = reviewEgoScript('print("hello")', 'Python');
        assert.equal(unmarked.commandCount, 0);
        assert(unmarked.notes.some((note) => note.includes('did not execute')));
        console.log('Ego safe script core: all assertions passed');
      `,
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  });
  const outputPath = join(directory, 'test.mjs');
  await writeFile(outputPath, result.outputFiles[0].text);
  await import(pathToFileURL(outputPath).href);
} finally {
  await rm(directory, { recursive: true, force: true });
}
