import { toast } from "sonner";

export const COPY_FAILED = "Não consegui copiar. Tente selecionar o texto manualmente.";

export function clipboardAvailable(): boolean {
  if (typeof navigator === "undefined" || navigator.clipboard === undefined) {
    toast.error("Seu navegador não permite copiar automaticamente.");

    return false;
  }

  return true;
}

// Copia um texto qualquer (link, código, prompt preenchido) e avisa num toast.
export async function copyText(text: string, successMessage: string): Promise<boolean> {
  if (!clipboardAvailable()) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);

    return true;
  } catch {
    toast.error(COPY_FAILED);

    return false;
  }
}
