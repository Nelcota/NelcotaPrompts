// Regras da logo e do favicon compartilhadas entre o painel (navegador) e o servidor.
export const BRAND_ASSETS = ["logo", "favicon"] as const;

export type BrandAsset = (typeof BRAND_ASSETS)[number];

export const MAX_BRAND_IMAGE_BYTES = 1024 * 1024;
export const MAX_BRAND_IMAGE_DIMENSION = 2048;
