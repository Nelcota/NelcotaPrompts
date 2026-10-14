import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MarkdownBody, MarkdownPreview } from "./markdown-body";

const html = (text: string) => renderToStaticMarkup(<MarkdownBody text={text} />);

describe("MarkdownBody", () => {
  test("texto vazio não quebra", () => {
    expect(html("")).toContain("<div");
    expect(renderToStaticMarkup(<MarkdownPreview text="" />)).toContain("<div");
  });

  test("variável com sintaxe Markdown volta inteira dentro de <mark>", () => {
    const out = html("Use {x=**y**} aqui");

    expect(out).toContain(">{x=**y**}</mark>");
    expect(out).not.toContain("<strong>");
  });

  test("caracteres de uso privado digitados pela pessoa não somem", () => {
    const typed = "a  b  c";

    expect(html(typed)).toContain(typed);
    expect(html(typed)).not.toContain("<mark");
  });

  test("mais de 6.143 variáveis: todas voltam (antes a faixa de marcadores estourava)", () => {
    const count = 7000;
    const out = html(Array.from({ length: count }, (_, index) => `{v${index}}`).join(" "));

    expect(out.match(/<mark/g)?.length).toBe(count);
    expect(out).toContain(">{v6999}</mark>");
  });

  test("variável dentro de bloco de código e de link", () => {
    const out = html("```bash\necho {nome}\n```\n\n[site]({pagina}) e [outro]({url=https://x.com})");

    expect(out).toContain(">{nome}</mark>");
    expect(out).toContain('href="{pagina}"');
    expect(out).not.toContain('href=""');
  });

  test("link sem endereço ou com javascript: vira texto, não href vazio", () => {
    for (const source of ["[a](javascript:alert(1))", "[a]()", "[a](<>)"]) {
      const out = html(source);

      expect(out).not.toContain("href=");
      expect(out).toContain(">a</span>");
    }
  });
});
