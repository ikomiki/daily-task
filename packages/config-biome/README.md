# @org/config-biome

ワークスペース全体で共有する Biome 設定。

## 提供する設定

- `formatter`: indent space 2、line width 100、single quote、trailing comma all、semicolon always
- `linter` の主な error:
  - `noExplicitAny` — `any` 禁止
  - `useBlockStatements` — if 文の制御ブロックは必ず `{}`
  - `noParameterAssign`
- `css.parser.tailwindDirectives: true` — Tailwind v4 の `@theme` ブロックを許可

## 使い方

各パッケージの `biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.14/schema.json",
  "extends": ["@org/config-biome/biome.json"],
  "root": false
}
```

`root: false` は Biome 2 の必須属性（nested config が複数 root とみなされないため）。

ルートの `biome.json` は `root: true`（デフォルト）で同じく `extends` する。
