/** Fresh layout surface. Engine modules remain intact and inactive. */
import './numbered-workspace.css';

export default function BlankWorkspace() {
  return (
    <main className="fresh-layout" aria-label="Blank Madhorse workspace">
      {[1, 2, 3, 4, 5].map((number) => (
        <section
          key={number}
          className={`fresh-panel fresh-panel-${number}`}
          aria-label={`Panel ${number}`}
        >
          <span className="fresh-panel-number" aria-hidden="true">{number}</span>
        </section>
      ))}
    </main>
  );
}
