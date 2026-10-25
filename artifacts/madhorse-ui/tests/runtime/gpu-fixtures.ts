import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { createGameCamera, type GameCamera } from '../../src/lib/game-camera';
import { type SceneEntity } from '../../src/lib/scene-model';

/** Fail (never skip or accept the SVG fallback) before blaming application rendering. */
export async function requireWebGL2(page: Page, info: TestInfo) {
  const capability = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return { available: false, userAgent: navigator.userAgent };
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const result = {
      available: true, userAgent: navigator.userAgent,
      version: gl.getParameter(gl.VERSION),
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return result;
  });
  await info.attach('webgl2-capability', { body: JSON.stringify(capability), contentType: 'application/json' });
  expect(capability.available, 'ENVIRONMENT: browser cannot create WebGL 2; GPU output is NOT verified').toBe(true);
}

/** Update only this isolated browser's project, retaining real imported IndexedDB assets. */
export async function setGPUScene(page: Page, entities: SceneEntity[], camera: GameCamera = createGameCamera(entities)) {
  // Apply after the old document's pagehide/autosave flush, not before it.
  // Consuming the payload once keeps subsequent UI edits/reloads genuine.
  await page.addInitScript(() => {
    const pending = sessionStorage.getItem('gpu-scene-fixture');
    if (!pending) return;
    sessionStorage.removeItem('gpu-scene-fixture');
    localStorage.setItem('madhorse-ui-projects', pending);
  });
  await page.evaluate(({ entities, camera }) => {
    const projects = JSON.parse(localStorage.getItem('madhorse-ui-projects')!);
    projects[0].entities = entities;
    projects[0].gameCamera = camera;
    projects[0].activeCameraId = null;
    sessionStorage.setItem('gpu-scene-fixture', JSON.stringify(projects));
  }, { entities, camera });
  await page.reload();
  const view = page.getByTestId('scene-game-view');
  await expect(view).toBeVisible();
  await expect(view).toHaveAttribute('data-camera-position', JSON.stringify(camera.position));
  await expect(view).toHaveAttribute('data-scene-entity-count', String(entities.length));
}

/**
 * Read compositor screenshots, not an R3F scene graph or a 2D/software substitute.
 * Copying a WebGL drawing buffer after presentation can return a cleared buffer.
 */
export async function gpuPixels(canvas: Locator, info: TestInfo, name: string,
  colorRegion?: { minX: number; maxX: number; minY: number; maxY: number }) {
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate(element => Boolean((element as HTMLCanvasElement).getContext('webgl2'))),
    'APPLICATION: capable browser did not produce a WebGL 2 canvas').toBe(true);
  // Hide DOM notices/orbit buttons only; never mask WebGL pixels (including
  // editor grid, transform handles, world axes and the orientation gizmo).
  const png = await canvas.screenshot({
    scale: 'css',
    style: '.mh-scene3d__game-controls, .mh-scene3d__notices { visibility: hidden !important; }',
  });
  await info.attach(name, { body: png, contentType: 'image/png' });
  return canvas.page().evaluate(async ({ base64, colorRegion }) => {
    const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const copy = document.createElement('canvas');
    copy.width = image.width; copy.height = image.height;
    const ctx = copy.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    image.close();
    const { data, width, height } = ctx.getImageData(0, 0, copy.width, copy.height);
    const colors = {
      red: (r: number, g: number, b: number) => r > 150 && g < 90 && b < 90,
      blue: (r: number, g: number, b: number) => b > 150 && r < 90 && g < 90,
      magenta: (r: number, g: number, b: number) => r > 150 && b > 150 && g < 90,
      // ACES tone mapping turns untextured saturated green into a lighter lime.
      green: (r: number, g: number, b: number) => g > 150 && g > r * 1.4 && g > b * 1.4,
    };
    const stats = Object.fromEntries(Object.keys(colors).map(key => [key,
      { count: 0, x: 0, y: 0, minX: width, maxX: 0, minY: height, maxY: 0 }])) as
      Record<keyof typeof colors, { count: number; x: number; y: number; minX: number; maxX: number; minY: number; maxY: number }>;
    // Outside a central fixture: game output must be uniform background, not grid,
    // world axes, selection outline, transform handles or orientation gizmos.
    let outside = 0, background = 0;
    // The extreme corner can be CSS-clipped/antialiased by the viewport border.
    const cornerIndex = (Math.floor(height * .05) * width + Math.floor(width * .05)) * 4;
    const corner = [data[cornerIndex], data[cornerIndex + 1], data[cornerIndex + 2]];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
      const inside = !colorRegion || (x >= colorRegion.minX && x <= colorRegion.maxX &&
        y >= colorRegion.minY && y <= colorRegion.maxY);
      for (const key of Object.keys(colors) as (keyof typeof colors)[]) if (inside && colors[key](r, g, b)) {
        const s = stats[key]; s.count++; s.x += x; s.y += y;
        s.minX = Math.min(s.minX, x); s.maxX = Math.max(s.maxX, x);
        s.minY = Math.min(s.minY, y); s.maxY = Math.max(s.maxY, y);
      }
      if (x < width * .2 || x > width * .8 || y < height * .25 || y > height * .75) {
        outside++;
        if (Math.max(Math.abs(r - corner[0]), Math.abs(g - corner[1]), Math.abs(b - corner[2])) <= 3) background++;
      }
    }
    for (const s of Object.values(stats)) if (s.count) { s.x /= s.count; s.y /= s.count; }
    return { width, height, stats, backgroundFraction: background / outside };
  }, { base64: png.toString('base64'), colorRegion });
}

export async function twoColorSprite(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 32, 16);
    ctx.fillStyle = '#0000ff'; ctx.fillRect(0, 16, 32, 16);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return { name: 'upright.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

export function magentaModel() {
  // A double-sided unlit scalene triangle: different from every loader placeholder.
  const vertices = [-1, 0, 0, 1, 0, 0, -.6, 2, 0];
  const bytes = Buffer.alloc(vertices.length * 4);
  vertices.forEach((value, i) => bytes.writeFloatLE(value, i * 4));
  return { name: 'gpu-triangle.gltf', mimeType: 'model/gltf+json', buffer: Buffer.from(JSON.stringify({
    asset: { version: '2.0' }, extensionsUsed: ['KHR_materials_unlit'],
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [1, 0, 1, 1] }, extensions: { KHR_materials_unlit: {} } }],
    buffers: [{ uri: `data:application/octet-stream;base64,${bytes.toString('base64')}`, byteLength: bytes.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bytes.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, 0, 0], max: [1, 2, 0] }],
  })) };
}
