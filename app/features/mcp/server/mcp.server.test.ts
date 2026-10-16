import { describe, expect, test } from "bun:test";

import { slugify } from "~/shared/lib/slug";

import { mcpPromptName } from "./mcp.server";

describe("nome dos prompts no MCP", () => {
  test("tira acento, pontuação e caixa", () => {
    expect(slugify("Revisão de código (TS)!")).toBe("revisao-de-codigo-ts");
  });

  test("título sem letras vira 'prompt'", () => {
    expect(slugify("🚀 !!")).toBe("prompt");
  });

  test("corta títulos longos sem hífen no fim", () => {
    const slug = slugify("a ".repeat(60));

    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });

  test("o começo do id desempata títulos iguais", () => {
    const a = mcpPromptName({ id: "11111111-0000-0000-0000-000000000000", title: "Commit" });
    const b = mcpPromptName({ id: "22222222-0000-0000-0000-000000000000", title: "Commit" });

    expect(a).toBe("commit-11111111");
    expect(a).not.toBe(b);
  });
});
