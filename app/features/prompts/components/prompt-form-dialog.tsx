import { useRef, useState } from "react";
import { useFetcher } from "react-router";

import { useFetcherResult } from "~/shared/hooks/use-fetcher-result";
import { HOME_ACTION } from "~/features/prompts/list-query";
import { BODY_MAX, type PromptIntent, promptInputSchema, TAGS_MAX, TITLE_MAX } from "~/features/prompts/prompt-rules";
import type { FieldErrors } from "~/shared/lib/action-result";
import { formToObject, parseWithSchema } from "~/shared/lib/form-schema";
import type { Prompt, PromptActionData } from "~/features/prompts/types";
import { Dialog } from "~/shared/ui/dialog";
import { Field } from "~/shared/ui/field";
import { buttonClass } from "~/shared/ui/styles";

export type Editing = { mode: "create" } | { mode: "edit"; prompt: Prompt; body: string };

type PromptFormDialogProps = {
  editing: Editing | null;
  onClose: () => void;
};

export function PromptFormDialog({ editing, onClose }: PromptFormDialogProps) {
  const fetcher = useFetcher<PromptActionData>();
  const pending = fetcher.state !== "idle";
  // Erros do navegador (mesmo schema do servidor) aparecem antes de enviar; os do
  // servidor valem quando a validação local passou.
  const [localErrors, setLocalErrors] = useState<FieldErrors | null>(null);
  const errors = localErrors ?? fetcher.data?.errors ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  useFetcherResult(fetcher, { onSuccess: onClose });

  if (editing === null) {
    return <Dialog open={false} onClose={onClose} label="Prompt" />;
  }

  const prompt = editing.mode === "edit" ? editing.prompt : null;
  const body = editing.mode === "edit" ? editing.body : undefined;
  const title = prompt === null ? "Novo prompt" : "Editar prompt";
  const initial = { title: prompt?.title ?? "", body: body ?? "", tags: prompt?.tags.join(", ") ?? "" };

  // Compara com os valores iniciais a cada digitação (desfazer a mudança limpa o aviso).
  const checkDirty = () => {
    const form = formRef.current;

    if (form === null) {
      return;
    }

    const data = new FormData(form);
    const changed = (["title", "body", "tags"] as const).some((key) => {
      const value = data.get(key);

      return typeof value === "string" && value !== initial[key];
    });

    setDirty(changed);
  };

  // Esc, clique fora, ✕ e Cancelar passam por aqui: com alterações, pergunta antes.
  const requestClose = () => {
    // Salvando: espera a resposta (fechar agora perderia o erro de validação ou o aviso).
    if (pending) {
      return;
    }

    if (dirty) {
      setConfirmingDiscard(true);

      return;
    }

    onClose();
  };

  return (
    <Dialog open onClose={requestClose} label={title}>
      <h2 className="font-display text-3xl font-light tracking-tight">{title}</h2>
      <p className="mt-1 text-base text-muted">Todo mundo da turma vai ver. Só você pode editar.</p>
      <fetcher.Form
        ref={formRef}
        onInput={checkDirty}
        onSubmit={(event) => {
          const checked = parseWithSchema(promptInputSchema, formToObject(new FormData(event.currentTarget)));

          if (!checked.ok) {
            event.preventDefault();
          }

          setLocalErrors(checked.ok ? null : checked.errors);
        }}
        noValidate
        method="post" action={HOME_ACTION} className="mt-6 space-y-4" key={prompt?.id ?? "new"}>
        <input type="hidden" name="intent" value={(prompt === null ? "create" : "update") satisfies PromptIntent} />
        {prompt === null ? null : <input type="hidden" name="id" value={prompt.id} />}
        <Field
          label="Título"
          name="title"
          maxLength={TITLE_MAX}
          defaultValue={prompt?.title}
          placeholder="Ex.: Revisor de código implacável"
          error={errors.title}
          dialogAutoFocus
        />
        <Field
          label="Prompt"
          name="body"
          multiline
          rows={9}
          maxLength={BODY_MAX}
          defaultValue={body}
          placeholder="Cole aqui o prompt que você sempre usa…"
          inputClassName="font-mono text-[15px] leading-relaxed"
          error={errors.body}
          hint={
            <>
              Escreva <code className="rounded bg-ink/10 px-1 font-mono">{"{tema}"}</code> para trechos que mudam a cada uso, ou{" "}
              <code className="rounded bg-ink/10 px-1 font-mono">{"{linguagem=TypeScript}"}</code> com valor padrão. Aceita Markdown.
            </>
          }
        />
        <Field
          label="Tags"
          name="tags"
          required={false}
          defaultValue={prompt?.tags.join(", ")}
          placeholder="código, escrita, estudo"
          hint={`Separe por vírgula. Até ${TAGS_MAX}.`}
          error={errors.tags}
        />
        {confirmingDiscard ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3">
            <span className="text-base">Descartar as alterações?</span>
            <div className="flex gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmingDiscard(false)}
                className="rounded-full px-4 py-2 text-base font-medium transition hover:bg-ink/5"
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-danger px-4 py-2 text-base font-medium text-white transition hover:opacity-90"
              >
                Descartar
              </button>
            </div>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={requestClose} className={buttonClass("ghost")}>
            Cancelar
          </button>
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            {pending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </fetcher.Form>
    </Dialog>
  );
}
