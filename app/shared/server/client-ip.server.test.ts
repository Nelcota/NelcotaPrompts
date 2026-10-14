import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { getClientIp, trustsCloudflare } from "./client-ip.server";

const CLOUDFLARE_IP = "173.245.48.1";

function request(headers: Record<string, string>): Request {
  return new Request("https://x/", { headers });
}

describe("trustsCloudflare", () => {
  test("ausente ou vazio: não confia, sem aviso", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});

    expect(trustsCloudflare(undefined)).toBe(false);
    expect(trustsCloudflare("")).toBe(false);
    expect(trustsCloudflare("   ")).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test("aceita maiúsculas e espaços", () => {
    expect(trustsCloudflare("cloudflare")).toBe(true);
    expect(trustsCloudflare(" Cloudflare ")).toBe(true);
  });

  test("valor desconhecido não confia e avisa no log", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});

    expect(trustsCloudflare("cloudfare")).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("getClientIp", () => {
  const original = process.env.TRUSTED_PROXY;

  afterEach(() => {
    process.env.TRUSTED_PROXY = original;
  });

  test("sem IP do socket e sem cabeçalho: \"desconhecido\"", () => {
    expect(getClientIp(request({}), undefined)).toBe("desconhecido");
    expect(getClientIp(request({}), { clientIp: "" })).toBe("desconhecido");
    expect(getClientIp(request({ "x-forwarded-for": " , ," }), {})).toBe("desconhecido");
  });

  test("conexão direta (IP público) ignora cabeçalhos forjados", () => {
    expect(getClientIp(request({ "x-forwarded-for": "1.1.1.1" }), { clientIp: "8.8.8.8" })).toBe("8.8.8.8");
  });

  test("atrás do proxy interno usa o último X-Forwarded-For; vazio cai no socket", () => {
    expect(getClientIp(request({ "x-forwarded-for": "9.9.9.9, 5.5.5.5" }), { clientIp: "10.0.0.2" })).toBe("5.5.5.5");
    expect(getClientIp(request({ "x-forwarded-for": "" }), { clientIp: "10.0.0.2" })).toBe("10.0.0.2");
  });

  test("Cloudflare: CF-Connecting-IP vazio é ignorado; valor com maiúsculas no TRUSTED_PROXY vale", () => {
    process.env.TRUSTED_PROXY = "CloudFlare";

    expect(getClientIp(request({ "x-forwarded-for": CLOUDFLARE_IP, "cf-connecting-ip": "  " }), { clientIp: "10.0.0.2" })).toBe(CLOUDFLARE_IP);
    expect(getClientIp(request({ "x-forwarded-for": CLOUDFLARE_IP, "cf-connecting-ip": "7.7.7.7" }), { clientIp: "10.0.0.2" })).toBe("7.7.7.7");
  });
});

describe("getClientIp sem IP do socket em produção", () => {
  const original = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  test("não confia no X-Forwarded-For (forjável) e avisa", () => {
    process.env.NODE_ENV = "production";
    const warn = spyOn(console, "warn").mockImplementation(() => {});

    expect(getClientIp(request({ "x-forwarded-for": "1.2.3.4" }), {})).toBe("desconhecido");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
