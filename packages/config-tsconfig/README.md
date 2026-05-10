# @org/config-tsconfig

ワークスペース全体で共有する TypeScript 設定。3層構成で配布。

## 提供する設定

| ファイル | 用途 | 主な設定 |
|---------|------|--------|
| `base.json` | 全プロジェクト共通の strict 設定 | `strict`, `noImplicitAny`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `customConditions: ["@org/source"]`, `module: esnext`, `moduleResolution: bundler`, `target: es2022` |
| `lib.json` | ライブラリビルド用 | base + `composite`, `declaration`, `declarationMap`, `emitDeclarationOnly` |
| `app.json` | アプリビルド用 | base + `jsx: react-jsx`, `noEmit` |

## 使い方

### lib

`packages/<lib>/tsconfig.json`（LSP 用、テスト含む）:

```json
{
  "extends": "@org/config-tsconfig/base.json",
  "compilerOptions": { "jsx": "react-jsx", "noEmit": true },
  "include": ["src/**/*", "vitest.config.ts"]
}
```

`packages/<lib>/tsconfig.lib.json`（ビルド用、テスト除外）:

```json
{
  "extends": "@org/config-tsconfig/lib.json",
  "compilerOptions": { "outDir": "./dist", "rootDir": "./src", "jsx": "react-jsx" },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts", "**/*.test.tsx"]
}
```

### app

`apps/<app>/tsconfig.app.json`:

```json
{
  "extends": "@org/config-tsconfig/app.json",
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts", "**/*.test.tsx", "e2e/**"]
}
```

## customConditions の働き

`customConditions: ["@org/source"]` により、TS は workspace パッケージを `package.json` の
`exports['.'].@org/source` に書かれた `.ts` ソースで直接解決する。

各パッケージの `package.json` 例:

```json
"exports": {
  ".": {
    "@org/source": "./src/index.ts",
    "default": "./src/index.ts"
  }
}
```

これにより TypeScript project references が不要になり、
`pnpm nx typecheck` が dist のビルドを待たずに通る。
