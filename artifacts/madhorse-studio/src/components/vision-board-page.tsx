import { ArrowLeft } from 'lucide-react';

export default function VisionBoardPage() {
  return (
    <main className="fresh-vision-page" data-testid="vision-board-page">
      <header className="fresh-vision-page-header">
        <a className="fresh-vision-back" href="../" data-testid="vision-board-back">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Studio</span>
        </a>
        <h1>Vision Board</h1>
      </header>
      <div className="fresh-vision-toolbar" aria-label="Vision board toolbar" data-testid="vision-board-toolbar" />
      <section className="fresh-vision-board-layout" aria-label="Vision board workspace">
        <div className="fresh-vision-page-canvas" aria-label="Blank canvas" data-testid="vision-board-canvas" />
        <aside className="fresh-vision-side-panel" aria-label="Blank right-side panel" data-testid="vision-board-side-panel" />
      </section>
    </main>
  );
}
