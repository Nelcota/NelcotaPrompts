import { describe, expect, test } from "bun:test";

import { readRequired } from "~/features/admin/server/admin-actions.server";
import { diffLines } from "~/features/prompts/diff";
import { initials } from "~/shared/ui/avatar";
import { formatDate, formatDateTime, plural } from "./format";
import { publicUrl, toOrigin } from "./public-url";

describe("readRequired (interruptor do convite)", () => {
  const form = (value: string | null) => {
    const data = new FormData();

    if (value !== null) {
      data.set("required", value);
    }

    return data;
  };

  test("só \"true\" e \"false\" valem", () => {
    expect(readRequired(form("true"))).toBe(true);
    expect(readRequired(form(" false "))).toBe(false);
  });

  test.each([null, "", "  ", "1", "0", "TRUE", "null", "undefined", "on"])("%p é inválido (não desliga o convite)", (value) => {
    expect(readRequired(form(value))).toBeNull();
  });
});

describe("format", () => {
  test("data vazia ou inválida vira texto vazio, não \"Invalid Date\"", () => {
    for (const value of ["", "lixo", "NaN"]) {
      expect(formatDate(value)).toBe("");
      expect(formatDateTime(value)).toBe("");
    }
  });

  test("plural com zero", () => {
    expect(plural(0, "prompt", "prompts")).toBe("0 prompts");
    expect(plural(1, "prompt", "prompts")).toBe("1 prompt");
  });
});

describe("public-url", () => {
  test("ausente, vazio, só espaços ou não-http vira null", () => {
    for (const value of [undefined, "", "   ", "nada", "ftp://x.com", "javascript:alert(1)"]) {
      expect(toOrigin(value)).toBeNull();
    }
  });

  test("APP_URL vazia cai no COOLIFY_URL; nenhum = null", () => {
    expect(publicUrl({ APP_URL: "", COOLIFY_URL: "https://a.com,https://b.com" })).toBe("https://a.com");
    expect(publicUrl({ APP_URL: " ", COOLIFY_URL: "" })).toBeNull();
    expect(publicUrl({})).toBeNull();
  });
});

describe("initials", () => {
  test("nome vazio ou só espaços vira ?", () => {
    expect(initials("")).toBe("?");
    expect(initials("  \t ")).toBe("?");
    expect(initials("ana maria souza")).toBe("AS");
  });
});

describe("diffLines", () => {
  test("dois textos vazios não têm linhas", () => {
    expect(diffLines("", "")).toEqual([]);
  });

  test("de vazio para texto: só adições", () => {
    expect(diffLines("", "a\nb").map((line) => line.kind)).toEqual(["added", "added"]);
  });
});

describe("initials com emoji e acentos combinados", () => {
  test("não corta o caractere no meio", () => {
    expect(initials("😀 Ana")).toBe("😀A");
    expect(initials("👩‍💻 dev")).toBe("👩‍💻D");
    expect(initials("élis")).toBe("É");
  });
});
