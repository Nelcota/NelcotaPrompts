import { X } from "lucide-react";

import { useModalDialog } from "~/shared/hooks/use-modal-dialog";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  label: string;
  children?: React.ReactNode;
};

// Diálogo padrão do app (cartão centralizado com ✕). O comportamento do <dialog> nativo
// fica em useModalDialog; onClose só é um pedido para fechar.
export function Dialog({ open, onClose, label, children }: DialogProps) {
  const dialogProps = useModalDialog(open, onClose);

  return (
    <dialog
      {...dialogProps}
      aria-label={label}
      className="m-auto w-[min(100%-2rem,40rem)] max-h-[min(100dvh-2rem,48rem)] overflow-hidden rounded-[1.75rem] border border-line bg-elevated p-0 text-ink shadow-2xl backdrop:bg-black/60"
    >
      <div className="relative max-h-[min(100dvh-2rem,48rem)] overflow-y-auto p-6 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 z-10 grid size-9 place-items-center rounded-full bg-elevated/80 text-muted backdrop-blur transition hover:bg-elevated hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
        {children}
      </div>
    </dialog>
  );
}
