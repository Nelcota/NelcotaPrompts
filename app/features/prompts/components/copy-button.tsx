import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import type { Prompt } from "~/features/prompts/types";
import { useRequestCopy } from "./prompt-actions";

const FEEDBACK_MS = 2000;

type CopyButtonProps = {
  prompt: Prompt;
  className: string;
  iconClassName: string;
  label: string;
};

// Mostra "Copiado" no próprio botão por 2s, além do toast.
export function CopyButton({ prompt, className, iconClassName, label }: CopyButtonProps) {
  const requestCopy = useRequestCopy();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), FEEDBACK_MS);

    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      title={`${label} (C)`}
      aria-label={`${label}: “${prompt.title}”`}
      onClick={(event) => {
        event.stopPropagation();
        void requestCopy(prompt).then((outcome) => setCopied(outcome === "copied"));
      }}
      data-copied={copied}
      className={className}
    >
      {copied ? <Check className={iconClassName} aria-hidden /> : <Copy className={iconClassName} aria-hidden />}
      <span aria-live="polite">{copied ? "Copiado" : label}</span>
    </button>
  );
}
