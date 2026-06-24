import { createClient, type Client } from "@libsql/client/web";

export interface Env {
  TURSO_URL: string;
  TURSO_AUTH_TOKEN: string;
  APP_TOKEN: string;
  ASSETS: Fetcher;
}

let cached: { url: string; client: Client } | null = null;

export function getClient(env: Env): Client {
  if (cached && cached.url === env.TURSO_URL) return cached.client;
  cached = {
    url: env.TURSO_URL,
    client: createClient({ url: env.TURSO_URL, authToken: env.TURSO_AUTH_TOKEN }),
  };
  return cached.client;
}
