// Formato comum das respostas de action (formulários e fetchers): o navegador lê sempre
// ok, intent e message; cada rota acrescenta seus campos (erros por campo, ids, links).
export type ActionResult<Extra extends object = object> = {
  ok: boolean;
  intent: string;
  message: string;
} & Partial<Extra>;

export type FieldErrors = Record<string, string>;
