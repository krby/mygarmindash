import { describe, it, expect } from "vitest";
import { authorized } from "../src/auth";
import type { Env } from "../src/db";

const env = { APP_TOKEN: "s3cr3t-token" } as Env;

const req = (authHeader?: string): Request =>
  new Request("https://example.com/api/today", {
    headers: authHeader ? { authorization: authHeader } : {},
  });

describe("authorized (mirrors the live 401 checks)", () => {
  it("accepts an exact Bearer match", () => {
    expect(authorized(req("Bearer s3cr3t-token"), env)).toBe(true);
  });

  it("rejects a missing Authorization header", () => {
    expect(authorized(req(), env)).toBe(false);
  });

  it("rejects a header without the 'Bearer ' prefix", () => {
    expect(authorized(req("s3cr3t-token"), env)).toBe(false);
    expect(authorized(req("Basic s3cr3t-token"), env)).toBe(false);
  });

  it("rejects a wrong token of the same length", () => {
    // "wr0ng-tokenx" is the same length as "s3cr3t-token" (12 chars).
    expect(authorized(req("Bearer wr0ng-tokenx"), env)).toBe(false);
  });

  it("rejects a token of a different length", () => {
    expect(authorized(req("Bearer short"), env)).toBe(false);
    expect(authorized(req("Bearer s3cr3t-token-extra"), env)).toBe(false);
  });

  it("rejects everything when APP_TOKEN is unset", () => {
    expect(authorized(req("Bearer anything"), {} as Env)).toBe(false);
  });
});
