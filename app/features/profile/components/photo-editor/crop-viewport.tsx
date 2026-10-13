import { ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { type Adjustments, type Crop, MAX_ZOOM, MIN_ZOOM } from "~/features/profile/avatar-image";

type CropViewportProps = {
  image: HTMLCanvasElement;
  crop: Crop;
  adjustments: Adjustments;
  onCropChange: (crop: Crop) => void;
};

// URL temporária da imagem (já girada/espelhada) para o react-easy-crop mostrar.
function useCanvasUrl(canvas: HTMLCanvasElement): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let created: string | null = null;
    let cancelled = false;

    canvas.toBlob((blob) => {
      if (cancelled || blob === null) {
        return;
      }

      created = URL.createObjectURL(blob);
      setUrl(created);
    });

    return () => {
      cancelled = true;

      if (created !== null) {
        URL.revokeObjectURL(created);
      }
    };
  }, [canvas]);

  return url;
}

// Nosso recorte (centro + zoom) ↔ área em pixels do react-easy-crop.
function toArea(image: HTMLCanvasElement, crop: Crop): Area {
  const side = Math.min(image.width, image.height) / crop.zoom;

  return { x: crop.centerX - side / 2, y: crop.centerY - side / 2, width: side, height: side };
}

function fromArea(image: HTMLCanvasElement, area: Area): Crop {
  return { centerX: area.x + area.width / 2, centerY: area.y + area.height / 2, zoom: Math.min(image.width, image.height) / area.width };
}

// Aproximação dos ajustes com filtro CSS, só para o enquadramento (as prévias e o arquivo
// final usam o cálculo exato, pixel a pixel).
function previewFilter({ brightness, contrast, saturation, temperature }: Adjustments): string {
  const warm = temperature > 0 ? ` sepia(${temperature / 250})` : temperature < 0 ? ` hue-rotate(${temperature / 10}deg)` : "";

  return `brightness(${1 + brightness / 100}) contrast(${1 + contrast / 100}) saturate(${1 + saturation / 100})${warm}`;
}

// Enquadramento (react-easy-crop): arrastar, pinça, roda do mouse e setas; o círculo
// mostra o que fica. A barra de zoom fica embaixo.
export function CropViewport({ image, crop, adjustments, onCropChange }: CropViewportProps) {
  const url = useCanvasUrl(image);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(crop.zoom);

  return (
    <>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-canvas">
        {url === null ? null : (
          <Cropper
            // Imagem nova (outra foto, girar, espelhar) = recorte reposicionado pelo nosso estado.
            key={url}
            image={url}
            crop={position}
            zoom={zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            aspect={1}
            cropShape="round"
            showGrid
            initialCroppedAreaPixels={toArea(image, crop)}
            onCropChange={setPosition}
            onZoomChange={setZoom}
            // onCropAreaChange (e não onCropComplete): ao carregar, a biblioteca avisa uma vez
            // antes de aplicar initialCroppedAreaPixels e só onCropAreaChange avisa de novo
            // depois; com onCropComplete o recorte salvo ficaria o centralizado.
            onCropAreaChange={(_area, pixels) => onCropChange(fromArea(image, pixels))}
            style={{ mediaStyle: { filter: previewFilter(adjustments) } }}
            classes={{ cropAreaClassName: "!border-white/60 !shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]" }}
          />
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <ZoomOut className="size-4 shrink-0 text-muted" aria-hidden />
        <input
          type="range"
          min={MIN_ZOOM * 100}
          max={MAX_ZOOM * 100}
          value={Math.round(zoom * 100)}
          onChange={(event) => setZoom(Number(event.target.value) / 100)}
          aria-label="Zoom"
          className="w-full accent-ink"
        />
        <ZoomIn className="size-4 shrink-0 text-muted" aria-hidden />
      </div>
    </>
  );
}
