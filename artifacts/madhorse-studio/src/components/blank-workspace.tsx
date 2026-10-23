/** Fresh layout surface. Engine modules remain intact and inactive. */
export default function BlankWorkspace() {
  return <main aria-label="Blank Madhorse workspace" style={{
    position: 'fixed',
    inset: 0,
    background: '#111315',
    overflow: 'hidden',
  }} />;
}
