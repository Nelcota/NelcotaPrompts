import { actionReply, type ActionReply } from "./action-result.server";
import { declaredTooLarge, readForm, readText, UNREADABLE_FORM } from "./validation.server";

export type IntentHandler<Context, Extra extends object> = (form: FormData, context: Context) => Promise<ActionReply<Extra>>;

type DispatchOptions<Context, Extra extends object> = {
  request: Request;
  handlers: Readonly<Record<string, IntentHandler<Context, Extra>>>;
  context: Context;
  // Nome para o log de erro (ex.: "admin").
  label: string;
  // Recusa antes de ler o corpo quando o cabeçalho já mostra que é grande demais.
  maxBytes?: number;
};

// Fluxo comum das actions com vários "intent": tamanho, formulário, handler e erro 500.
// Para uma ação nova, basta um handler novo no mapa (o despachante não muda).
export async function dispatchIntent<Context, Extra extends object>({
  request,
  handlers,
  context,
  label,
  maxBytes,
}: DispatchOptions<Context, Extra>): Promise<ActionReply<Extra>> {
  if (maxBytes !== undefined && declaredTooLarge(request, maxBytes)) {
    return actionReply<Extra>("unknown", 413, "Arquivo grande demais.");
  }

  const form = await readForm(request);

  if (form === null) {
    return actionReply<Extra>("unknown", 400, UNREADABLE_FORM);
  }

  const intent = readText(form, "intent");
  const handler = intent !== null && Object.hasOwn(handlers, intent) ? handlers[intent] : undefined;

  if (intent === null || handler === undefined) {
    return actionReply<Extra>("unknown", 400, "Ação desconhecida.");
  }

  try {
    return await handler(form, context);
  } catch (error) {
    console.error(`Falha na ação ${label}/${intent}:`, error);

    return actionReply<Extra>(intent, 500, "Algo deu errado do nosso lado. Tente de novo.");
  }
}
