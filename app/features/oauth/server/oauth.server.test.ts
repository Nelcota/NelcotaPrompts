import { createHash } from "node:crypto";

import { describe, expect, test } from "bun:test";

import { isAllowedRedirectUri, pkceMatches, redirectBack } from "./oauth.server";

describe("OAuth", () => {
  test("endereços de retorno: https, loopback e esquema de app", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:8765/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:33418/")).toBe(true);
    expect(isAllowedRedirectUri("cursor://anysphere.cursor-retrieval/oauth/callback")).toBe(true);
  });

  test("recusa http de fora, esquemas perigosos e fragmento", () => {
    expect(isAllowedRedirectUri("http://evil.com/cb")).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false);
    expect(isAllowedRedirectUri("data:text/html,oi")).toBe(false);
    expect(isAllowedRedirectUri("https://app.com/cb#x")).toBe(false);
    expect(isAllowedRedirectUri("não é url")).toBe(false);
  });

  test("PKCE S256", () => {
    const verifier = "a".repeat(43);
    const challenge = createHash("sha256").update(verifier).digest("base64url");

    expect(pkceMatches(verifier, challenge)).toBe(true);
    expect(pkceMatches(`${verifier}b`, challenge)).toBe(false);
    expect(pkceMatches("curto", createHash("sha256").update("curto").digest("base64url"))).toBe(false);
  });

  test("volta ao app com o resultado e o state, mantendo a query original", () => {
    const url = new URL(redirectBack("http://localhost:1/cb?x=1", { code: "abc" }, "s t"));

    expect(url.searchParams.get("x")).toBe("1");
    expect(url.searchParams.get("code")).toBe("abc");
    expect(url.searchParams.get("state")).toBe("s t");
  });
});
