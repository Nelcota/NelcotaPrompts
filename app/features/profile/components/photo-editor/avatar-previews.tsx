import { useRef } from "react";

import type { Adjustments, Crop } from "~/features/profile/avatar-image";
import { labelClass } from "~/shared/ui/styles";
import { useCanvasRender } from "./use-canvas-render";
import { cn } from "~/shared/ui/cn";

const PREVIEW_PIXELS = 96;

// A foto nos tamanhos em que aparece no app: grande, menu (40 px) e cards (24 px).
export function AvatarPreviews({ image, crop, adjustments }: { image: HTMLCanvasElement; crop: Crop; adjustments: Adjustments }) {
  const largeRef = useRef<HTMLCanvasElement>(null);
  const menuRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLCanvasElement>(null);

  useCanvasRender(largeRef, image, crop, adjustments, [menuRef, cardRef]);

  return (
    <>
      <p className={cn(labelClass, "mt-5")}>Como fica</p>
      <div className="mt-2 flex items-end gap-4">
        <canvas ref={largeRef} width={PREVIEW_PIXELS} height={PREVIEW_PIXELS} className="size-16 rounded-full" />
        <canvas ref={menuRef} width={PREVIEW_PIXELS} height={PREVIEW_PIXELS} className="size-10 rounded-full" />
        <canvas ref={cardRef} width={PREVIEW_PIXELS} height={PREVIEW_PIXELS} className="size-6 rounded-full" />
      </div>
    </>
  );
}
