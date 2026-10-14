import { describe, expect, test } from "bun:test";
import sharp from "sharp";

import { readUploadedImage, type UploadLimits } from "./image.server";

const LIMITS: UploadLimits = { maxBytes: 64 * 1024, maxDimension: 64, output: { width: 16, height: 16 } };

function formWith(value: string | File | null): FormData {
  const form = new FormData();

  if (value !== null) {
    form.set("image", value);
  }

  return form;
}

async function png(width: number, height: number): Promise<File> {
  const bytes = await sharp({ create: { width, height, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } })
    .png()
    .toBuffer();

  return new File([new Uint8Array(bytes)], "x.png", { type: "image/png" });
}

describe("readUploadedImage", () => {
  test("campo ausente, texto ou arquivo vazio = missing", async () => {
    for (const value of [null, "", "não é arquivo", new File([], "vazio.png")]) {
      expect(await readUploadedImage(formWith(value), "image", LIMITS)).toEqual({ ok: false, status: 400, reason: "missing" });
    }
  });

  test("bytes que não são imagem = unsupported", async () => {
    const result = await readUploadedImage(formWith(new File(["oi"], "x.png")), "image", LIMITS);

    expect(result).toEqual({ ok: false, status: 415, reason: "unsupported" });
  });

  test("grande demais em pixels = dimensions", async () => {
    expect(await readUploadedImage(formWith(await png(65, 10)), "image", LIMITS)).toEqual({ ok: false, status: 400, reason: "dimensions" });
  });

  test("imagem válida sai como WebP", async () => {
    const result = await readUploadedImage(formWith(await png(32, 32)), "image", LIMITS);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.type : null).toBe("image/webp");
  });
});
