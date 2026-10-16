// O <dialog> modal vai para a camada do topo do navegador, acima de qualquer z-index: os
// toasts (sonner) ficariam escurecidos atrás do fundo e, no celular, cobertos pelo cartão.
// Mostrar o container dos toasts como popover depois de abrir o diálogo o desenha acima
// dele. Clicar no toast continua impossível com o diálogo aberto (o HTML deixa inerte tudo
// fora do diálogo modal), mas os toasts com ação ("Desfazer") só aparecem depois que o
// diálogo fecha. O CSS (app.css) tira o visual padrão de popover.
const TOASTER = "section[data-react-aria-top-layer]";

export function raiseToastsAboveDialogs() {
  const toaster = document.querySelector<HTMLElement>(TOASTER);

  if (toaster === null || typeof toaster.showPopover !== "function") {
    return;
  }

  if (!toaster.hasAttribute("popover")) {
    toaster.setAttribute("popover", "manual");
  }

  // Reabrir sobe para o fim da camada do topo, acima do diálogo que acabou de abrir.
  if (toaster.matches(":popover-open")) {
    toaster.hidePopover();
  }

  toaster.showPopover();
}
