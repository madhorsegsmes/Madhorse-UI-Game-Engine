import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { HierarchySearchControls } from '../../src/components/hierarchy-search-controls';
import { filterSceneHierarchy } from '../../src/lib/scene-object-actions';
import type { SceneEntity } from '../../src/lib/scene-model';

const source = [
  { id: 'root', name: 'Starter scene', parentId: null, active: true, components: [] },
  { id: 'cube', name: 'Castle wall', parentId: 'root', active: true, components: [{ id: 'cube-p', type: 'primitive' }] },
  { id: 'model', name: 'Knight model', parentId: 'root', active: true, components: [{ id: 'model-m', type: 'modelRenderer' }] },
  { id: 'physics', name: 'Crate', parentId: 'root', active: true, components: [{ id: 'physics-p', type: 'physics' }] },
  { id: 'light', name: 'Sunlight', parentId: 'root', active: true, components: [{ id: 'light-l', type: 'light' }] },
  { id: 'camera', name: 'Level camera', parentId: 'root', active: true, components: [{ id: 'camera-c', type: 'camera' }] },
  { id: 'script', name: 'Gate script', parentId: 'root', active: true, components: [{ id: 'script-s', type: 'script' }] },
  { id: 'audio', name: 'Footsteps', parentId: 'root', active: true, components: [{ id: 'audio-a', type: 'playerWalkAudio' }] },
  { id: 'ui', name: 'Health display', parentId: 'root', active: true, components: [{ id: 'ui-u', type: 'uiCanvas' }] },
  { id: 'npc', name: 'Guard', parentId: 'root', active: true, components: [{ id: 'npc-a', type: 'characterController' }] },
  { id: 'off', name: 'Old torch', parentId: 'root', active: false, components: [{ id: 'off-l', type: 'light' }] },
] as unknown as SceneEntity[];
const status = document.getElementById('verification')!;
function Fixture() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'visuals' | 'physics' | 'lighting' | 'camera' | 'scripts' | 'audio' | 'ui' | 'gameplay' | 'inactive'>('all');
  const filtered = useMemo(() => filterSceneHierarchy(source, search, filter), [search, filter]);
  return <main><h1>Hierarchy filters</h1>
    <HierarchySearchControls search={search} onSearch={setSearch} filter={filter} onFilter={setFilter} />
    <p id="hierarchy-search-count" data-testid="hierarchy-search-count" role="status">{filtered.matches} matching object{filtered.matches === 1 ? '' : 's'}</p>
    <ul data-testid="hierarchy-results">{filtered.entities.map(entity => <li key={entity.id} data-id={entity.id}>
      {entity.id === 'root' ? 'Scene › ' : ''}{entity.name}{!entity.active ? ' · Inactive' : ''}
    </li>)}</ul>
  </main>;
}
try {
  flushSync(() => createRoot(document.getElementById('root')!).render(<Fixture />));
  const select = document.querySelector<HTMLSelectElement>('[data-testid="hierarchy-type-filter"]')!;
  const search = document.querySelector<HTMLInputElement>('[data-testid="hierarchy-search"]')!;
  const rows = () => [...document.querySelectorAll<HTMLLIElement>('[data-testid="hierarchy-results"] li')].map(row => row.dataset.id);
  const choose = (value: string) => { select.value = value; flushSync(() => select.dispatchEvent(new Event('change', { bubbles: true }))); };
  const type = (value: string) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; setter.call(search, value); flushSync(() => search.dispatchEvent(new Event('input', { bubbles: true }))); };
  if (rows().length !== source.length || document.getElementById('hierarchy-search-count')!.textContent !== '11 matching objects') throw new Error('Default list failed.');
  choose('physics');
  if (rows().join() !== 'root,physics' || document.getElementById('hierarchy-search-count')!.textContent !== '1 matching object') throw new Error('Physics filter or parent path failed.');
  choose('visuals');
  if (rows().join() !== 'root,cube,model') throw new Error('Visual filter failed.');
  type('Castle');
  if (rows().join() !== 'root,cube' || !search.value) throw new Error('Combined text + type search failed.');
  choose('scripts');
  if (rows().length !== 0 || document.getElementById('hierarchy-search-count')!.textContent !== '0 matching objects') throw new Error('Empty state failed.');
  const clear = document.querySelector<HTMLButtonElement>('[aria-label="Clear hierarchy search"]')!;
  flushSync(() => clear.click());
  if (rows().join() !== 'root,script') throw new Error('Clear-search button failed.');
  choose('inactive');
  if (rows().join() !== 'root,off' || !rows().includes('off')) throw new Error('Inactive filtering failed.');
  choose('all');
  type('no-match');
  if (rows().length !== 0 || document.getElementById('hierarchy-search-count')!.textContent !== '0 matching objects') throw new Error('Name-search empty state failed.');
  type('');
  status.textContent = 'PASS — actual Hierarchy search/filter controls, combined filters, result counts, ancestor paths, empty state, clear and inactive-object filter.';
  status.style.color = '#8dffc4';
} catch (error) { status.textContent = `FAIL — ${error instanceof Error ? error.message : error}`; console.error(error); }
