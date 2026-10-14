import { useState } from "react";
import { cn } from "./cn";

type AvatarProps = {
  name: string;
  url: string | null;
  // Tamanho, usado pela foto e pelas iniciais.
  sizeClassName: string;
  // Fundo e texto das iniciais; não vai para a <img>, senão apareceria atrás dos cantos.
  fallbackClassName: string;
};

// Primeiro caractere como a pessoa vê (grafema): charAt(0) cortaria um emoji ou uma letra
// com acento combinado no meio e mostraria um caractere quebrado.
const graphemes = new Intl.Segmenter("pt-BR", { granularity: "grapheme" });

function firstGrapheme(text: string): string {
  return graphemes.segment(text)[Symbol.iterator]().next().value?.segment ?? "";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => part !== "");
  const first = parts[0];

  if (first === undefined) {
    return "?";
  }

  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;

  return `${firstGrapheme(first)}${last === undefined ? "" : firstGrapheme(last)}`.toUpperCase();
}

// A foto já chega redonda (cantos transparentes), então a <img> não usa border-radius.
// Sem foto, ou se ela falhar ao carregar, mostra as iniciais.
export function Avatar({ name, url, sizeClassName, fallbackClassName }: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (url === null || failedUrl === url) {
    return (
      <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full font-semibold", sizeClassName, fallbackClassName)}>
        {initials(name)}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      aria-hidden
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => setFailedUrl(url)}
      className={cn("shrink-0 object-cover", sizeClassName)}
    />
  );
}
