import './workspace-browser-menus.css';

export function WorkspaceBrowserMenus() {
  return (
    <>
      {['Hierarchy', 'Assets', 'Data'].map((label) => (
        <details
          key={label}
          name="workspace-browser"
          className={`workspace-browser-menu workspace-browser-${label.toLowerCase()}`}
        >
          <summary className="control-button">
            {label} <span className="control-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="workspace-browser-panel" aria-label={`${label} contents`} />
        </details>
      ))}
    </>
  );
}
