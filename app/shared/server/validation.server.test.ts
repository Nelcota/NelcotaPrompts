import { describe, expect, test } from "bun:test";

import { parseUuid } from "~/shared/lib/ids";
import { declaredTooLarge, readForm, readSearch, readText, readUuid } from "./validation.server";

const UUID = "0b8f2a3c-1d4e-4f5a-9b6c-7d8e9f0a1b2c";

function formWith(entries: Record<string, string | File>): FormData {
  const form = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    form.set(key, value);
  }

  return form;
}

describe("readText", () => {
  test("ausente, vazio, só espaços ou arquivo viram null", () => {
    const form = formWith({ empty: "", spaces: " \t\n ", file: new File(["x"], "x.txt") });

    expect(readText(form, "missing")).toBeNull();
    expect(readText(form, "empty")).toBeNull();
    expect(readText(form, "spaces")).toBeNull();
    expect(readText(form, "file")).toBeNull();
  });

  test("texto sai sem espaços nas pontas; \"0\" e \"false\" continuam texto", () => {
    const form = formWith({ a: "  x  ", zero: "0", no: "false" });

    expect(readText(form, "a")).toBe("x");
    expect(readText(form, "zero")).toBe("0");
    expect(readText(form, "no")).toBe("false");
  });
});

describe("readUuid / parseUuid", () => {
  test("null, undefined, vazio e lixo viram null", () => {
    for (const value of [null, undefined, "", "   ", "null", "undefined", "123", `${UUID}x`]) {
      expect(parseUuid(value)).toBeNull();
    }
  });

  test("normaliza espaços e maiúsculas", () => {
    expect(parseUuid(`  ${UUID.toUpperCase()} `)).toBe(UUID);
    expect(readUuid(formWith({ id: UUID }), "id")).toBe(UUID);
    expect(readUuid(formWith({}), "id")).toBeNull();
    expect(readUuid(formWith({ id: new File([UUID], "id.txt") }), "id")).toBeNull();
  });
});

describe("readSearch", () => {
  test("ausente, vazio ou só espaços viram null", () => {
    expect(readSearch(new URL("https://x/"), 10)).toBeNull();
    expect(readSearch(new URL("https://x/?q="), 10)).toBeNull();
    expect(readSearch(new URL("https://x/?q=%20%20"), 10)).toBeNull();
  });

  test("corta no máximo", () => {
    expect(readSearch(new URL("https://x/?q=abcdef"), 3)).toBe("abc");
  });
});

describe("declaredTooLarge", () => {
  const request = (length: string | null) => new Request("https://x/", { method: "POST", headers: length === null ? {} : { "content-length": length } });

  test("sem cabeçalho, vazio ou inválido não recusa (o limite do corpo decide)", () => {
    expect(declaredTooLarge(request(null), 10)).toBe(false);
    expect(declaredTooLarge(request(""), 10)).toBe(false);
    expect(declaredTooLarge(request("abc"), 10)).toBe(false);
  });

  test("acima do limite recusa", () => {
    expect(declaredTooLarge(request("11"), 10)).toBe(true);
    expect(declaredTooLarge(request("10"), 10)).toBe(false);
  });
});

describe("readForm", () => {
  test("corpo que não é formulário vira null", async () => {
    const request = new Request("https://x/", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });

    expect(await readForm(request)).toBeNull();
  });
});
