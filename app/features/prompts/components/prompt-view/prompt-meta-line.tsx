import { Link } from "react-router";

import { filterHref } from "~/features/prompts/list-query";
import { formatDate } from "~/shared/lib/format";
import type { Prompt } from "~/features/prompts/types";
import { Avatar } from "~/shared/ui/avatar";
import { useHomeQuery } from "~/features/prompts/components/prompt-actions";

function copyCountLabel(count: number): string {
  if (count === 0) {
    return "Ainda não foi copiado";
  }

  return count === 1 ? "Copiado 1 vez" : `Copiado ${count.toLocaleString("pt-BR")} vezes`;
}

// Autor (link para os prompts dele), data, cópias e tags.
export function PromptMetaLine({ prompt }: { prompt: Prompt }) {
  const query = useHomeQuery();
  const date = formatDate(prompt.createdAt);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
      <Link
        to={filterHref(query, { authorId: prompt.authorId })}
        title={`Ver prompts de ${prompt.authorName}`}
        className="inline-flex items-center gap-2 rounded-full pr-1 font-medium text-ink/90 hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:outline-none"
      >
        <Avatar name={prompt.authorName} url={prompt.authorAvatarUrl} sizeClassName="size-6" fallbackClassName="bg-ink/10 text-[11px] text-ink" />
        {prompt.authorName}
      </Link>
      {date === "" ? null : (
        <>
          <span aria-hidden>·</span>
          <time dateTime={prompt.createdAt}>{date}</time>
        </>
      )}
      <span aria-hidden>·</span>
      <span>{copyCountLabel(prompt.copyCount)}</span>
      {prompt.tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
          {prompt.tags.map((tag) => (
            <li key={tag} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-xs">
              #{tag}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
