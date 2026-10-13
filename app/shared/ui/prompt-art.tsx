import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";

// Arte abstrata determinística por prompt: manchas de cor distorcidas por turbulência,
// no espírito das imagens fluidas (tinta, mármore, lava) da referência.
const PALETTES = [
  ["#120302", "#ff3d00", "#ff8a00", "#a10f00", "#ffd2a1", "#3b0500"],
  ["#d9d4c9", "#c99a1a", "#6f7a80", "#f6f2ea", "#2f2f2b", "#e2b84a"],
  ["#06121a", "#0fa3b1", "#d9822b", "#2b4a6f", "#f4c095", "#0b3b4f"],
  ["#2a0e2e", "#e85d9e", "#b9a3e3", "#f6c1d6", "#5b2a86", "#ff8fb1"],
  ["#030303", "#7cff4f", "#ffe066", "#1e3d2f", "#eef2e6", "#2be0a8"],
  ["#020b1f", "#1e6bff", "#00d1c1", "#0a2f6b", "#c6f1ff", "#5b8cff"],
  ["#160f05", "#ffb100", "#e83f6f", "#2d1e2f", "#fff1c1", "#ff6a3d"],
  ["#0b150e", "#8bc34a", "#e0d7b0", "#2f5d50", "#c46b3e", "#1d3b2a"],
] as const;

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandom(seed: number) {
  let state = seed;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

type ArtBlob = { cx: number; cy: number; rx: number; ry: number; fill: string; opacity: number };

function buildArt(seed: string) {
  const hash = hashSeed(seed);
  const random = createRandom(hash);
  const palette = PALETTES[hash % PALETTES.length] ?? PALETTES[0];
  const [base, ...colors] = palette;
  const blobs: ArtBlob[] = Array.from({ length: 9 }, (_, index) => ({
    cx: Math.round(random() * 300),
    cy: Math.round(random() * 420),
    rx: Math.round(40 + random() * 130),
    ry: Math.round(30 + random() * 110),
    fill: colors[index % colors.length] ?? base,
    opacity: 0.55 + random() * 0.45,
  }));

  return {
    base,
    blobs,
    frequency: (0.003 + random() * 0.006).toFixed(4),
    displacement: Math.round(160 + random() * 180),
    turbulenceSeed: Math.round(random() * 1000),
  };
}

// SVG completo (com o grão já embutido) usado só como receita para gerar o bitmap.
function buildSvg(seed: string): string {
  const art = buildArt(seed);
  const ellipses = art.blobs
    .map(
      (blob) =>
        `<ellipse cx="${blob.cx}" cy="${blob.cy}" rx="${blob.rx}" ry="${blob.ry}" fill="${blob.fill}" opacity="${blob.opacity.toFixed(2)}"/>`,
    )
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420" width="300" height="420">`,
    `<defs>`,
    `<filter id="f" x="-20%" y="-20%" width="140%" height="140%">`,
    `<feGaussianBlur in="SourceGraphic" stdDeviation="14" result="soft"/>`,
    `<feTurbulence type="fractalNoise" baseFrequency="${art.frequency}" numOctaves="2" seed="${art.turbulenceSeed}" result="noise"/>`,
    `<feDisplacementMap in="soft" in2="noise" scale="${art.displacement}" xChannelSelector="R" yChannelSelector="G" result="fluid"/>`,
    `<feGaussianBlur in="fluid" stdDeviation="1.5"/>`,
    `</filter>`,
    `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>`,
    `<feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="0.14"/></feComponentTransfer></filter>`,
    `</defs>`,
    `<rect width="300" height="420" fill="${art.base}"/>`,
    `<g filter="url(#f)"><rect x="-60" y="-60" width="420" height="540" fill="${art.base}"/>${ellipses}</g>`,
    `<rect width="300" height="420" filter="url(#g)"/>`,
    `</svg>`,
  ].join("");
}

export function liteBackground(seed: string): string {
  const art = buildArt(seed);
  const accent = art.blobs[0]?.fill ?? art.base;
  const second = art.blobs[1]?.fill ?? art.base;

  return `linear-gradient(160deg, ${accent}, ${art.base} 55%, ${second})`;
}

// --- Rasterização -------------------------------------------------------------
// Filtros SVG são caros e, no Firefox, são refeitos sempre que o card muda de escala
// ou ângulo (o coverflow faz isso a cada quadro). Por isso a arte é desenhada UMA vez
// num canvas e vira uma imagem comum; mover/girar um bitmap é barato em qualquer navegador.

const RASTER_SCALE = 1.5;
const RASTER_WIDTH = Math.round(300 * RASTER_SCALE);
const RASTER_HEIGHT = Math.round(420 * RASTER_SCALE);
// 1.75rem (28px) num card de ~300px de largura, proporcional ao tamanho do bitmap.
const CARD_RADIUS = RASTER_WIDTH * (28 / 300);

export type ArtVariant = "plain" | "card";
type ArtUrls = Record<ArtVariant, string>;

// Cache das imagens já desenhadas (blob: URLs), com limite: as menos usadas saem e têm a
// URL liberada. Quem já mostra uma imagem removida continua mostrando (já decodificada);
// ao remontar, o componente pede de novo.
const RASTER_CACHE_MAX = 240;
const rasterCache = new Map<string, ArtUrls>();

function cacheGet(seed: string): ArtUrls | undefined {
  const urls = rasterCache.get(seed);

  if (urls !== undefined) {
    // Map mantém a ordem de inserção: reinserir marca como usado agora.
    rasterCache.delete(seed);
    rasterCache.set(seed, urls);
  }

  return urls;
}

function cacheSet(seed: string, urls: ArtUrls) {
  rasterCache.set(seed, urls);

  for (const [oldest, old] of rasterCache) {
    if (rasterCache.size <= RASTER_CACHE_MAX) {
      break;
    }

    rasterCache.delete(oldest);
    URL.revokeObjectURL(old.plain);
    URL.revokeObjectURL(old.card);
  }
}
const rasterFailed = new Set<string>();
const rasterQueue: { seed: string; resolve: (urls: ArtUrls | null) => void }[] = [];
let rasterRunning = false;

function waitForIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => resolve(), { timeout: 200 });

      return;
    }

    window.setTimeout(resolve, 16);
  });
}

async function canvasToUrl(canvas: HTMLCanvasElement): Promise<string | null> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));

  if (blob === null) {
    return null;
  }

  return URL.createObjectURL(blob);
}

function createCanvas(): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null {
  const canvas = document.createElement("canvas");
  canvas.width = RASTER_WIDTH;
  canvas.height = RASTER_HEIGHT;

  const context = canvas.getContext("2d");

  if (context === null) {
    return null;
  }

  return { canvas, context };
}

// Versão do card: cantos arredondados (transparentes) e o escurecimento para leitura já
// desenhados no bitmap, para o card não precisar de border-radius nem de camadas extras.
function drawCardVersion(source: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  context.beginPath();
  context.roundRect(0, 0, RASTER_WIDTH, RASTER_HEIGHT, CARD_RADIUS);
  context.clip();
  context.drawImage(source, 0, 0);

  const overlay = context.createLinearGradient(0, 0, 0, RASTER_HEIGHT);
  overlay.addColorStop(0, "rgb(0 0 0 / 0.3)");
  overlay.addColorStop(0.5, "rgb(0 0 0 / 0.05)");
  overlay.addColorStop(1, "rgb(0 0 0 / 0.85)");
  context.fillStyle = overlay;
  context.fillRect(0, 0, RASTER_WIDTH, RASTER_HEIGHT);
}

async function rasterize(seed: string): Promise<ArtUrls | null> {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildSvg(seed))}`;
  await image.decode();

  const plain = createCanvas();
  const card = createCanvas();

  if (plain === null || card === null) {
    return null;
  }

  plain.context.drawImage(image, 0, 0, RASTER_WIDTH, RASTER_HEIGHT);
  drawCardVersion(plain.canvas, card.context);

  const [plainUrl, cardUrl] = await Promise.all([canvasToUrl(plain.canvas), canvasToUrl(card.canvas)]);

  if (plainUrl === null || cardUrl === null) {
    return null;
  }

  return { plain: plainUrl, card: cardUrl };
}

// Uma arte por vez, esperando o navegador ficar ocioso entre elas, para não travar o scroll.
async function drainQueue() {
  if (rasterRunning) {
    return;
  }

  rasterRunning = true;

  while (rasterQueue.length > 0) {
    const job = rasterQueue.shift();

    if (job === undefined) {
      break;
    }

    const cached = cacheGet(job.seed);

    if (cached !== undefined) {
      job.resolve(cached);
      continue;
    }

    await waitForIdle();

    try {
      const urls = await rasterize(job.seed);

      if (urls === null) {
        rasterFailed.add(job.seed);
        job.resolve(null);
        continue;
      }

      cacheSet(job.seed, urls);
      job.resolve(urls);
    } catch {
      rasterFailed.add(job.seed);
      job.resolve(null);
    }
  }

  rasterRunning = false;
}

function requestRaster(seed: string): Promise<ArtUrls | null> {
  const cached = cacheGet(seed);

  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

  if (rasterFailed.has(seed)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    rasterQueue.push({ seed, resolve });
    void drainQueue();
  });
}

// Pede o bitmap quando o elemento chega perto da área visível. Com enabled=false
// (slides distantes, quase invisíveis) nem pede, e fica só o gradiente leve.
export function useArtImage<T extends HTMLElement>(seed: string, enabled: boolean, variant: ArtVariant) {
  const key = `${seed}:${variant}`;
  // A URL vem sempre do cache: se ele liberou a imagem (passou do limite), src volta a null
  // e o efeito pede de novo, em vez de reaproveitar uma URL já revogada. O estado só
  // serve para re-renderizar quando a imagem fica pronta.
  const [, setLoaded] = useState<string | null>(null);
  const src = rasterCache.get(seed)?.[variant] ?? null;
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;

    if (!enabled || src !== null || element === null) {
      return;
    }

    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);

        if (!visible) {
          return;
        }

        observer.disconnect();
        void requestRaster(seed).then((urls) => {
          if (!cancelled && urls !== null) {
            setLoaded(`${key}:${urls[variant]}`);
          }
        });
      },
      { rootMargin: "300px" },
    );

    observer.observe(element);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [seed, enabled, src, variant, key]);

  return { ref, src: enabled ? src : null };
}

type PromptArtProps = {
  seed: string;
  animated?: boolean;
};

// Versão em bloco (diálogo e tela de login), fora do coverflow 3D.
export function PromptArt({ seed, animated = false }: PromptArtProps) {
  const { ref, src } = useArtImage<HTMLDivElement>(seed, true, "plain");

  return (
    <div ref={ref} aria-hidden className="absolute inset-0 overflow-hidden" style={{ background: liteBackground(seed) }}>
      {src === null ? null : (
        <img
          src={src}
          alt=""
          draggable={false}
          className={cn("absolute inset-0 size-full object-cover", animated ? "art-breathe" : "")}
        />
      )}
    </div>
  );
}
