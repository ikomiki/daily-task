#!/usr/bin/env node
// PostToolUse hook: Edit/Write/MultiEdit直後に対象ファイルだけbiome formatする。
// 失敗しても non-blocking（exit 0）。
import { spawnSync } from 'node:child_process';
import { extname } from 'node:path';

const TARGET_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.jsonc']);

const readStdin = () =>
  new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      buf += chunk;
    });
    process.stdin.on('end', () => {
      resolve(buf);
    });
  });

const main = async () => {
  const raw = await readStdin();
  if (!raw.trim()) {
    return;
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }
  const filePath = payload?.tool_input?.file_path;
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return;
  }
  if (!TARGET_EXTS.has(extname(filePath))) {
    return;
  }
  spawnSync('pnpm', ['exec', 'biome', 'format', '--write', filePath], {
    stdio: 'ignore',
  });
};

main().catch(() => {
  // フォーマッタ障害で agent をブロックしない
});
