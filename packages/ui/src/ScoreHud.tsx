interface ScoreHudProps {
  score: number;
}

// 画面上部に固定表示するスコアHUD
export const ScoreHud = ({ score }: ScoreHudProps) => (
  <div
    role="status"
    aria-label="Score"
    className="absolute top-4 left-4 rounded bg-game-bg/80 px-4 py-2 font-display text-game-fg"
  >
    <div className="text-xs uppercase tracking-wider">Score</div>
    <div className="text-2xl text-game-accent">{score}</div>
  </div>
);
