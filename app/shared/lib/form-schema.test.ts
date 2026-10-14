import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { loginSchema, registerSchema, changePasswordSchema, resetPasswordSchema } from "~/features/auth/account-rules";
import { promptInputSchema } from "~/features/prompts/prompt-rules";
import { inviteCodeSchema } from "~/features/admin/admin-rules";
import { formToObject, hasVisibleText, parseWithSchema, requiredText, secret } from "./form-schema";

const MESSAGE = "obrigatório";
const schema = z.object({ field: requiredText(MESSAGE) });

describe("requiredText", () => {
  test.each([
    ["ausente", {}],
    ["null", { field: null }],
    ["undefined", { field: undefined }],
    ["número", { field: 0 }],
    ["vazio", { field: "" }],
    ["só espaços", { field: "   " }],
    ["tabs e quebras", { field: "\t\n\r" }],
    ["NBSP", { field: " " }],
    ["BOM", { field: "﻿" }],
    ["zero-width space", { field: "​" }],
    ["zero-width joiner + marcas de direção", { field: "‍‎‏" }],
    ["invisíveis misturados com espaço", { field: " ​ ⁠ " }],
  ])("%s é recusado com a mensagem do campo", (_label, input) => {
    expect(parseWithSchema(schema, input)).toEqual({ ok: false, errors: { field: MESSAGE } });
  });

  test("texto com conteúdo é aceito e sai sem espaços nas pontas", () => {
    expect(parseWithSchema(schema, { field: "  Ana  " })).toEqual({ ok: true, data: { field: "Ana" } });
  });

  test("valores literais como \"null\", \"0\" e \"-\" são texto de verdade", () => {
    for (const value of ["null", "undefined", "NaN", "0", "false", "-", "N/A"]) {
      expect(parseWithSchema(schema, { field: value })).toEqual({ ok: true, data: { field: value } });
    }
  });

  test("hasVisibleText", () => {
    expect(hasVisibleText("")).toBe(false);
    expect(hasVisibleText("​")).toBe(false);
    expect(hasVisibleText("a​")).toBe(true);
    expect(hasVisibleText("😀")).toBe(true);
  });
});

describe("secret", () => {
  const passwordSchema = z.object({ password: secret(MESSAGE) });

  test("vazio, ausente ou só espaços é recusado", () => {
    for (const input of [{}, { password: null }, { password: "" }, { password: "    " }]) {
      expect(parseWithSchema(passwordSchema, input).ok).toBe(false);
    }
  });

  test("espaços nas pontas fazem parte da senha", () => {
    expect(parseWithSchema(passwordSchema, { password: " a " })).toEqual({ ok: true, data: { password: " a " } });
  });
});

describe("formToObject", () => {
  test("arquivos ficam de fora e o formulário vazio vira {}", () => {
    const form = new FormData();
    expect(formToObject(form)).toEqual({});

    form.set("a", "");
    form.set("file", new File(["x"], "x.txt"));
    expect(formToObject(form)).toEqual({ a: "" });
  });
});

describe("schemas dos formulários", () => {
  test("prompt sem título, corpo ou com só invisíveis é recusado", () => {
    const result = parseWithSchema(promptInputSchema, { title: "​", body: " " });

    expect(result.ok).toBe(false);
    expect(result.ok ? null : Object.keys(result.errors).sort()).toEqual(["body", "title"]);
  });

  test("tags ausentes, vazias ou só vírgulas viram lista vazia", () => {
    for (const tags of [undefined, "", " , ,, "]) {
      const result = parseWithSchema(promptInputSchema, { title: "T", body: "B", tags });

      expect(result).toEqual({ ok: true, data: { title: "T", body: "B", tags: [] } });
    }
  });

  test("tags com null literal são recusadas (não viram lista vazia)", () => {
    expect(parseWithSchema(promptInputSchema, { title: "T", body: "B", tags: null }).ok).toBe(false);
  });

  test("login com email vazio ou ausente é recusado", () => {
    expect(parseWithSchema(loginSchema, { email: "", password: "x" }).ok).toBe(false);
    expect(parseWithSchema(loginSchema, { password: "x" }).ok).toBe(false);
  });

  test("cadastro: nome invisível recusado; convite ausente vira vazio", () => {
    const base = { email: "a@b.co", password: "12345678" };

    expect(parseWithSchema(registerSchema, { ...base, name: "​​" }).ok).toBe(false);
    expect(parseWithSchema(registerSchema, { ...base, name: "Ana" })).toEqual({ ok: true, data: { ...base, name: "Ana", invite: "" } });
  });

  test("troca de senha sem a atual é recusada", () => {
    expect(parseWithSchema(changePasswordSchema, { next: "12345678" }).ok).toBe(false);
  });

  test("redefinição sem token vira token vazio (recusado depois pelo formato)", () => {
    expect(parseWithSchema(resetPasswordSchema, { password: "12345678" })).toEqual({ ok: true, data: { token: "", password: "12345678" } });
  });

  test("código de convite vazio, curto ou com espaço é recusado", () => {
    for (const code of [undefined, "", "      ", "abc", "abc def"]) {
      expect(parseWithSchema(inviteCodeSchema, { code }).ok).toBe(false);
    }
  });
});
