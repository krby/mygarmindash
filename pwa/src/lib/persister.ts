import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";

// TanStack persistQueryClient + IndexedDB-backed async storage.
// Survives reloads and PWA reinstalls.
const storage = {
  getItem: (key: string) => get<string>(key).then((v) => v ?? null),
  setItem: (key: string, value: string) => set(key, value),
  removeItem: (key: string) => del(key),
};

export const persister = createAsyncStoragePersister({
  storage,
  key: "mygarmindash.query-cache",
  throttleTime: 1000,
});
