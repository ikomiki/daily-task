// vite-plugin-pwa が build 時に注入する virtual:pwa-register を動的 import する薄いラッパー。
// vitest 環境では virtual モジュールが存在せず import が throw するため、catch 経由で握り潰す。
// 本番ビルドでは autoUpdate モード相当（immediate=true）で SW を登録する。
export async function registerPwa(): Promise<void> {
  try {
    const mod = await import('virtual:pwa-register');
    mod.registerSW({
      immediate: true,
      onRegisterError: (err) => {
        console.warn('[pwa] SW 登録失敗:', err);
      },
    });
  } catch (err) {
    // dev / test 環境では virtual:pwa-register が解決できない → 握り潰す
    console.debug('[pwa] virtual:pwa-register をスキップ:', err);
  }
}
