import { AVATAR_SIZE, MAX_SOURCE_BYTES } from "./avatar-rules";

// Edição da foto de perfil no navegador: abrir, enquadrar (zoom, arrastar, girar,
// espelhar), ajustar cores e gerar o arquivo final de 256x256 já em círculo.

// Fotos de celular passam fácil de 4000 px; o editor trabalha com uma cópia menor
// (sobra resolução para o zoom máximo sobre um avatar de 256 px).
const WORKING_MAX = 2048;

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;

export type Adjustments = {
  // -100 a 100; 0 = sem mudança.
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
};

export const NEUTRAL: Adjustments = { brightness: 0, contrast: 0, saturation: 0, temperature: 0 };

export const PRESETS: { id: string; label: string; adjustments: Adjustments }[] = [
  { id: "original", label: "Original", adjustments: NEUTRAL },
  { id: "vivid", label: "Vívido", adjustments: { brightness: 4, contrast: 18, saturation: 35, temperature: 0 } },
  { id: "warm", label: "Quente", adjustments: { brightness: 4, contrast: 6, saturation: 10, temperature: 35 } },
  { id: "cool", label: "Frio", adjustments: { brightness: 0, contrast: 8, saturation: -5, temperature: -35 } },
  { id: "mono", label: "P&B", adjustments: { brightness: 0, contrast: 20, saturation: -100, temperature: 0 } },
  { id: "fade", label: "Suave", adjustments: { brightness: 8, contrast: -25, saturation: -20, temperature: 8 } },
];

// Enquadramento sobre a imagem já girada/espelhada: centro do recorte (em px da imagem)
// e zoom (1 = o maior quadrado que cabe).
export type Crop = { centerX: number; centerY: number; zoom: number };

export type Orientation = { rotation: 0 | 90 | 180 | 270; flipped: boolean };

export type SourceResult = { ok: true; source: HTMLCanvasElement } | { ok: false; message: string };

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  return canvas;
}

// Abre o arquivo e devolve uma cópia de trabalho (no máximo 2048 px no lado maior).
export async function loadSource(file: File): Promise<SourceResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, message: "Escolha um arquivo de imagem." };
  }

  if (file.size === 0) {
    return { ok: false, message: "O arquivo está vazio." };
  }

  if (file.size > MAX_SOURCE_BYTES) {
    return { ok: false, message: "Essa imagem é grande demais (máximo 25 MB)." };
  }

  let bitmap: ImageBitmap;

  try {
    // createImageBitmap respeita a orientação EXIF (foto de celular não sai deitada).
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, message: "Não consegui abrir essa imagem. Tente JPG, PNG ou WebP." };
  }

  if (bitmap.width === 0 || bitmap.height === 0) {
    bitmap.close();

    return { ok: false, message: "Essa imagem não tem conteúdo." };
  }

  const scale = Math.min(1, WORKING_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = createCanvas(bitmap.width * scale, bitmap.height * scale);
  const context = canvas.getContext("2d");

  if (context === null) {
    bitmap.close();

    return { ok: false, message: "Seu navegador não conseguiu processar a imagem." };
  }

  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return { ok: true, source: canvas };
}

// Aplica rotação e espelhamento numa cópia (o recorte trabalha sempre "em pé").
export function orient(source: HTMLCanvasElement, { rotation, flipped }: Orientation): HTMLCanvasElement {
  if (rotation === 0 && !flipped) {
    return source;
  }

  const sideways = rotation === 90 || rotation === 270;
  const canvas = createCanvas(sideways ? source.height : source.width, sideways ? source.width : source.height);
  const context = canvas.getContext("2d");

  if (context === null) {
    return source;
  }

  // Espelha depois de girar: o espelho é sempre na horizontal da tela.
  context.translate(canvas.width / 2, canvas.height / 2);

  if (flipped) {
    context.scale(-1, 1);
  }

  context.rotate((rotation * Math.PI) / 180);

  context.drawImage(source, -source.width / 2, -source.height / 2);

  return canvas;
}

export function cropSide(image: HTMLCanvasElement, zoom: number): number {
  return Math.min(image.width, image.height) / zoom;
}

// Mantém o quadrado do recorte inteiro dentro da imagem.
export function clampCrop(image: HTMLCanvasElement, crop: Crop): Crop {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, crop.zoom));
  const half = cropSide(image, zoom) / 2;

  return {
    zoom,
    centerX: Math.min(image.width - half, Math.max(half, crop.centerX)),
    centerY: Math.min(image.height - half, Math.max(half, crop.centerY)),
  };
}

export function centeredCrop(image: HTMLCanvasElement): Crop {
  return { centerX: image.width / 2, centerY: image.height / 2, zoom: 1 };
}

const clampByte = (value: number) => (value < 0 ? 0 : value > 255 ? 255 : value);

// Mesmo cálculo na prévia e no arquivo final: o que se vê é o que é salvo.
export function applyAdjustments(data: Uint8ClampedArray, { brightness, contrast, saturation, temperature }: Adjustments) {
  if (brightness === 0 && contrast === 0 && saturation === 0 && temperature === 0) {
    return;
  }

  const light = 1 + brightness / 100;
  const contrastFactor = 1 + contrast / 100;
  const saturationFactor = 1 + saturation / 100;
  // Temperatura: puxa vermelho e azul em sentidos opostos (até ±40 níveis).
  const warm = (temperature / 100) * 40;

  for (let index = 0; index < data.length; index += 4) {
    let red = (data[index] ?? 0) * light;
    let green = (data[index + 1] ?? 0) * light;
    let blue = (data[index + 2] ?? 0) * light;

    red = (red - 128) * contrastFactor + 128;
    green = (green - 128) * contrastFactor + 128;
    blue = (blue - 128) * contrastFactor + 128;

    const gray = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    red = gray + (red - gray) * saturationFactor + warm;
    green = gray + (green - gray) * saturationFactor;
    blue = gray + (blue - gray) * saturationFactor - warm;

    data[index] = clampByte(red);
    data[index + 1] = clampByte(green);
    data[index + 2] = clampByte(blue);
  }
}

// Desenha o recorte num canvas quadrado do tamanho dado, já com os ajustes.
export function renderCrop(target: HTMLCanvasElement, image: HTMLCanvasElement, crop: Crop, adjustments: Adjustments) {
  const context = target.getContext("2d", { willReadFrequently: true });

  if (context === null) {
    return;
  }

  const side = cropSide(image, crop.zoom);
  context.clearRect(0, 0, target.width, target.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, crop.centerX - side / 2, crop.centerY - side / 2, side, side, 0, 0, target.width, target.height);

  const pixels = context.getImageData(0, 0, target.width, target.height);
  applyAdjustments(pixels.data, adjustments);
  context.putImageData(pixels, 0, 0);
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// Arquivo final: 256x256 com cantos transparentes (círculo). Assim nenhum lugar do app
// precisa de border-radius na foto (o que pesaria no Firefox dentro do coverflow 3D).
export async function renderAvatar(image: HTMLCanvasElement, crop: Crop, adjustments: Adjustments): Promise<Blob | null> {
  const canvas = createCanvas(AVATAR_SIZE, AVATAR_SIZE);
  renderCrop(canvas, image, crop, adjustments);

  const context = canvas.getContext("2d");

  if (context === null) {
    return null;
  }

  context.globalCompositeOperation = "destination-in";
  context.beginPath();
  context.arc(AVATAR_SIZE / 2, AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
  context.fill();

  // WebP mantém a transparência com arquivo pequeno; navegadores sem encoder WebP
  // devolvem PNG, que o servidor também aceita.
  return toBlob(canvas, "image/webp", 0.9);
}
