import './blank-layout.css';

export default function BlankWorkspace() {
  return (
    <main className="fresh-layout" aria-label="Blank Madhorse layout">
      <div className="fresh-toolbar" role="toolbar" aria-label="Empty toolbar" />
      {[1, 2, 3, 4, 5].map(number => (
        <section key={number} className={`fresh-panel fresh-panel-${number}`} aria-label={`Panel ${number}`}>
          <span className="fresh-panel-number" aria-hidden="true">{number}</span>
        </section>
      ))}
    </main>
  );
}
