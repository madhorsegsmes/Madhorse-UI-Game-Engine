import { hierarchyFilterOptions, type HierarchyFilter } from '@/lib/scene-object-actions';
export function HierarchySearchControls({ search, onSearch, filter, onFilter }: {
  search: string; onSearch: (value: string) => void;
  filter: HierarchyFilter; onFilter: (value: HierarchyFilter) => void;
}) {
  return <div className="fresh-hierarchy-search">
    <input type="search" aria-label="Search hierarchy by name" placeholder="Find object…" maxLength={120}
      value={search} onChange={event => onSearch(event.currentTarget.value)} data-testid="hierarchy-search" />
    {search && <button type="button" aria-label="Clear hierarchy search" onClick={() => onSearch('')}>×</button>}
    <select aria-label="Filter hierarchy by type" value={filter}
      onChange={event => onFilter(event.currentTarget.value as HierarchyFilter)} data-testid="hierarchy-type-filter">
      {hierarchyFilterOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>;
}
