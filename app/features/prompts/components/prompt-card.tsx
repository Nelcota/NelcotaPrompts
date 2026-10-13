import { memo } from "react";
import { Link } from "react-router";

import { filterHref } from "~/features/prompts/list-query";
import type { Prompt } from "~/features/prompts/types";
import { Avatar } from "~/shared/ui/avatar";
import { CopyButton } from "./copy-button";
import { FavoriteButton } from "./favorite-button";
import { InlineCodeText, MarkdownPreview } from "./markdown-body";
import { useHomeQuery } from "./prompt-actions";
import { liteBackground, useArtImage } from "~/shared/ui/prompt-art";
import { cn } from "~/shared/ui/cn";

type PromptCardProps = {
  prompt: Prompt;
  active: boolean;
  lite?: boolean;
  onOpen: (prompt: Prompt) => void;
};

// Anel de foco só para teclado (no mouse não aparece). É box-shadow, mas só existe
// enquanto o elemento tem foco, então não pesa no scroll.
const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-white/80";

// Escurece o topo (tags) e a base (título) para o texto branco ter contraste sobre a arte.
const READABILITY_OVERLAY = "linear-gradient(to bottom, rgb(0 0 0 / 0.3), rgb(0 0 0 / 0.05) 50%, rgb(0 0 0 / 0.85))";

// Performance (medida no Firefox, onde travava): dentro do giro 3D do coverflow, todo
// recorte arredondado (border-radius, overflow: hidden), box-shadow, border e
// backdrop-filter do card é refeito a cada quadro. Por isso, quando o bitmap fica pronto,
// ele já traz os cantos arredondados e o escurecimento, e o card não tem nada disso.
// Até lá (e no HTML do servidor) vale o gradiente leve com cantos arredondados via CSS.
export const PromptCard = memo(function PromptCard({ prompt, active, lite = false, onOpen }: PromptCardProps) {
  const query = useHomeQuery();
  const { ref, src } = useArtImage<HTMLElement>(prompt.id, !lite, "card");
  const style =
    src === null
      ? { backgroundImage: `${READABILITY_OVERLAY}, ${liteBackground(prompt.id)}`, borderRadius: "1.75rem" }
      : { backgroundImage: `url("${src}")`, backgroundSize: "100% 100%" };

  return (
    <article
      ref={ref}
      data-active={active}
      style={style}
      className="group relative isolate flex h-full w-full flex-col text-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-4 -bottom-7 -z-10 h-10 bg-[radial-gradient(closest-side,rgb(0_0_0/0.45),transparent)] opacity-0 transition-opacity group-data-[active=true]:opacity-100"
      />
      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-2 p-4">
        <ul className="flex min-w-0 flex-wrap gap-1.5">
          {prompt.tags.slice(0, 3).map((tag) => (
            <li key={tag} className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[13px] font-medium">
              #{tag}
            </li>
          ))}
        </ul>
        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
          <FavoriteButton
            prompt={prompt}
            className={cn("grid size-8 place-items-center rounded-full border border-white/15 bg-black/30 transition hover:bg-white hover:text-black aria-pressed:text-amber-300", FOCUS_RING)}
            iconClassName="size-4"
          />
          <CopyButton
            prompt={prompt}
            label="Copiar"
            className={cn("flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-sm font-medium transition hover:bg-white hover:text-black data-[copied=true]:bg-white data-[copied=true]:text-black", FOCUS_RING)}
            iconClassName="size-3.5"
          />
        </div>
      </div>
      {/* O ::after cobre o card inteiro: clicar na arte também abre. Tags, botões e autor
          ficam por cima (z-10). */}
      <div className="mt-auto flex flex-col items-center px-5 pb-3 text-center">
        <h3 className="font-display text-[1.9rem] leading-[1.08] font-light text-balance [text-shadow:0_1px_12px_rgb(0_0_0/0.35)]">
          <button
            type="button"
            onClick={() => onOpen(prompt)}
            className={cn("rounded-xl text-balance after:absolute after:inset-0 after:cursor-pointer", FOCUS_RING)}
          >
            <InlineCodeText text={prompt.title} codeClassName="rounded-lg bg-white/15 px-1.5 font-mono text-[0.8em]" />
          </button>
        </h3>
        <MarkdownPreview
          text={prompt.excerpt}
          className="mt-3 line-clamp-3 font-mono text-[13px] leading-relaxed text-white/70 transition-opacity group-data-[active=false]:opacity-0"
        />
      </div>
      <Link
        to={filterHref(query, { authorId: prompt.authorId })}
        title={`Ver prompts de ${prompt.authorName}`}
        onClick={(event) => event.stopPropagation()}
        className={cn("relative z-10 mx-auto mb-5 flex items-center gap-2 rounded-full px-2 py-1 text-[13px] text-white/80 transition-opacity hover:text-white group-data-[active=false]:pointer-events-none group-data-[active=false]:opacity-0", FOCUS_RING)}
      >
        <Avatar
          name={prompt.authorName}
          url={prompt.authorAvatarUrl}
          sizeClassName="size-6"
          fallbackClassName="bg-white/20 text-[11px]"
        />
        {prompt.authorName}
      </Link>
    </article>
  );
});
