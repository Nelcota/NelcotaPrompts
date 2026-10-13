// localStorage pode faltar ou lançar erro (aba anônima, bloqueado, cota cheia): aqui isso
// vira "sem valor" / "não salvou", sem quebrar a tela.

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sem localStorage: vale só nesta sessão.
  }
}
