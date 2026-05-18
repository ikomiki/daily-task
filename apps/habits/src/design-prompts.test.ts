import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');
const DESIGN_PROMPTS_DIR = resolve(REPO_ROOT, 'docs/design-prompts');

const SCREEN_FILES = [
  'auth-login.md',
  'auth-signup.md',
  'today.md',
  'tasks-list.md',
  'task-edit.md',
  'time-slots.md',
  'settings.md',
  'stash-panel.md',
  'history.md',
  'calendar.md',
] as const;

const REQUIRED_SECTIONS = [
  '## 目的',
  '## 表示要素',
  '## インタラクション',
  '## 状態',
  '## レスポンシブ',
  '## アクセシビリティ',
  '## 既存スタイル参照',
] as const;

describe('design-prompts', () => {
  it('docs/design-prompts/ に 11 ファイル（README + 10 画面）が存在する', () => {
    const files = readdirSync(DESIGN_PROMPTS_DIR);
    expect(files).toHaveLength(11);
    expect(files).toContain('README.md');
    for (const screen of SCREEN_FILES) {
      expect(files).toContain(screen);
    }
  });

  it.each(SCREEN_FILES)('%s に 7 必須セクションが含まれる', (file) => {
    const content = readFileSync(resolve(DESIGN_PROMPTS_DIR, file), 'utf8');
    for (const section of REQUIRED_SECTIONS) {
      expect(content, `${file} に "${section}" が必要`).toContain(section);
    }
  });

  it('README.md に 5 必須セクションが含まれる', () => {
    const content = readFileSync(resolve(DESIGN_PROMPTS_DIR, 'README.md'), 'utf8');
    for (const section of [
      '## 目的',
      '## 対象画面',
      '## 共通スタイル方針',
      '## 共通章立て',
      '## 運用',
    ]) {
      expect(content, `README.md に "${section}" が必要`).toContain(section);
    }
  });
});
