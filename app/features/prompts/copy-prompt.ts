import { toast } from "sonner";

import { clipboardAvailable, COPY_FAILED } from "~/shared/lib/copy-text";
import { cachedBody, loadBody } from "./prompt-body";
import type { Prompt } from "./types";

const FETCH_ERROR = "Não consegui carregar o prompt completo. Tente de novo.";

async function bodyOrThrow(prompt: Prompt): Promise<string> {
  const body = await loadBody(prompt);

  if (body === null || body.trim() === "") {
    throw new Error(FETCH_ERROR);
  }

  return body;
}

// Quando o corpo ainda não está no navegador, o ClipboardItem recebe uma Promise:
// assim o Safari mantém o gesto do clique enquanto o texto é buscado.
async function writeToClipboard(prompt: Prompt): Promise<void> {
  const cached = cachedBody(prompt);

  if (cached !== null) {
    await navigator.clipboard.writeText(cached);

    return;
  }

  if (typeof ClipboardItem === "undefined" || typeof navigator.clipboard.write !== "function") {
    await navigator.clipboard.writeText(await bodyOrThrow(prompt));

    return;
  }

  const blob = bodyOrThrow(prompt).then((body) => new Blob([body], { type: "text/plain" }));
  await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
}


// Devolve true quando copiou (para o botão mostrar "Copiado").
export async function copyPrompt(prompt: Prompt): Promise<boolean> {
  if (!clipboardAvailable()) {
    return false;
  }

  try {
    await writeToClipboard(prompt);
    toast.success(`“${prompt.title}” copiado.`);

    return true;
  } catch (error) {
    const message = error instanceof Error && error.message === FETCH_ERROR ? FETCH_ERROR : COPY_FAILED;
    toast.error(message);

    return false;
  }
}
