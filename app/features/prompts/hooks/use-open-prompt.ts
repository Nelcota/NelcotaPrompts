import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigation } from "react-router";
import { toast } from "sonner";

import type { Prompt } from "~/features/prompts/types";

type Options = {
  // Prompts da página atual.
  prompts: Prompt[];
  // Prompt do link direto (?p=) quando está fora da página/filtro.
  linkedPrompt: Prompt | null;
  // A página foi aberta com um ?p= que não existe mais.
  linkMissing: boolean;
};

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

      if (id === null) {
        params.delete("p");
      } else {
        params.set("p", id);
      }

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
    if (pushedRef.current && navigation.state === "idle") {
      pushedRef.current = false;
      void navigate(-1);

      return;
    }

    pushedRef.current = false;
    void navigate(hrefWith(null), { replace: true, preventScrollReset: true });
  }, [hrefWith, navigate, navigation.state]);

  // Voltar pelo navegador já tirou o ?p: a próxima abertura volta a empilhar.
  useEffect(() => {
    if (openId === null) {
      pushedRef.current = false;
    }
  }, [openId]);

  // Só avisa sobre o link com que a página foi aberta. Depois de apagar o prompt aberto,
  // a revalidação ainda vê o ?p antigo e não deve mostrar esse erro.
  const initialLinkMissing = useRef(linkMissing);

  useEffect(() => {
    if (!initialLinkMissing.current) {
      return;
    }

    initialLinkMissing.current = false;
    toast.error("Esse prompt não existe mais.");
    void navigate(hrefWith(null), { replace: true, preventScrollReset: true });
  }, [hrefWith, navigate]);

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
