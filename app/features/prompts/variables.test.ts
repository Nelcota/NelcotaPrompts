import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { extractVariableSpecs, fillVariables, hasVariables, ownValue, readRememberedValues, rememberValues, splitVariables } from "./variables";

describe("extractVariableSpecs", () => {
  test("texto vazio ou sem variáveis não tem specs", () => {
    expect(extractVariableSpecs("")).toEqual([]);
    expect(extractVariableSpecs("   \n\t")).toEqual([]);
    expect(extractVariableSpecs("sem chaves aqui")).toEqual([]);
    expect(hasVariables("")).toBe(false);
  });

  test("chaves vazias ou só com espaços não são variáveis", () => {
    expect(extractVariableSpecs("{} { } {   }")).toEqual([]);
  });

  test("padrão vazio ou só com espaços vira null", () => {
    expect(extractVariableSpecs("{tema=}{idioma=   }")).toEqual([
      { name: "tema", defaultValue: null },
      { name: "idioma", defaultValue: null },
    ]);
  });

  test("o primeiro padrão preenchido vale", () => {
    expect(extractVariableSpecs("{x} {x=a} {x=b}")).toEqual([{ name: "x", defaultValue: "a" }]);
  });
});

describe("ownValue e fillVariables com nomes do Object.prototype", () => {
  test("ownValue ignora o que vem do protótipo", () => {
    expect(ownValue({}, "constructor")).toBeUndefined();
    expect(ownValue({}, "toString")).toBeUndefined();
    expect(ownValue({}, "__proto__")).toBeUndefined();
    expect(ownValue({ constructor: "x" }, "constructor")).toBe("x");
  });

  test("{constructor} sem valor fica como está (antes lançava TypeError)", () => {
    expect(fillVariables("new {constructor}() e {toString}", {})).toBe("new {constructor}() e {toString}");
  });

  test("{constructor} com valor é preenchido", () => {
    expect(fillVariables("new {constructor}()", Object.fromEntries([["constructor", "Foo"]]))).toBe("new Foo()");
  });

  test("{__proto__} sem valor fica como está", () => {
    expect(fillVariables("{__proto__}", {})).toBe("{__proto__}");
  });
});

describe("fillVariables", () => {
  test("valor vazio ou só espaços usa o padrão; sem padrão mantém o trecho", () => {
    expect(fillVariables("{a=1} {b}", { a: "", b: "   " })).toBe("1 {b}");
  });

  test("valor preenchido substitui todas as ocorrências", () => {
    expect(fillVariables("{a} e {a=z}", { a: "x" })).toBe("x e x");
  });

  test("corpo vazio continua vazio", () => {
    expect(fillVariables("", { a: "x" })).toBe("");
  });
});

describe("splitVariables", () => {
  test("texto vazio não gera partes", () => {
    expect(splitVariables("")).toEqual([]);
  });

  test("só variável", () => {
    expect(splitVariables("{a}")).toEqual([{ kind: "variable", value: "{a}" }]);
  });
});

describe("valores lembrados (localStorage)", () => {
  const store = new Map<string, string>();
  const original = globalThis.window;

  beforeEach(() => {
    store.clear();
    // Só o que storage.ts usa.
    globalThis.window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    } as unknown as Window & typeof globalThis;
  });

  afterEach(() => {
    globalThis.window = original;
  });

  test("nada salvo, JSON inválido, null ou valores não-texto viram {}", () => {
    expect(readRememberedValues()).toEqual({});

    store.set("nelcota:variables", "{quebrado");
    expect(readRememberedValues()).toEqual({});

    store.set("nelcota:variables", "null");
    expect(readRememberedValues()).toEqual({});

    store.set("nelcota:variables", JSON.stringify({ a: 1, b: null, c: "ok" }));
    expect(readRememberedValues()).toEqual({ c: "ok" });
  });

  test("valores vazios não são lembrados", () => {
    rememberValues({ a: "", b: "  " });
    expect(store.has("nelcota:variables")).toBe(false);
  });

  test("toString salvo antes não é descartado por existir no protótipo", () => {
    store.set("nelcota:variables", JSON.stringify({ toString: "antigo" }));
    rememberValues({ outra: "x" });
    expect(readRememberedValues()).toEqual({ toString: "antigo", outra: "x" });
  });
});
