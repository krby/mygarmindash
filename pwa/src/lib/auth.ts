import { get, set, del } from "idb-keyval";

const KEY = "mygarmindash.app-token";

export const getToken = (): Promise<string | undefined> => get<string>(KEY);
export const setToken = (token: string): Promise<void> => set(KEY, token);
export const clearToken = (): Promise<void> => del(KEY);
