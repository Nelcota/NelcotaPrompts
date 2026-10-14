import { useRouteLoaderData } from "react-router";

import { Mascot } from "~/shared/ui/mascot";
import { cn } from "~/shared/ui/cn";

type BrandUrls = { logoUrl: string | null; faviconUrl: string | null };

function readBrandUrls(value: unknown): BrandUrls {
  if (typeof value !== "object" || value === null) {
    return { logoUrl: null, faviconUrl: null };
  }

  return {
    logoUrl: "logoUrl" in value && typeof value.logoUrl === "string" ? value.logoUrl : null,
    faviconUrl: "faviconUrl" in value && typeof value.faviconUrl === "string" ? value.faviconUrl : null,
  };
}

// URL da logo enviada pelo painel admin (vem do root loader); null = logo padrão.
export function useLogoUrl(): string | null {
  return readBrandUrls(useRouteLoaderData("root")).logoUrl;
}

// URL do favicon enviado pelo painel admin; null = favicon padrão (mascote).
export function useFaviconUrl(): string | null {
  return readBrandUrls(useRouteLoaderData("root")).faviconUrl;
}

type BrandLogoProps = {
  className?: string;
  // Força uma imagem (ex.: prévia no painel antes de salvar).
  src?: string | null;
};

// Logo da navbar e das telas de login: a enviada pelo painel admin ou, sem ela, o mascote.
// A logo personalizada mantém a proporção (quadrada ou horizontal) dentro da altura dada.
export function BrandLogo({ className = "h-8 sm:h-10", src }: BrandLogoProps) {
  const logoUrl = useLogoUrl();
  const url = src ?? logoUrl;

  if (url === null) {
    return <Mascot pose="badge" size={80} className={cn("aspect-square w-auto shrink-0 rounded-full", className)} />;
  }

  return (
    <img
      src={url}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      className={cn("w-auto max-w-40 shrink-0 object-contain select-none", className)}
    />
  );
}

// Logo + "Nelcota Prompts". Quem usa decide o tamanho do texto e se é link.
export function BrandWordmark({ logoClassName, src, hideTextOnMobile = false }: { logoClassName?: string; src?: string | null; hideTextOnMobile?: boolean }) {
  return (
    <>
      <BrandLogo className={logoClassName} src={src} />
      <span className={hideTextOnMobile ? "hidden truncate sm:inline" : "truncate"}>
        Nelcota <span className="text-muted">Prompts</span>
      </span>
    </>
  );
}
