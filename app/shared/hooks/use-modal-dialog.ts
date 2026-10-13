import { useEffect, useEffectEvent, useRef } from "react";

// <dialog> nativo controlado por open: foco preso e backdrop sem dependência extra. Esc,
// clique fora e botões só PEDEM para fechar (onRequestClose); quem usa decide (ex.: o
// formulário segura se houver alterações não salvas). Fecha de fato quando open vira false.
export function useModalDialog(open: boolean, onRequestClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const openRef = useRef(open);
  const pressedOnBackdrop = useRef(false);
  const requestClose = useEffectEvent(onRequestClose);

  useEffect(() => {
    openRef.current = open;

    const dialog = ref.current;

    if (dialog === null) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      // O autoFocus do React não vira atributo HTML; o campo principal usa data-autofocus.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();

      return;
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const props = {
    ref,
    onCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
      event.preventDefault();
      requestClose();
    },
    // O Chrome pode fechar o <dialog> sozinho (segundo Esc sem clique entre eles) sem
    // passar pelo cancel. Avisamos quem usa e, se ele ainda quer o diálogo aberto
    // (ex.: formulário com alterações), reabrimos.
    onClose() {
      if (!openRef.current) {
        return;
      }

      requestClose();

      window.requestAnimationFrame(() => {
        const dialog = ref.current;

        if (dialog !== null && !dialog.open && openRef.current) {
          dialog.showModal();
        }
      });
    },
    // Fecha só se o clique começou E terminou no fundo: arrastar para selecionar texto
    // e soltar fora não fecha.
    onPointerDown(event: React.PointerEvent<HTMLDialogElement>) {
      pressedOnBackdrop.current = event.target === event.currentTarget;
    },
    onClick(event: React.MouseEvent<HTMLDialogElement>) {
      const startedOnBackdrop = pressedOnBackdrop.current;
      pressedOnBackdrop.current = false;

      if (startedOnBackdrop && event.target === event.currentTarget) {
        requestClose();
      }
    },
  };

  return props;
}
