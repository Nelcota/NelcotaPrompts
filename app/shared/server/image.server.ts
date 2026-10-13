import sharp, { type Metadata } from "sharp";

// Imagens enviadas (foto de perfil, logo) são decodificadas e geradas de novo com sharp:
// o arquivo salvo nunca é o enviado. Isso descarta metadados (EXIF/GPS) e qualquer coisa
// escondida no arquivo (ex.: um "poliglota" que é imagem e script ao mesmo tempo).
// Só JPEG, PNG e WebP entram; SVG fica de fora porque pode carregar script.

export type ImageType = "image/webp";

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type UploadLimits = {
  // Arquivo enviado.
  maxBytes: number;
  // Lado maior da imagem enviada (protege contra "bombas" de pixels).
  maxDimension: number;
  // Tamanho máximo da imagem salva (reduz mantendo a proporção; nunca amplia).
  output: { width: number; height: number };
};

export type UploadedImage =
  | { ok: true; type: ImageType; bytes: Uint8Array }
  | { ok: false; status: number; reason: "missing" | "too_large" | "unsupported" | "dimensions" | "corrupt" };

export async function readUploadedImage(form: FormData, field: string, limits: UploadLimits): Promise<UploadedImage> {
  const file = form.get(field);

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, status: 400, reason: "missing" };
  }

  if (file.size > limits.maxBytes) {
    return { ok: false, status: 413, reason: "too_large" };
  }

  const input = new Uint8Array(await file.arrayBuffer());
  // limitInputPixels: recusa antes de decodificar uma imagem gigante.
  const options = { limitInputPixels: limits.maxDimension * limits.maxDimension, failOn: "error" } as const;
  let metadata: Metadata;

  try {
    metadata = await sharp(input, options).metadata();
  } catch {
    return { ok: false, status: 415, reason: "unsupported" };
  }

  if (!ACCEPTED_FORMATS.has(metadata.format)) {
    return { ok: false, status: 415, reason: "unsupported" };
  }

  if ((metadata.width ?? 0) > limits.maxDimension || (metadata.height ?? 0) > limits.maxDimension) {
    return { ok: false, status: 400, reason: "dimensions" };
  }

  try {
    const output = await sharp(input, options)
      // Aplica a orientação do EXIF antes de descartá-lo (foto de celular não fica deitada).
      .autoOrient()
      .resize({ width: limits.output.width, height: limits.output.height, fit: "inside", withoutEnlargement: true })
      // WebP mantém a transparência (foto em círculo, logo sem fundo) com arquivo pequeno.
      .webp({ quality: 90, alphaQuality: 100 })
      .toBuffer();

    return { ok: true, type: "image/webp", bytes: new Uint8Array(output) };
  } catch {
    return { ok: false, status: 415, reason: "corrupt" };
  }
}
