import { useRef } from "react";
import { useFetcher } from "react-router";

import { useFetcherResult } from "~/shared/hooks/use-fetcher-result";
import { type AccountResult, NAME_MAX, PASSWORD_MAX, PASSWORD_MIN } from "~/features/auth/account-rules";
import { Dialog } from "~/shared/ui/dialog";
import { Field } from "~/shared/ui/field";
import { buttonClass } from "~/shared/ui/styles";

type AccountDialogProps = {
  open: boolean;
  name: string;
  email: string;
  onClose: () => void;
};

export function AccountDialog({ open, name, email, onClose }: AccountDialogProps) {
  const nameFetcher = useFetcher<AccountResult>();
  const passwordFetcher = useFetcher<AccountResult>();
  const passwordForm = useRef<HTMLFormElement>(null);
  const nameErrors = nameFetcher.data?.errors ?? {};
  const passwordErrors = passwordFetcher.data?.errors ?? {};

  useFetcherResult(nameFetcher);
  useFetcherResult(passwordFetcher, { onSuccess: () => passwordForm.current?.reset() });

  return (
    <Dialog open={open} onClose={onClose} label="Minha conta">
      <h2 className="font-display text-3xl font-light tracking-tight">Minha conta</h2>

      <nameFetcher.Form method="post" action="/conta" className="mt-6 space-y-3">
        <input type="hidden" name="intent" value="name" />
        <Field label="Nome" name="name" maxLength={NAME_MAX} defaultValue={name} autoComplete="name" error={nameErrors.name} dialogAutoFocus />
        <div className="flex justify-end">
          <button type="submit" disabled={nameFetcher.state !== "idle"} className={buttonClass("primary")}>
            {nameFetcher.state !== "idle" ? "Salvando…" : "Salvar nome"}
          </button>
        </div>
      </nameFetcher.Form>

      <hr className="my-6 border-line" />

      <passwordFetcher.Form ref={passwordForm} method="post" action="/conta" className="space-y-3">
        <input type="hidden" name="intent" value="password" />
        {/* Para o gerenciador de senhas saber de qual conta é a senha nova. */}
        <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
        <Field label="Senha atual" name="current" type="password" autoComplete="current-password" error={passwordErrors.current} />
        <Field
          label="Nova senha"
          name="next"
          type="password"
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          autoComplete="new-password"
          error={passwordErrors.next}
          hint="Ao trocar a senha, os outros dispositivos onde você entrou são desconectados."
        />
        <div className="flex justify-between gap-2">
          <button type="button" onClick={onClose} className={buttonClass("ghost")}>
            Fechar
          </button>
          <button type="submit" disabled={passwordFetcher.state !== "idle"} className={buttonClass("primary")}>
            {passwordFetcher.state !== "idle" ? "Alterando…" : "Alterar senha"}
          </button>
        </div>
      </passwordFetcher.Form>
    </Dialog>
  );
}
