import { describe, expect, test } from "bun:test";

import { homeHref, MAX_LIMIT, PAGE_SIZE, parseHomeQuery } from "./list-query";

const parse = (search: string) => parseHomeQuery(new URL(`https://x/${search}`));

describe("parseHomeQuery", () => {
  test("URL sem parâmetros: tudo no padrão", () => {
    expect(parse("")).toEqual({
      search: null,
      tag: null,
      authorId: null,
      favorites: false,
      sort: "recent",
      view: null,
      limit: null,
      openId: null,
      hasOpenParam: false,
    });
  });

  test("parâmetros vazios ou só espaços valem como ausentes", () => {
    const query = parse("?q=%20&tag=&autor=&p=");

    expect(query.search).toBeNull();
    expect(query.tag).toBeNull();
    expect(query.authorId).toBeNull();
    expect(query.openId).toBeNull();
    // ?p= vazio ainda conta como link (aviso de "não existe mais").
    expect(query.hasOpenParam).toBe(true);
  });

  test.each(["", "abc", "NaN", "Infinity", "-1", "0", "1.5", "60", String(PAGE_SIZE)])("limite %p volta para uma página", (value) => {
    expect(parse(`?limite=${value}`).limit).toBeNull();
  });

  test("limite acima do máximo é cortado", () => {
    expect(parse("?limite=999999").limit).toBe(MAX_LIMIT);
    expect(parse(`?limite=${PAGE_SIZE * 2}`).limit).toBe(PAGE_SIZE * 2);
  });

  test("valores literais \"null\"/\"undefined\" no autor não viram filtro", () => {
    expect(parse("?autor=null").authorId).toBeNull();
    expect(parse("?autor=undefined").authorId).toBeNull();
  });
});

describe("homeHref", () => {
  test("consulta padrão vira /", () => {
    const { openId: _openId, hasOpenParam: _hasOpenParam, ...query } = parse("");

    expect(homeHref(query)).toBe("/");
  });
});
