type LocalStorageLike = {
  clear: () => void;
  getItem: (key: string) => string | null;
  key: (index: number) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
  length: number;
};

export function ensureLocalStoragePolyfill() {
  const globalWithStorage = globalThis as typeof globalThis & { localStorage?: LocalStorageLike };
  if (globalWithStorage.localStorage) {
    return;
  }

  const memoryStorage = new Map<string, string>();

  const storage: LocalStorageLike = {
    clear() {
      memoryStorage.clear();
    },
    getItem(key: string) {
      return memoryStorage.has(key) ? memoryStorage.get(key) ?? null : null;
    },
    key(index: number) {
      return Array.from(memoryStorage.keys())[index] ?? null;
    },
    removeItem(key: string) {
      memoryStorage.delete(key);
    },
    setItem(key: string, value: string) {
      memoryStorage.set(key, value);
    },
    get length() {
      return memoryStorage.size;
    }
  };

  globalWithStorage.localStorage = storage;
}
