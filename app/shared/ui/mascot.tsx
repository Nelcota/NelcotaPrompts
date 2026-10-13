import badgeUrl from "~/assets/mascot/badge.webp";
import standingUrl from "~/assets/mascot/standing.webp";
import wavingUrl from "~/assets/mascot/waving.webp";

export type MascotPose = "badge" | "standing" | "waving";

const SOURCES: Record<MascotPose, string> = { badge: badgeUrl, standing: standingUrl, waving: wavingUrl };

type MascotProps = {
  pose: MascotPose;
  // Tamanho intrínseco (px); o tamanho exibido vem de className.
  size: number;
  className?: string;
};

// Sempre decorativo: o texto ao redor já diz o que importa.
export function Mascot({ pose, size, className }: MascotProps) {
  return (
    <img
      src={SOURCES[pose]}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      className={className === undefined ? "select-none" : `select-none ${className}`}
    />
  );
}
