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
      <section
        className="fresh-vision-page-canvas"
        aria-label="Blank vision board"
        data-testid="vision-board-canvas"
      />
    </main>
  );
}
