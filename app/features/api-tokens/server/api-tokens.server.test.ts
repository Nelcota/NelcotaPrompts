import { describe, expect, test } from "bun:test";

import { hashApiToken, isApiTokenFormat, readBearerToken } from "./api-tokens.server";

const TOKEN = `nlc_${"a".repeat(43)}`;

const withAuth = (value: string) => new Request("http://x/mcp", { headers: { Authorization: value } });

describe("tokens de API", () => {
  test("formato: prefixo nlc_ e 43 caracteres base64url", () => {
    expect(isApiTokenFormat(TOKEN)).toBe(true);
    expect(isApiTokenFormat(TOKEN.slice(0, -1))).toBe(false);
    expect(isApiTokenFormat(`xyz_${"a".repeat(43)}`)).toBe(false);
  });

  test("o hash é estável e não contém o token", () => {
    expect(hashApiToken(TOKEN)).toBe(hashApiToken(TOKEN));
    expect(hashApiToken(TOKEN)).not.toContain(TOKEN);
  });

  test("lê o token do cabeçalho Bearer", () => {
    expect(readBearerToken(withAuth(`Bearer ${TOKEN}`))).toBe(TOKEN);
    expect(readBearerToken(withAuth(`bearer  ${TOKEN} `))).toBe(TOKEN);
    expect(readBearerToken(withAuth(`Basic ${TOKEN}`))).toBeNull();
    expect(readBearerToken(new Request("http://x/mcp"))).toBeNull();
  });
});
