import { describe, expect, test } from "bun:test";

import { loginHref, readRedirectParam, safeRedirectPath } from "./login-redirect";

describe("voltar depois do login", () => {
  test("só caminhos do próprio site", () => {
    expect(safeRedirectPath("/oauth/autorizar?x=1")).toBe("/oauth/autorizar?x=1");
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("/\\evil.com")).toBe("/");
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath(null)).toBe("/");
  });

  test("ida e volta pela URL", () => {
    const href = loginHref("/oauth/autorizar?a=1&b=2");

    expect(readRedirectParam(new URL(href, "http://x"))).toBe("/oauth/autorizar?a=1&b=2");
  });
});
