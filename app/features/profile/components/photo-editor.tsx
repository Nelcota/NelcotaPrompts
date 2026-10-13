import { FlipHorizontal2, RotateCcw, RotateCw, Undo2 } from "lucide-react";

import type { Adjustments, Crop } from "~/features/profile/avatar-image";
import { AdjustmentControls } from "~/features/profile/components/photo-editor/adjustment-controls";
import { AvatarPreviews } from "~/features/profile/components/photo-editor/avatar-previews";
import { CropViewport } from "~/features/profile/components/photo-editor/crop-viewport";
import { buttonClass, iconButtonClass } from "~/shared/ui/styles";

type PhotoEditorProps = {
  // Imagem já girada/espelhada.
  image: HTMLCanvasElement;
  // Troca = a área de corte recomeça do recorte atual (foto nova, girar, redefinir).
  version: number;
  crop: Crop;
  adjustments: Adjustments;
  onCropChange: (crop: Crop) => void;
  onAdjustmentsChange: (adjustments: Adjustments) => void;
  onRotate: (direction: -1 | 1) => void;
  onFlip: () => void;
  onReset: () => void;
};

const ICON_BUTTON = iconButtonClass({ size: "sm" });

// Editor da foto de perfil: enquadramento à esquerda; cores e prévias à direita.
export function PhotoEditor({ image, version, crop, adjustments, onCropChange, onAdjustmentsChange, onRotate, onFlip, onReset }: PhotoEditorProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
      <div>
        <CropViewport key={version} image={image} crop={crop} adjustments={adjustments} onCropChange={onCropChange} />
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <button type="button" onClick={() => onRotate(-1)} title="Girar para a esquerda" aria-label="Girar para a esquerda" className={ICON_BUTTON}>
              <RotateCcw className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={() => onRotate(1)} title="Girar para a direita" aria-label="Girar para a direita" className={ICON_BUTTON}>
              <RotateCw className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={onFlip} title="Espelhar" aria-label="Espelhar" className={ICON_BUTTON}>
              <FlipHorizontal2 className="size-4" aria-hidden />
            </button>
          </div>
          <button type="button" onClick={onReset} className={buttonClass("ghost", "sm")}>
            <Undo2 className="size-3.5" aria-hidden />
            Redefinir
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <AdjustmentControls adjustments={adjustments} onChange={onAdjustmentsChange} />
        <AvatarPreviews image={image} crop={crop} adjustments={adjustments} />
      </div>
    </div>
  );
}
