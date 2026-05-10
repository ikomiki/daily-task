#!/usr/bin/env node
// PreToolUse hook: Bash で `git commit` を実行する直前に nx affected -t lint test を走らせる。
// 失敗時は非ゼロ終了で commit をブロックする。
import { spawnSync } from 'node:child_process';

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
    return 0;
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return 0;
  }
  const command = payload?.tool_input?.command ?? '';
  // git commit を含むものだけ対象。amend や status などは対象外。
  if (typeof command !== 'string' || !/\bgit\s+commit\b/.test(command)) {
    return 0;
  }
  if (/--no-verify/.test(command)) {
    return 0;
  }
  const result = spawnSync('pnpm', ['nx', 'affected', '-t', 'lint', 'test'], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.stderr.write('\n[pre-commit-gate] lint/test failed. commit blocked.\n');
    return 2;
  }
  return 0;
};

main()
  .then((code) => {
    process.exit(code);
  })
  .catch(() => {
    // フック自体の障害ではcommitを止めない（フェイルオープン）
    process.exit(0);
  });
