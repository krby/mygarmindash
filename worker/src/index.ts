import { authorized } from "./auth";
import { getClient, type Env } from "./db";
import * as q from "./queries";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

const json = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers ?? {}) },
  });

const err = (status: number, message: string): Response =>
  json({ error: message }, { status });

async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  if (!authorized(req, env)) return err(401, "unauthorized");
  const client = getClient(env);
  const path = url.pathname;

  try {
    if (path === "/api/strength/last") {
      const data = await q.lastStrength(client);
      return json(data);
    }
    if (path === "/api/exercise-sets") {
      return json(await q.exerciseSets(client));
    }
    if (path === "/api/activities") {
      const days = q.clampDays(url.searchParams.get("days"));
      const type = url.searchParams.get("type");
      return json(await q.activities(client, days, type));
    }
    const actMatch = path.match(/^\/api\/activities\/([A-Za-z0-9_-]+)$/);
    if (actMatch) {
      const data = await q.activityDetail(client, actMatch[1]!);
      return data ? json(data) : err(404, "not found");
    }
    if (path === "/api/stats") {
      return json(await q.stats(client));
    }
    return err(404, "not found");
  } catch (e) {
    console.error("api error", path, e);
    return err(500, e instanceof Error ? e.message : "internal error");
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(req, env, url);
    }
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
