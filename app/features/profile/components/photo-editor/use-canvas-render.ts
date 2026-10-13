import { type RefObject, useEffect } from "react";

import { type Adjustments, type Crop, renderCrop } from "~/features/profile/avatar-image";

type CanvasRef = RefObject<HTMLCanvasElement | null>;

// Desenha o recorte no próximo quadro (vários eventos de arrastar no mesmo quadro viram
// um desenho). As cópias recebem o mesmo resultado em tamanhos menores (menu, cards).
export function useCanvasRender(canvasRef: CanvasRef, image: HTMLCanvasElement, crop: Crop, adjustments: Adjustments, copies: readonly CanvasRef[] = []) {
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const canvas = canvasRef.current;

      if (canvas === null) {
        return;
      }

      renderCrop(canvas, image, crop, adjustments);

      for (const copy of copies) {
        const target = copy.current;
        const context = target?.getContext("2d") ?? null;

        if (target === null || context === null) {
          continue;
        }

        context.clearRect(0, 0, target.width, target.height);
        context.imageSmoothingQuality = "high";
        context.drawImage(canvas, 0, 0, target.width, target.height);
      }
    });

    return () => window.cancelAnimationFrame(frame);
    // As cópias são refs estáveis de quem chama; não precisam disparar o efeito.
  }, [canvasRef, image, crop, adjustments]);
}
