// vite-plugin-pwa が build 時に注入する virtual モジュールの型宣言。
// tsconfig.app.json の types で vite-plugin-pwa/client を取り込めば不要だが、
// 失敗時の保険として明示しておく。
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: unknown) => void;
  }
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}
