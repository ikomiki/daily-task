import { GameCanvas } from '@org/game-core';
import { ScoreHud } from '@org/ui';
import { useGameSound } from '@org/audio';
import { useSampleGame } from './useSampleGame';

// sample-game のメイン画面: HUD + Pixiキャンバス + タップボタン
export const App = () => {
  const { score, increment } = useSampleGame();
  const { play } = useGameSound('/se/click.mp3', 0.5);

  const onTap = () => {
    play();
    increment();
  };

  return (
    <div className="relative h-screen w-screen">
      <ScoreHud score={score} />
      <div className="absolute inset-0 flex items-center justify-center">
        <GameCanvas width={640} height={480}>
          {/* レンダリング詳細はPixi要素として後で拡張 */}
        </GameCanvas>
      </div>
      <button
        type="button"
        onClick={onTap}
        aria-label="tap"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded bg-game-accent px-8 py-4 text-game-bg"
      >
        TAP
      </button>
    </div>
  );
};
