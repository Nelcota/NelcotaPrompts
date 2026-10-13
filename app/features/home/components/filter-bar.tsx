import { X } from "lucide-react";
import { Link } from "react-router";

import { clearedHomeQuery, filterHref, type HomeQuery, homeHref } from "~/features/prompts/list-query";
import { plural } from "~/shared/lib/format";

type FilterBarProps = {
  query: HomeQuery;
  author: { id: string; name: string } | null;
  total: number;
  filtered: boolean;
};

const chip =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm font-medium text-muted transition hover:text-ink aria-[current=true]:border-ink aria-[current=true]:bg-ink aria-[current=true]:text-canvas";

function resultLabel(total: number): string {
  return total === 0 ? "Nenhum resultado" : plural(total, "resultado", "resultados");
}

export function FilterBar({ query, author, total, filtered }: FilterBarProps) {
  const clearedQuery = clearedHomeQuery(query);

  return (
    <div className="relative mx-auto mt-6 flex w-full max-w-5xl flex-col items-center gap-3 px-4 short:sm:mt-3 short:sm:gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div role="group" aria-label="Visualização" className="flex shrink-0 rounded-full border border-line p-0.5">
          <Link
            to={homeHref({ ...query, view: null })}
            preventScrollReset
            aria-current={query.view === null}
            className="rounded-full px-3 py-1 text-sm font-medium text-muted transition hover:text-ink aria-[current=true]:bg-ink aria-[current=true]:text-canvas"
          >
            Slider
          </Link>
          <Link
            to={homeHref({ ...query, view: "grid" })}
            preventScrollReset
            aria-current={query.view === "grid"}
            className="rounded-full px-3 py-1 text-sm font-medium text-muted transition hover:text-ink aria-[current=true]:bg-ink aria-[current=true]:text-canvas"
          >
            Grade
          </Link>
        </div>

        {author === null ? null : (
          <Link to={filterHref(query, { authorId: null })} aria-current className={chip} aria-label={`Remover filtro: prompts de ${author.name}`}>
            Prompts de {author.name}
            <X className="size-4" aria-hidden />
          </Link>
        )}
      </div>

      {filtered ? (
        <p className="text-sm text-muted" aria-live="polite">
          {resultLabel(total)}
          {query.search === null ? "" : ` para “${query.search}”`}
          {" · "}
          <Link to={homeHref(clearedQuery)} className="font-medium text-ink underline-offset-4 hover:underline">
            Limpar filtros
          </Link>
        </p>
      ) : null}
    </div>
  );
}
