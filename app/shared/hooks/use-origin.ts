import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Endereço do site (https://host) para montar links completos. No servidor é "" (ele não
// sabe o endereço real atrás do proxy); o navegador preenche depois de hidratar, sem
// erro de hidratação.
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
}
