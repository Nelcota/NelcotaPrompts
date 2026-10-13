import { useState } from "react";

import { usePromptBody } from "~/features/prompts/hooks/use-prompt-body";
import type { Prompt } from "~/features/prompts/types";
import { Dialog } from "~/shared/ui/dialog";
import { PromptArt } from "~/shared/ui/prompt-art";
import { PromptHistory } from "./prompt-history";
import { PromptBodyViewer } from "~/features/prompts/components/prompt-view/prompt-body-viewer";
import { PromptMetaLine } from "~/features/prompts/components/prompt-view/prompt-meta-line";
import { PromptToolbar } from "~/features/prompts/components/prompt-view/prompt-toolbar";

type PromptViewDialogProps = {
  prompt: Prompt | null;
  isOwner: boolean;
  onClose: () => void;
  onEdit: (prompt: Prompt, body: string) => void;
};

// Prompt aberto: arte, título, metadados e o corpo com as ações, ou o histórico de versões.
export function PromptViewDialog({ prompt, isOwner, onClose, onEdit }: PromptViewDialogProps) {
  const { body, failed } = usePromptBody(prompt);
  const [showingHistory, setShowingHistory] = useState(false);

  if (prompt === null) {
    return <Dialog open={false} onClose={onClose} label="Prompt" />;
  }

  return (
    <Dialog open onClose={onClose} label={prompt.title}>
      <div className="relative -mx-6 -mt-6 mb-6 h-28 overflow-hidden sm:-mx-8 sm:-mt-8">
        <PromptArt seed={prompt.id} animated />
      </div>
      <h2 className="font-display pr-8 text-3xl leading-tight font-light tracking-tight">{prompt.title}</h2>
      <PromptMetaLine prompt={prompt} />

      {showingHistory && body !== null ? (
        <PromptHistory prompt={prompt} currentBody={body} isOwner={isOwner} onBack={() => setShowingHistory(false)} onRestored={onClose} />
      ) : (
        <>
          <PromptBodyViewer body={body} excerpt={prompt.excerpt} />
          {body === null ? (
            <p className="mt-2 text-sm text-muted" aria-live="polite">
              {failed ? "Não consegui carregar o texto completo. Feche e abra de novo." : "Carregando o texto completo…"}
            </p>
          ) : null}
          <PromptToolbar
            prompt={prompt}
            body={body}
            isOwner={isOwner}
            onShowHistory={() => setShowingHistory(true)}
            onEdit={onEdit}
          />
        </>
      )}
    </Dialog>
  );
}
