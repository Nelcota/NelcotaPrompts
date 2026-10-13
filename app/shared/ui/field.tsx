import { Eye, EyeOff } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { inputClass, labelClass } from "./styles";
import { cn } from "./cn";

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  // Campo de várias linhas (corpo do prompt).
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  autoComplete?: string;
  defaultValue?: string;
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  minLength?: number;
  maxLength?: number;
  autoFocus?: boolean;
  // O Dialog foca o campo com data-autofocus ao abrir (autoFocus do React não vale ali).
  dialogAutoFocus?: boolean;
  background?: "canvas" | "surface";
  inputClassName?: string;
  // Conteúdo à direita do rótulo (ex.: link "Esqueci a senha").
  aside?: ReactNode;
  // Mostrado no lugar do campo (ex.: pré-visualização), que continua no formulário, oculto.
  replacement?: ReactNode;
};

// Campo com rótulo, dica e erro ligados ao input (aria-describedby/aria-invalid). Senha
// ganha o botão de mostrar/ocultar.
export function Field({
  label,
  name,
  type = "text",
  multiline = false,
  rows,
  required = true,
  autoComplete,
  defaultValue,
  placeholder,
  error,
  hint,
  minLength,
  maxLength,
  autoFocus,
  dialogAutoFocus,
  background = "canvas",
  inputClassName = "",
  aside,
  replacement,
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const isPassword = type === "password";
  const [visible, setVisible] = useState(false);
  const describedBy = [hint === undefined ? null : hintId, error === undefined ? null : errorId].filter((value) => value !== null).join(" ");
  const shared = {
    id,
    name,
    required,
    defaultValue,
    placeholder,
    minLength,
    maxLength,
    autoFocus,
    "data-autofocus": dialogAutoFocus ? true : undefined,
    "aria-invalid": error !== undefined,
    "aria-describedby": describedBy === "" ? undefined : describedBy,
  };
  const className = inputClass(background, cn(isPassword && "pr-12", inputClassName));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        {aside}
      </div>
      <div className="relative mt-1.5">
        {multiline ? (
          <textarea {...shared} rows={rows} hidden={replacement !== undefined} className={cn(className, "resize-y")} />
        ) : (
          <input {...shared} type={isPassword && visible ? "text" : type} autoComplete={autoComplete} className={className} />
        )}
        {isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={visible}
            className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:outline-none"
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        ) : null}
        {replacement}
      </div>
      {hint === undefined ? null : (
        <span id={hintId} className="mt-1.5 block text-sm text-muted">
          {hint}
        </span>
      )}
      {error === undefined ? null : (
        <span id={errorId} className="mt-1.5 block text-sm text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
