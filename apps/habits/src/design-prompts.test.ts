import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_ROOT = resolve(__dirname, '..');

// 11 files expected in docs/design-prompts directory
const EXPECTED_FILES = [
  'README.md',
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
];

// 10 screen Markdown files (excluding README)
const SCREEN_FILES = EXPECTED_FILES.filter((f) => f !== 'README.md');

// Required H2 sections for screen files
const REQUIRED_SECTIONS_SCREEN = [
  '## 目的',
  '## 表示要素',
  '## インタラクション',
  '## 状態',
  '## レスポンシブ',
  '## アクセシビリティ',
  '## 既存スタイル参照',
];

// Required H2 sections for README
const REQUIRED_SECTIONS_README = [
  '## 目的',
  '## 対象画面',
  '## 共通スタイル方針',
  '## 共通章立て',
  '## 運用',
];

describe('design-prompts', () => {
  it('docs/design-prompts ディレクトリに 11 個のファイルが存在する', () => {
    const designPromptsDir = resolve(APP_ROOT, '../..', 'docs/design-prompts');
    expect(existsSync(designPromptsDir)).toBe(true);

    const files = EXPECTED_FILES.map((filename) => resolve(designPromptsDir, filename));

    files.forEach((file) => {
      expect(existsSync(file)).toBe(true);
    });
  });

  it.each(SCREEN_FILES)('%s が 7 つの必須セクションをすべて含む', (filename) => {
    const filePath = resolve(APP_ROOT, '../..', 'docs/design-prompts', filename);
    const content = readFileSync(filePath, 'utf8');

    REQUIRED_SECTIONS_SCREEN.forEach((section) => {
      expect(content).toContain(section);
    });
  });

  it('README.md が 5 つの必須セクションをすべて含む', () => {
    const readmePath = resolve(APP_ROOT, '../..', 'docs/design-prompts', 'README.md');
    const content = readFileSync(readmePath, 'utf8');

    REQUIRED_SECTIONS_README.forEach((section) => {
      expect(content).toContain(section);
    });
  });
});
