import { describe, expect, test } from "bun:test";

import { applyAdjustments, clampCrop, isFiniteCrop, MAX_ZOOM, MIN_ZOOM, NEUTRAL } from "./avatar-image";

// clampCrop só lê largura e altura.
const image = { width: 400, height: 200 } as HTMLCanvasElement;

describe("isFiniteCrop", () => {
  test.each([
    ["zoom Infinity (área com largura 0)", { centerX: 1, centerY: 1, zoom: Number.POSITIVE_INFINITY }],
    ["zoom NaN", { centerX: 1, centerY: 1, zoom: Number.NaN }],
    ["zoom 0", { centerX: 1, centerY: 1, zoom: 0 }],
    ["zoom negativo", { centerX: 1, centerY: 1, zoom: -1 }],
    ["centro NaN", { centerX: Number.NaN, centerY: 1, zoom: 1 }],
    ["centro -Infinity", { centerX: 1, centerY: Number.NEGATIVE_INFINITY, zoom: 1 }],
  ])("%s é recusado", (_label, crop) => {
    expect(isFiniteCrop(crop)).toBe(false);
  });

  test("recorte normal é aceito (inclusive centro em 0 e -0)", () => {
    expect(isFiniteCrop({ centerX: 0, centerY: -0, zoom: 1 })).toBe(true);
  });
});

describe("clampCrop", () => {
  test("zoom fora da faixa é limitado", () => {
    expect(clampCrop(image, { centerX: 200, centerY: 100, zoom: 100 }).zoom).toBe(MAX_ZOOM);
    expect(clampCrop(image, { centerX: 200, centerY: 100, zoom: 0.1 }).zoom).toBe(MIN_ZOOM);
  });

  test("centro fora da imagem volta para dentro", () => {
    expect(clampCrop(image, { centerX: -50, centerY: 999, zoom: 1 })).toEqual({ zoom: 1, centerX: 100, centerY: 100 });
  });
});

describe("applyAdjustments", () => {
  test("neutro não mexe nos pixels; lista vazia não quebra", () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255]);

    applyAdjustments(data, NEUTRAL);
    expect([...data]).toEqual([10, 20, 30, 255]);
    applyAdjustments(new Uint8ClampedArray(), { ...NEUTRAL, brightness: 50 });
  });
});
