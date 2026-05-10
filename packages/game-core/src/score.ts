import { createStore } from 'zustand/vanilla';

// スコア状態と操作を提供するZustand store
export interface ScoreState {
  score: number;
  increment: () => void;
  reset: () => void;
}

export const createScoreStore = () =>
  createStore<ScoreState>((set) => ({
    score: 0,
    increment: () => {
      set((state) => ({ score: state.score + 1 }));
    },
    reset: () => {
      set({ score: 0 });
    },
  }));
