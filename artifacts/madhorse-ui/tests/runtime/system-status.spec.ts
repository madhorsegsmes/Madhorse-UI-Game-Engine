import { expect, type Page } from '@playwright/test';
import { beginSystemActivity, getSystemActivity, withSystemActivity } from '../../src/lib/system-activity';
import { test } from './fixtures';

async function mockWakeLock(page: Page, denyFirst = false) {
  await page.addInitScript(({ denyFirst }) => {
    const state = { requests: 0, releases: 0, visible: true, releaseCurrent: () => {} };
    class Sentinel extends EventTarget {
      released = false;
      type = 'screen';
      async release() {
        if (this.released) return;
        this.released = true;
        state.releases++;
        this.dispatchEvent(new Event('release'));
      }
    }
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async (type: string) => {
          if (type !== 'screen') throw new Error('Wrong wake lock type');
          state.requests++;
          if (denyFirst && state.requests === 1) throw new DOMException('Denied', 'NotAllowedError');
          const sentinel = new Sentinel();
          state.releaseCurrent = () => { void sentinel.release(); };
          return sentinel;
        },
      },
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true, get: () => state.visible ? 'visible' : 'hidden',
    });
    Reflect.set(window, '__wakeTest', state);
  }, { denyFirst });
}

test('activity counts overlapping work and always finishes after failure', async () => {
  const initial = getSystemActivity();
  const first = beginSystemActivity('First read');
  const second = beginSystemActivity('Second read');
  expect(getSystemActivity().pending).toBe(2);
  first();
  first();
  expect(getSystemActivity().pending).toBe(1);
  second();
  expect(getSystemActivity().pending).toBe(0);
  expect(getSystemActivity().started).toBe(initial.started + 2);
  await expect(withSystemActivity('Failed read', async () => {
    throw new Error('Read failed');
  })).rejects.toThrow('Read failed');
  expect(getSystemActivity().pending).toBe(0);
});

test('refresh and real file reads show a spinning cog and an indeterminate bar', async ({ page }) => {
  await mockWakeLock(page);
  await page.addInitScript(() => {
    const original = File.prototype.text;
    File.prototype.text = async function () {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return original.call(this);
    };
  });
  await page.goto('/');
  await expect(page.getByTestId('system-status')).toBeVisible();
  await expect(page.getByTestId('system-status')).toHaveAttribute('data-busy', 'false');
  await page.getByLabel('Script tools').click();
  await page.locator('.script-file-input').setInputFiles({
    name: 'activity.js', mimeType: 'text/javascript', buffer: Buffer.from('console.log("activity test");'),
  });
  await expect(page.getByTestId('system-activity-label')).toHaveText('Reading scripts');
  await expect(page.getByTestId('system-status')).toHaveAttribute('data-busy', 'true');
  await expect(page.getByTestId('system-status-cog')).toHaveCSS('animation-name', 'system-cog-turn');
  expect(await page.getByTestId('system-loading-bar').getAttribute('aria-valuenow')).toBeNull();
  await expect(page.locator('#script-source')).toHaveValue('console.log("activity test");');
  await expect(page.getByTestId('system-status')).toHaveAttribute('data-busy', 'false');
  await expect(page.getByTestId('system-loading-bar')).toHaveAttribute('aria-valuenow', '100');
  await page.reload();
  await expect(page.getByTestId('system-status')).toBeVisible();
  await expect(page.getByTestId('system-status')).toHaveAttribute('data-busy', 'false');
});

test('screen wake lock is held, reacquired after backgrounding, and released on leaving', async ({ page }) => {
  await mockWakeLock(page);
  await page.goto('/');
  await expect(page.getByTestId('screen-wake-status')).toHaveAttribute('data-status', 'active');
  expect(await page.evaluate(() => Reflect.get(window, '__wakeTest').requests)).toBe(1);
  await page.evaluate(() => {
    Reflect.get(window, '__wakeTest').visible = false;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('screen-wake-status')).toHaveAttribute('data-status', 'released');
  expect(await page.evaluate(() => Reflect.get(window, '__wakeTest').releases)).toBe(1);
  await page.evaluate(() => {
    Reflect.get(window, '__wakeTest').visible = true;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByTestId('screen-wake-status')).toHaveAttribute('data-status', 'active');
  expect(await page.evaluate(() => Reflect.get(window, '__wakeTest').requests)).toBe(2);
  await page.evaluate(() => Reflect.get(window, '__wakeTest').releaseCurrent());
  await expect(page.getByTestId('screen-wake-status')).toHaveAttribute('data-status', 'released');
  await page.getByTestId('screen-wake-status').click();
  await expect(page.getByTestId('screen-wake-status')).toHaveAttribute('data-status', 'active');
  expect(await page.evaluate(() => Reflect.get(window, '__wakeTest').requests)).toBe(3);
  await page.evaluate(() => {
    history.pushState({}, '', '/not-found');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByTestId('screen-wake-status')).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, '__wakeTest').releases)).toBe(3);
});

test('denied wake locks show an honest state and can be retried', async ({ page }) => {
  await mockWakeLock(page, true);
  await page.goto('/');
  await expect(page.getByTestId('screen-wake-status')).toHaveAttribute('data-status', 'blocked');
  await expect(page.getByTestId('screen-wake-status')).toHaveText('Keep screen awake');
  await page.getByTestId('screen-wake-status').click();
  await expect(page.getByTestId('screen-wake-status')).toHaveAttribute('data-status', 'active');
});

test('unsupported browsers stay usable without claiming the screen is awake', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'wakeLock', {
    configurable: true, value: undefined,
  }));
  await page.goto('/');
  await expect(page.getByTestId('screen-wake-status')).toHaveAttribute('data-status', 'unsupported');
  await expect(page.getByTestId('screen-wake-status')).toBeDisabled();
  await expect(page.getByTestId('screen-wake-status')).toHaveText('Wake unavailable');
  await expect(page.getByTestId('tab-scene-2d')).toBeVisible();
});
