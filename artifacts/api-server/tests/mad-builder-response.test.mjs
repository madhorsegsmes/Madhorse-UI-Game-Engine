import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';

test('image plans complete with a dedicated output budget; truncated plans never apply', async () => {
  const captured = [];
  let truncate = false;
  let responsePlan;
  const plan = {
    title: 'Reference cube', summary: 'Editable red cube.', warnings: [],
    parts: [{
      key: 'body', parentKey: null, kind: 'box', name: 'Body',
      position: { x: 0, y: 0.5, z: 0 }, rotation: { x: 0, y: 0, z: 0 },
      size: { x: 1, y: 1, z: 1 }, color: '#cc2222',
    }],
  };
  responsePlan = plan;
  const mock = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    captured.push(JSON.parse(raw));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      id: 'mock-completion', object: 'chat.completion', created: 0, model: 'mock',
      choices: [{ index: 0, finish_reason: truncate ? 'length' : 'stop',
         message: { role: 'assistant', content: truncate ? '{"parts":[' : JSON.stringify(responsePlan) } }],
    }));
  });
  mock.listen(0, '127.0.0.1');
  await once(mock, 'listening');
  const reservation = createServer().listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['dist/index.mjs'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production',
      AI_INTEGRATIONS_OPENAI_API_KEY: 'test-only-not-a-credential',
      AI_INTEGRATIONS_OPENAI_BASE_URL: `http://127.0.0.1:${mock.address().port}/v1` },
    stdio: 'ignore',
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 80; i++) {
      if (await fetch(`${base}/api/healthz`).then(r => r.ok).catch(() => false)) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'Isolated API server started');
    const body = {
      prompt: 'Match the red cube', selectedName: '', assets: [], buildCategory: 'vehicle',
      referenceImages: [
        { role: 'category-default', dataUrl: 'data:image/jpeg;base64,/9j/2Q==' },
        { role: 'user-target', dataUrl: 'data:image/jpeg;base64,/9j/2Q==' },
      ],
    };
    const send = () => fetch(`${base}/api/mad-builder/plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    let response = await send();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), plan);
    assert.equal(captured[0].reasoning_effort, 'none');
    assert.equal(captured[0].max_completion_tokens, 12000);
    assert.match(captured[0].messages[0].content, /wheelbase, wheel diameter and placement/);
    assert.match(captured[0].messages[0].content, /exactly four tires/);
    assert.match(captured[0].messages[0].content, /kind "vehicle", vehicleStyle "muscle-coupe"/);
    assert.match(captured[0].messages[0].content, /Built-in CharacterController is a capsule-based, physics-independent mover/);
    assert.match(captured[0].messages[0].content, /current Mad Builder schema has no dedicated CharacterController component/);
    assert.match(captured[0].messages[0].content, /Selected build type: Vehicle/);
    assert.equal(captured[0].messages[1].content[1].text.startsWith('CATEGORY DEFAULT REFERENCE'), true);
    assert.equal(captured[0].messages[1].content[2].image_url.url, body.referenceImages[0].dataUrl);
    assert.equal(captured[0].messages[1].content[3].text.startsWith('USER TARGET REFERENCE'), true);
    assert.equal(captured[0].messages[1].content[4].image_url.url, body.referenceImages[1].dataUrl);
    assert.match(captured[0].messages[0].content, /Never infer the requested car, body color or stripes from the GLOBAL STYLE REFERENCE alone/);
    body.buildCategory = 'house';
    body.referenceImages = [{ role: 'category-default', dataUrl: 'data:image/jpeg;base64,/9j/2Q==' }];
    response = await send();
    assert.equal(response.status, 200);
    assert.match(captured[1].messages[0].content, /Selected build type: House/);
    assert.match(captured[1].messages[1].content[0].text, /"buildCategory":"house"/);
    assert.equal(captured[1].messages[1].content[1].text.startsWith('CATEGORY DEFAULT REFERENCE — selected HOUSE'), true);
    body.buildCategory = 'vehicle';
    body.referenceImages = [
      { role: 'category-default', dataUrl: 'data:image/jpeg;base64,/9j/2Q==' },
      { role: 'user-target', dataUrl: 'data:image/jpeg;base64,/9j/2Q==' },
    ];
    responsePlan = {
      ...plan,
      parts: [{ ...plan.parts[0], size: { x: 0.01, y: 1, z: 1 } }],
    };
    response = await send();
    assert.equal(response.status, 200);
    const repaired = await response.json();
    assert.equal(repaired.parts[0].size.x, 0.02);
    assert.match(repaired.warnings[0], /raised to the engine minimum/);
    responsePlan = {
      title: 'Orange coupe', summary: 'Editable coupe tool.', warnings: ['Hidden details are estimated.'],
      parts: [{ ...plan.parts[0], kind: 'vehicle', vehicleStyle: 'muscle-coupe',
        size: { x: 2.14, y: 1.44, z: 4.88 }, racingStripes: true }],
    };
    response = await send();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).parts[0].vehicleStyle, 'muscle-coupe');
    delete responsePlan.parts[0].vehicleStyle;
    response = await send();
    assert.equal(response.status, 502, 'Unknown vehicle recipes cannot reach the editor');
    truncate = true;
    response = await send();
    assert.equal(response.status, 502);
    const failure = await response.json();
    assert.match(failure.error, /response limit/);
    assert.match(failure.error, /No scene changes/);
    assert.equal(failure.parts, undefined);
  } finally {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
    await new Promise(resolve => mock.close(resolve));
  }
});
