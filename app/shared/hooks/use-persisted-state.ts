import { useEffect, useState } from "react";

import { readStorage, writeStorage } from "~/shared/lib/storage";

// Preferência do navegador (localStorage). Lida depois de montar: o HTML do servidor
// sempre sai com o valor padrão, sem erro de hidratação.
export function usePersistedState<T extends string>(key: string, initial: T, allowed: readonly T[]): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const stored = readStorage(key);
    const match = allowed.find((option) => option === stored);

    if (match !== undefined) {
      setValue(match);
    }
    // allowed é uma lista fixa de quem chama.
  }, [key]);

  const update = (next: T) => {
    setValue(next);
    writeStorage(key, next);
  };

  return [value, update];
}
