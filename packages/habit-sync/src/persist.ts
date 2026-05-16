import { ObservablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb';
import { configureObservableSync } from '@legendapp/state/sync';

export interface SyncPersistenceConfig {
  databaseName: string;
  tableNames: string[];
  version?: number;
}

// IndexedDB 永続化を global に登録する。アプリ起動時に 1 度だけ呼ぶ。
// 各 observable の persist.name と tableNames を一致させること。
export function configureSyncPersistence(config: SyncPersistenceConfig): void {
  configureObservableSync({
    persist: {
      plugin: new ObservablePersistIndexedDB({
        databaseName: config.databaseName,
        version: config.version ?? 1,
        tableNames: config.tableNames,
      }),
    },
  });
}
