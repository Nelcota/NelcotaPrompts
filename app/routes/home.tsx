import { useCallback, useMemo, useRef, useState } from "react";
import { Link, type ShouldRevalidateFunctionArgs, useSearchParams } from "react-router";

import { AccountDialog } from "~/features/auth/components/account-dialog";
import { CommandPalette } from "~/features/home/components/command-palette";
import { EmptyState } from "~/features/home/components/empty-state";
import { FilterBar } from "~/features/home/components/filter-bar";
import { Navbar } from "~/features/home/components/navbar";
import { PromptActionsProvider } from "~/features/prompts/components/prompt-actions";
import { PromptCoverflow } from "~/features/prompts/components/prompt-coverflow";
import { type Editing, PromptFormDialog } from "~/features/prompts/components/prompt-form-dialog";
import { PromptGrid } from "~/features/prompts/components/prompt-grid";
import { PromptViewDialog } from "~/features/prompts/components/prompt-view-dialog";
import { ProfilePhotoDialog } from "~/features/profile/components/profile-photo-dialog";
import { VariablesDialog } from "~/features/prompts/components/variables-dialog";
import { useCopyFlow } from "~/features/prompts/hooks/use-copy-flow";
import { useHomeShortcuts } from "~/features/home/hooks/use-home-shortcuts";
import { useOpenPrompt } from "~/features/prompts/hooks/use-open-prompt";
import { usePaletteCommands } from "~/features/home/hooks/use-palette-commands";
import { useFavoriteErrors } from "~/features/prompts/hooks/use-favorite-errors";
import { useUndoDelete } from "~/features/prompts/hooks/use-undo-delete";
import { dispatchIntent } from "~/shared/server/intent-dispatch.server";
import { type HomeQuery, homeHref, isPresentationOnlyChange, MAX_LIMIT, PAGE_SIZE, parseHomeQuery } from "~/features/prompts/list-query";
import { PROMPT_HANDLERS } from "~/features/prompts/server/prompt-actions.server";
import type { PromptIntent } from "~/features/prompts/prompt-rules";
import { getPromptById, listPrompts } from "~/features/prompts/server/prompts.server";
import { requireUser } from "~/features/auth/server/session.server";
import { THEME_ACTION } from "~/features/theme/theme";
import type { Prompt } from "~/features/prompts/types";
import { findUserName } from "~/features/auth/server/users.server";
import type { Route } from "./+types/home";

export function meta() {
  return [
    { title: "Nelcota Prompts" },
    { name: "description", content: "Biblioteca de prompts de engenharia: code review, testes, debug, refactor." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, { returnHere: true });
  const { openId, hasOpenParam, ...parsed } = parseHomeQuery(new URL(request.url));
  // Autor inexistente (link antigo, conta removida): ignora o filtro em vez de mostrar
  // um mural vazio sem como limpar.
  const authorName = parsed.authorId === null ? null : await findUserName(parsed.authorId);
  const query: HomeQuery = { ...parsed, authorId: authorName === null ? null : parsed.authorId };
  const page = await listPrompts(
    user.id,
    { search: query.search, tag: query.tag, authorId: query.authorId, favoritesOnly: query.favorites, sort: query.sort },
    query.limit ?? PAGE_SIZE,
  );
  const openInPage = openId !== null && page.prompts.some((prompt) => prompt.id === openId);
  // Link direto para um prompt fora da página/filtro atual: busca ele à parte.
  const linkedPrompt = openId === null || openInPage ? null : await getPromptById(user.id, openId);

  return {
    user,
    prompts: page.prompts,
    total: page.total,
    query,
    author: query.authorId === null || authorName === null ? null : { id: query.authorId, name: authorName },
    linkedPrompt,
    linkMissing: hasOpenParam && !openInPage && linkedPrompt === null,
  };
}

const COPIED: PromptIntent = "copied";

// Tema, contagem de cópia, visualização (slider/grade) e o prompt aberto (?p) não mudam
// os dados da lista, então não recarregam.
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  formAction,
  formData,
  actionStatus,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  // 404 numa ação = o prompt sumiu (apagado em outra aba/por outra pessoa): recarrega a
  // lista para ele sair da tela. O padrão do React Router não revalida após erro 4xx.
  if (actionStatus === 404) {
    return true;
  }

  if (formAction === THEME_ACTION || formData?.get("intent") === COPIED) {
    return false;
  }

  if (formMethod !== undefined && formMethod !== "GET") {
    return defaultShouldRevalidate;
  }

  if (isPresentationOnlyChange(currentUrl, nextUrl)) {
    return false;
  }

  return defaultShouldRevalidate;
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);

  return dispatchIntent({ request, handlers: PROMPT_HANDLERS, context: user, label: "prompts" });
}

function editingKey(editing: Editing | null): string {
  if (editing === null) {
    return "closed";
  }

  return editing.mode === "create" ? "create" : `edit-${editing.prompt.id}`;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user, prompts, total, author, linkedPrompt, linkMissing } = loaderData;
  const [searchParams] = useSearchParams();
  // A visualização não recarrega dados (shouldRevalidate), então vem da URL atual.
  const view = searchParams.get("view") === "grid" ? "grid" : null;
  const query = useMemo<HomeQuery>(() => ({ ...loaderData.query, view }), [loaderData.query, view]);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [editingAccount, setEditingAccount] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const activeRef = useRef<Prompt | null>(null);

  const openPrompt = useOpenPrompt({ prompts, linkedPrompt, linkMissing });
  const copy = useCopyFlow();

  const openCreate = useCallback(() => setEditing({ mode: "create" }), []);
  const closeEditing = useCallback(() => setEditing(null), []);
  const openPhoto = useCallback(() => setEditingPhoto(true), []);
  const closePhoto = useCallback(() => setEditingPhoto(false), []);
  const openAccount = useCallback(() => setEditingAccount(true), []);
  const closeAccount = useCallback(() => setEditingAccount(false), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const setActive = useCallback((prompt: Prompt | null) => {
    activeRef.current = prompt;
  }, []);
  const { close: closeViewing } = openPrompt;
  const editPrompt = useCallback(
    (prompt: Prompt, body: string) => {
      closeViewing();
      setEditing({ mode: "edit", prompt, body });
    },
    [closeViewing],
  );
  useFavoriteErrors();

  // A resposta do apagar chega depois: só fecha se o prompt aberto ainda for o apagado.
  useUndoDelete((promptId) => {
    if (openPrompt.openId === promptId) {
      closeViewing();
    }
  });
  const copyPrompt = useCallback((prompt: Prompt) => void copy.requestCopy(prompt), [copy.requestCopy]);

  const paletteCommands = usePaletteCommands({ query, userId: user.id, onNewPrompt: openCreate });

  useHomeShortcuts({
    paletteOpen,
    togglePalette: () => setPaletteOpen((value) => !value),
    onNewPrompt: openCreate,
    getActive: () => activeRef.current,
    onCopy: copyPrompt,
    onOpen: openPrompt.open,
  });

  const filtered = query.search !== null || query.tag !== null || author !== null || query.favorites;
  const limit = query.limit ?? PAGE_SIZE;
  const hasMore = prompts.length < total && limit < MAX_LIMIT;

  return (
    <PromptActionsProvider requestCopy={copy.requestCopy} query={query}>
      <Navbar
        user={user}
        query={query}
        onNewPrompt={openCreate}
        onOpenPalette={openPalette}
        onEditPhoto={openPhoto}
        onEditAccount={openAccount}
      />
      <main>
        <section className="relative flex min-h-dvh flex-col overflow-hidden pt-32 pb-6 sm:pt-24 short:sm:pt-[4.5rem] short:sm:pb-3">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[60dvh] bg-[radial-gradient(ellipse_at_top,rgb(127_127_127/0.12),transparent_65%)]" />
          <div className="relative mx-auto max-w-3xl px-4 text-center">
            <h1 className="font-display text-[2.6rem] leading-[1.02] font-light tracking-tight text-balance sm:text-6xl lg:text-[4.25rem] short:sm:text-[2.6rem]">
              Os prompts que a turma usa <em className="font-normal italic">de verdade</em>
            </h1>
          </div>

          <FilterBar query={query} author={author} total={total} filtered={filtered} />

          <div className="relative flex flex-1 flex-col justify-center">
            {prompts.length === 0 ? <EmptyState filtered={filtered} onNewPrompt={openCreate} /> : null}
            {prompts.length > 0 && view === "grid" ? <PromptGrid prompts={prompts} onOpen={openPrompt.open} /> : null}
            {prompts.length > 0 && view === null ? (
              <PromptCoverflow
                key={`${query.search ?? ""}|${query.tag ?? ""}|${author?.id ?? ""}|${query.favorites}|${query.sort}`}
                prompts={prompts}
                initialId={openPrompt.openId}
                onOpen={openPrompt.open}
                onActiveChange={setActive}
              />
            ) : null}
            {hasMore ? (
              <div className="mt-4 flex flex-col items-center gap-2 px-4 text-center text-sm text-muted">
                <span>
                  Mostrando {prompts.length} de {total}.
                </span>
                <Link
                  to={homeHref({ ...query, limit: limit + PAGE_SIZE })}
                  preventScrollReset
                  className="rounded-full border border-line px-4 py-2 font-medium text-ink transition hover:bg-ink/5"
                >
                  Carregar mais
                </Link>
              </div>
            ) : null}
            {!hasMore && prompts.length < total ? (
              <p className="mt-4 px-4 text-center text-sm text-muted">
                {query.search !== null
                  ? `Mostrando os ${prompts.length} resultados mais relevantes. Refine a busca para achar os outros.`
                  : `Mostrando os ${prompts.length} ${query.sort === "popular" ? "mais copiados" : "mais recentes"}. Use a busca para achar os outros.`}
              </p>
            ) : null}
          </div>

          {/* As keys remontam cada diálogo a cada abertura, descartando o resultado anterior. */}
          <PromptViewDialog
            key={`view-${openPrompt.openId ?? "closed"}`}
            prompt={openPrompt.viewing}
            isOwner={openPrompt.viewing?.authorId === user.id}
            onClose={closeViewing}
            onEdit={editPrompt}
          />
          <PromptFormDialog key={`form-${editingKey(editing)}`} editing={editing} onClose={closeEditing} />
          <VariablesDialog
            key={`vars-${copy.variablesFor?.prompt.id ?? "closed"}`}
            target={copy.variablesFor}
            onClose={copy.closeVariables}
            onCopied={copy.countCopy}
          />
          <CommandPalette
            open={paletteOpen}
            recent={prompts}
            commands={paletteCommands}
            onClose={closePalette}
            onOpenPrompt={openPrompt.openExternal}
            onCopyPrompt={copyPrompt}
          />
          <ProfilePhotoDialog
            key={`photo-${editingPhoto ? "open" : "closed"}`}
            open={editingPhoto}
            name={user.name}
            currentUrl={user.avatarUrl}
            onClose={closePhoto}
          />
          <AccountDialog
            key={`account-${editingAccount ? "open" : "closed"}`}
            open={editingAccount}
            name={user.name}
            email={user.email}
            onClose={closeAccount}
          />
        </section>
      </main>
    </PromptActionsProvider>
  );
}
