// vitest 起動時に fake-indexeddb を有効化する。
// node 環境では indexedDB が無いため、persist テストで必要。
import 'fake-indexeddb/auto';
