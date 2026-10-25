import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SceneTransformOptions } from '../../src/components/scene-transform-options';
import { useSceneTransformSettings, TRANSFORM_SETTINGS_KEY } from '../../src/hooks/use-scene-transform-settings';
const status = document.getElementById('verification')!;
const previous = localStorage.getItem(TRANSFORM_SETTINGS_KEY);
let latest: ReturnType<typeof useSceneTransformSettings>[0];
let setDisabled: (value: boolean) => void;
function Fixture() {
  const [settings, setSettings] = useSceneTransformSettings();
  const [disabled, changeDisabled] = useState(false);
  latest = settings; setDisabled = changeDisabled;
  return <SceneTransformOptions settings={settings} onChange={setSettings} disabled={disabled} />;
}
function Mirror() {
  const [settings] = useSceneTransformSettings();
  return <p id="mirror">{settings.space} · {settings.snap ? 'Snapping on' : 'Snapping off'} · {settings.moveStep} / {settings.turnStep}° / {settings.scaleStep}</p>;
}
const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const input = (label: string, value: string) => {
  const element = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
  flushSync(() => element.dispatchEvent(new Event('input', { bubbles: true })));
};
try {
  localStorage.setItem(TRANSFORM_SETTINGS_KEY, '{bad json');
  flushSync(() => createRoot(document.getElementById('root')!).render(<><Fixture /><Mirror /></>));
  check(latest!.space === 'auto' && !latest!.snap, 'Corrupt saved preferences did not recover.');
  const select = document.querySelector('select')!;
  select.value = 'world'; flushSync(() => select.dispatchEvent(new Event('change', { bubbles: true })));
  flushSync(() => document.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
  check(document.getElementById('mirror')!.textContent?.includes('world · Snapping on'), 'Live preference subscribers did not synchronize.');
  flushSync(() => document.querySelector<HTMLButtonElement>('[aria-label="Snap settings"]')!.click());
  input('Move grid (3D units)', '');
  document.querySelector('form')!.requestSubmit();
  check(document.querySelector('dialog')!.open && latest!.moveStep === 1, 'Empty input was incorrectly saved.');
  input('Move grid (3D units)', '.5'); input('Turn angle (degrees)', '30'); input('Size step (ratio)', '.25');
  flushSync(() => document.querySelector('form')!.requestSubmit());
  check(!document.querySelector('dialog')!.open && latest!.moveStep === .5 && latest!.turnStep === 30 && latest!.scaleStep === .25, 'Apply steps did not save the entered values.');
  check(JSON.parse(localStorage.getItem(TRANSFORM_SETTINGS_KEY)!).turnStep === 30, 'Preferences were not persisted.');
  flushSync(() => document.querySelector<HTMLButtonElement>('[aria-label="Snap settings"]')!.click());
  input('Move grid (3D units)', '5');
  flushSync(() => Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Cancel')!.click());
  check(latest!.moveStep === .5, 'Cancel incorrectly saved a draft.');
  flushSync(() => document.querySelector<HTMLButtonElement>('[aria-label="Snap settings"]')!.click());
  flushSync(() => setDisabled(true));
  check(!document.querySelector('dialog')!.open && document.querySelector<HTMLSelectElement>('select')!.disabled, 'Runtime/read-only controls were not disabled.');
  flushSync(() => setDisabled(false));
  status.textContent = 'PASS — actual controls, validation, apply/cancel, browser persistence, shared live preferences and runtime disabling.';
  status.style.color = '#8dffc4';
} catch (error) {
  status.textContent = `FAIL — ${error instanceof Error ? error.message : error}`;
  console.error(error);
} finally {
  if (previous === null) localStorage.removeItem(TRANSFORM_SETTINGS_KEY);
  else localStorage.setItem(TRANSFORM_SETTINGS_KEY, previous);
}
