import { Star } from "lucide-react";
import { useFetcher } from "react-router";

import { HOME_ACTION } from "~/features/prompts/list-query";
import type { PromptIntent } from "~/features/prompts/prompt-rules";
import type { Prompt } from "~/features/prompts/types";

const FAVORITE: PromptIntent = "favorite";

// Chave do fetcher por prompt (o aviso de erro é da página: useFavoriteErrors).
export const FAVORITE_FETCHER_PREFIX = "favorite-";

// Mesmo fetcher (key por prompt) no card e no diálogo: a estrela muda na hora nos dois.
export function useFavorite(prompt: Prompt) {
  const fetcher = useFetcher({ key: `${FAVORITE_FETCHER_PREFIX}${prompt.id}` });
  const pending = fetcher.formData?.get("value");
  const isFavorite = pending === "1" || (pending !== "0" && prompt.isFavorite);

  const toggle = () => {
    void fetcher.submit({ intent: FAVORITE, id: prompt.id, value: isFavorite ? "0" : "1" }, { method: "post", action: HOME_ACTION });
  };

  return { isFavorite, toggle };
}

type FavoriteButtonProps = {
  prompt: Prompt;
  className: string;
  iconClassName: string;
  showLabel?: boolean;
};

export function FavoriteButton({ prompt, className, iconClassName, showLabel = false }: FavoriteButtonProps) {
  const { isFavorite, toggle } = useFavorite(prompt);
  // Rótulo fixo + aria-pressed: o leitor de tela diz "Favorito, pressionado" (trocar o
  // rótulo junto viraria "Remover dos favoritos, pressionado").
  const title = isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos";

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      aria-label={showLabel ? undefined : "Favorito"}
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        toggle();
      }}
      className={className}
    >
      <Star className={iconClassName} fill={isFavorite ? "currentColor" : "none"} aria-hidden />
      {showLabel ? (isFavorite ? "Favorito" : "Favoritar") : null}
    </button>
  );
}
