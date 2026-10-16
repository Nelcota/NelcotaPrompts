import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useLocation, useNavigate, useNavigation } from "react-router";
import { toast } from "sonner";

import { DELETE_FETCHER_KEY } from "~/features/prompts/hooks/use-undo-delete";
import type { Prompt, PromptActionData } from "~/features/prompts/types";

const GONE = "Esse prompt não existe mais.";

type Options = {
  // Prompts da página atual.
  prompts: Prompt[];
  // Prompt do link direto (?p=) quando está fora da página/filtro.
  linkedPrompt: Prompt | null;
  // A página foi aberta com um ?p= que não existe mais.
  linkMissing: boolean;
};

// set (e não delete + append) mantém o parâmetro onde ele já estava na URL.
function setOrDeleteParam(params: URLSearchParams, key: string, value: string | null) {
  if (value === null) {
    params.delete(key);

    return;
  }

  params.set(key, value);
}

// O prompt aberto fica na URL (?p=id): o link pode ser compartilhado. Abrir cria uma
// entrada no histórico, então o "voltar" do navegador (ou do celular) fecha o prompt.
export function useOpenPrompt({ prompts, linkedPrompt, linkMissing }: Options) {
  const location = useLocation();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const openId = new URLSearchParams(location.search).get("p");
  // Prompt aberto de fora da página (ex.: resultado da palette, que busca no mural todo).
  const [external, setExternal] = useState<Prompt | null>(null);
  // Esta aba abriu o prompt com push: fechar volta no histórico em vez de empilhar outra entrada.
  const pushedRef = useRef(false);
  // Já pediu para fechar este prompt: um segundo pedido (ex.: apagar e a lista sem ele ao
  // mesmo tempo) voltaria duas vezes no histórico.
  const closingRef = useRef(false);
  // A página foi aberta com um ?p= que não existe mais: tem aviso próprio, uma vez só.
  const initialLinkMissing = useRef(linkMissing);
  // Exclusão feita aqui: o prompt some porque a pessoa apagou (o aviso é o "Desfazer").
  const deleted = useFetcher<PromptActionData>({ key: DELETE_FETCHER_KEY }).data;

  const viewing = useMemo(() => {
    if (openId === null) {
      return null;
    }

    return [...prompts, linkedPrompt, external].find((prompt) => prompt?.id === openId) ?? null;
  }, [openId, prompts, linkedPrompt, external]);

  // Parte da URL que está carregando, se houver (ex.: uma busca recém-digitada): abrir ou
  // fechar o prompt não cancela essa navegação.
  const base = navigation.state === "loading" && navigation.location.pathname === location.pathname ? navigation.location : location;

  const hrefWith = useCallback(
    (id: string | null) => {
      const params = new URLSearchParams(base.search);
      setOrDeleteParam(params, "p", id);
      const search = params.toString();

      return `${base.pathname}${search === "" ? "" : `?${search}`}`;
    },
    [base.pathname, base.search],
  );

  const setOpenId = useCallback(
    (id: string) => {
      // Trocar de um prompt aberto para outro não empilha: o voltar fecha de uma vez.
      const replace = openId !== null;
      pushedRef.current = pushedRef.current || !replace;
      void navigate(hrefWith(id), { replace, preventScrollReset: true });
    },
    [hrefWith, navigate, openId],
  );

  const close = useCallback(() => {
    if (closingRef.current) {
      return;
    }

    closingRef.current = true;

    if (pushedRef.current && navigation.state === "idle") {
      pushedRef.current = false;
      void navigate(-1);

      return;
    }

    pushedRef.current = false;
    void navigate(hrefWith(null), { replace: true, preventScrollReset: true });
  }, [hrefWith, navigate, navigation.state]);

  // Voltar pelo navegador já tirou o ?p: a próxima abertura volta a empilhar. Trocar de
  // prompt (ou fechar de vez) libera o próximo fechamento.
  useEffect(() => {
    closingRef.current = false;

    if (openId === null) {
      pushedRef.current = false;
    }
  }, [openId]);

  // O prompt aberto não está na página (o link já chegou quebrado, ou outra pessoa apagou
  // e a página recarregou depois de um erro 404): fecha, para o ?p não ficar na URL
  // apontando para nada. close() só age uma vez por prompt aberto. Quando ele some com a
  // página aberta, avisa aqui: o botão que recebeu o 404 (ex.: a estrela) sumiu junto e
  // não chega a mostrar o erro.
  useEffect(() => {
    if (openId === null || viewing !== null || navigation.state !== "idle" || closingRef.current) {
      return;
    }

    const deletedHere = deleted?.ok === true && deleted.promptId === openId;

    if (!deletedHere && !initialLinkMissing.current) {
      toast.error(GONE, { id: GONE });
    }

    close();
  }, [openId, viewing, navigation.state, close, deleted]);

  // Avisa sobre o link com que a página foi aberta (quem fecha é o efeito acima), uma vez.
  useEffect(() => {
    if (!initialLinkMissing.current) {
      return;
    }

    initialLinkMissing.current = false;
    toast.error(GONE, { id: GONE });
  }, []);

  const open = useCallback((prompt: Prompt) => setOpenId(prompt.id), [setOpenId]);
  const openExternal = useCallback(
    (prompt: Prompt) => {
      setExternal(prompt);
      setOpenId(prompt.id);
    },
    [setOpenId],
  );

  return { openId, viewing, open, openExternal, close };
}
