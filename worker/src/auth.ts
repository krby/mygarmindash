import type { Env } from "./db";

/**
 * Bearer-token auth. Returns true only for an exact, constant-time match against
 * `env.APP_TOKEN`. Extracted from the request handler so it can be unit-tested
 * in isolation (see tests/auth.test.ts).
 */
export function authorized(req: Request, env: Env): boolean {
  const h = req.headers.get("authorization");
  if (!h || !h.startsWith("Bearer ")) return false;
  const presented = h.slice(7).trim();
  const expected = env.APP_TOKEN;
  if (!expected || presented.length !== expected.length) return false;
  // Constant-time compare.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
