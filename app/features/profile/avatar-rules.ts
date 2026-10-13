import type { ActionResult } from "~/shared/lib/action-result";

// Regras da foto de perfil compartilhadas entre navegador (redimensiona) e servidor (valida).
export const AVATAR_SIZE = 256;
export const MAX_AVATAR_BYTES = 512 * 1024;
// Limite do arquivo original escolhido pela pessoa, antes de ser reduzido no navegador.
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export type ProfilePhotoResult = ActionResult;
