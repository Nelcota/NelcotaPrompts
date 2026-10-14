import { useState } from "react";

import { type Adjustments, centeredCrop, clampCrop, type Crop, isFiniteCrop, NEUTRAL, type Orientation, orient } from "~/features/profile/avatar-image";

const UPRIGHT: Orientation = { rotation: 0, flipped: false };

type Editing = {
  // Muda a cada foto nova, giro, espelho ou "Redefinir": a área de corte recomeça daí.
  version: number;
  // Cópia de trabalho original e a mesma já girada/espelhada (o que aparece na tela).
  source: HTMLCanvasElement;
  orientation: Orientation;
  image: HTMLCanvasElement;
  crop: Crop;
};

type CenterMap = (x: number, y: number, width: number, height: number) => [number, number];

// Estado da foto em edição: enquadramento, orientação e ajustes de cor.
export function usePhotoEdit() {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustments>(NEUTRAL);

  const load = (source: HTMLCanvasElement) => {
    setEditing((current) => ({ version: (current?.version ?? 0) + 1, source, orientation: UPRIGHT, image: source, crop: centeredCrop(source) }));
    setAdjustments(NEUTRAL);
  };

  // Girar e espelhar agem sobre o que está na tela e levam o enquadramento junto: o
  // centro do recorte é transformado como a imagem (o zoom não muda). orient roda uma
  // vez por mudança e o resultado fica guardado.
  const reorient = (next: (orientation: Orientation) => Orientation, mapCenter: CenterMap) =>
    setEditing((current) => {
      if (current === null) {
        return null;
      }

      const orientation = next(current.orientation);
      const image = orient(current.source, orientation);
      const [centerX, centerY] = mapCenter(current.crop.centerX, current.crop.centerY, current.image.width, current.image.height);

      return { ...current, version: current.version + 1, orientation, image, crop: clampCrop(image, { centerX, centerY, zoom: current.crop.zoom }) };
    });

  // Com a foto espelhada, girar "para a direita" na tela é girar a original para o outro lado.
  const rotate = (direction: -1 | 1) =>
    reorient(
      (orientation) => {
        const step = orientation.flipped ? -direction : direction;
        const rotation = (((orientation.rotation + step * 90) % 360) + 360) % 360;

        return { ...orientation, rotation: rotation as Orientation["rotation"] };
      },
      (x, y, width, height) => (direction === 1 ? [height - y, x] : [y, width - x]),
    );

  const flip = () => reorient((orientation) => ({ ...orientation, flipped: !orientation.flipped }), (x, y, width) => [width - x, y]);

  // A área do react-easy-crop pode chegar com largura 0 (zoom Infinity) ou NaN antes da
  // imagem medir: um recorte assim geraria uma foto vazia. Fica o recorte anterior.
  const setCrop = (crop: Crop) =>
    setEditing((current) => {
      if (current === null) {
        return null;
      }

      if (!isFiniteCrop(crop)) {
        return current;
      }

      return { ...current, crop: clampCrop(current.image, crop) };
    });

  const reset = () => {
    if (editing !== null) {
      load(editing.source);
    }
  };

  return {
    image: editing?.image ?? null,
    version: editing?.version ?? 0,
    crop: editing?.crop ?? null,
    adjustments,
    load,
    clear: () => setEditing(null),
    setCrop,
    setAdjustments,
    rotate,
    flip,
    reset,
  };
}
