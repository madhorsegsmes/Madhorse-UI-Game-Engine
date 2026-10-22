import type { GamePosition } from '@/lib/game-api';

export function GameScene({ position }: { position: GamePosition }) {
  return (
    <div className="game-scene">
      <span className="scene-title">First scene · 2D preview</span>
      <div className="scene-field" aria-label="Game scene, coordinates 0 to 100">
        <div
          className="scene-player"
          role="img"
          aria-label={`Player object at x ${position.x}, y ${position.y}`}
          data-testid="scene-player"
          data-x={position.x}
          data-y={position.y}
          style={{ left: `${position.x}%`, top: `${position.y}%` }}
        />
      </div>
      <span className="scene-position">player · x {position.x} · y {position.y}</span>
    </div>
  );
}
