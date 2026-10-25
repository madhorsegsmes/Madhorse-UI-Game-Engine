import test from 'node:test';
import assert from 'node:assert/strict';
import { playAudioPreview, scenePositionToAudioPosition, stopAudioPlayback } from '../src/lib/game-audio';
import { createDefaultPlayer, isSceneGraph } from '../src/lib/scene-model';

test('scene positions map to the same Y-up world coordinates used by the 3D camera', () => {
  assert.deepEqual(scenePositionToAudioPosition({ x: 60, y: 70, z: 20 }), {
    x: 1, y: 2, z: 2,
  });
});

test('legacy audio components remain valid without the optional spatial flag', () => {
  const player = createDefaultPlayer();
  player.components.push(
    { id: 'legacy-game-audio', type: 'gameAudio', enabled: true, clipAssetId: null, volume: 0.5, pitch: 1, playOnStart: false },
    { id: 'legacy-walk-audio', type: 'playerWalkAudio', enabled: true, clipAssetId: null, volume: 0.3, pitch: 1, stepInterval: 0.38 },
  );
  assert.equal(isSceneGraph([player]), true);
});

test('new 3D sound components validate the spatial flag', () => {
  const player = createDefaultPlayer();
  player.components.push({
    id: 'spatial-walk-audio', type: 'playerWalkAudio', enabled: true,
    clipAssetId: null, volume: 0.3, pitch: 1, stepInterval: 0.38, spatialized: true,
  });
  assert.equal(isSceneGraph([player]), true);
  player.components[player.components.length - 1] = {
    id: 'bad-spatial-audio', type: 'gameAudio', enabled: true,
    clipAssetId: null, volume: 0.3, pitch: 1, playOnStart: false, spatialized: 'yes',
  } as never;
  assert.equal(isSceneGraph([player]), false);
});

test('spatial sound routes through a distance panner with the emitter position', async () => {
  class FakeParam {
    value = 0;
    cancelScheduledValues() {}
    setValueAtTime(value: number) { this.value = value; }
    exponentialRampToValueAtTime(value: number) { this.value = value; }
  }
  class FakeNode {
    connections: unknown[] = [];
    connect(node: unknown) { this.connections.push(node); }
    disconnect() {}
  }
  class FakePanner extends FakeNode {
    positionX = new FakeParam();
    positionY = new FakeParam();
    positionZ = new FakeParam();
    panningModel = 'equalpower';
    distanceModel = 'linear';
    refDistance = 1;
    maxDistance = 10000;
    rolloffFactor = 1;
  }
  class FakeOscillator extends FakeNode {
    frequency = new FakeParam();
    type = 'sine';
    onended: (() => void) | null = null;
    start() {}
    stop() {}
  }
  class FakeGain extends FakeNode { gain = new FakeParam(); }
  class FakeAudioContext {
    static latest: FakeAudioContext;
    currentTime = 1;
    state = 'running';
    destination = {};
    panner = new FakePanner();
    oscillator = new FakeOscillator();
    listener = { positionX: new FakeParam(), positionY: new FakeParam(), positionZ: new FakeParam() };
    constructor() { FakeAudioContext.latest = this; }
    createPanner() { return this.panner; }
    createOscillator() { return this.oscillator; }
    createGain() { return new FakeGain(); }
    resume() { return Promise.resolve(); }
  }
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { AudioContext: FakeAudioContext },
  });
  try {
    const played = await playAudioPreview(null, 0.5, 1, 'tone', 'runtime', {
      source: { x: 4, y: 2, z: -3 },
      listener: { x: 1, y: 1, z: 0 },
    });
    assert.equal(played, true);
    assert.equal(FakeAudioContext.latest.panner.positionX.value, 4);
    assert.equal(FakeAudioContext.latest.panner.positionY.value, 2);
    assert.equal(FakeAudioContext.latest.panner.positionZ.value, -3);
    assert.equal(FakeAudioContext.latest.panner.distanceModel, 'inverse');
    assert.ok(FakeAudioContext.latest.oscillator.connections[0] instanceof FakeGain);
    stopAudioPlayback('runtime');
  } finally {
    if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
