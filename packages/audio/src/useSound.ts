import useSoundLib from 'use-sound';

interface GameSound {
  play: () => void;
  stop: () => void;
}

// use-sound の薄いラッパー。プロジェクト内で SE/BGM 用途のフック呼び出しを統一する。
export const useGameSound = (src: string, volume = 1): GameSound => {
  const [play, { stop }] = useSoundLib(src, { volume });
  return {
    play: () => {
      play();
    },
    stop: () => {
      stop();
    },
  };
};
