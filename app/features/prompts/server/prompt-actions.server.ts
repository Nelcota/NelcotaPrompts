import { actionReply, type ActionReply } from "~/shared/server/action-result.server";
import type { IntentHandler } from "~/shared/server/intent-dispatch.server";
import { type PromptIntent, promptInputSchema } from "~/features/prompts/prompt-rules";
import {
  createPrompt,
  type OwnershipResult,
  purgeExpiredTrash,
  recordCopy,
  restorePrompt,
  restorePromptVersion,
  setFavorite,
  trashPrompt,
  updatePrompt,
} from "./prompts.server";
import { clearAttempts, consumeAttempt } from "~/shared/server/rate-limit.server";
import type { FieldErrors } from "~/shared/lib/action-result";
import type { PublicUser } from "~/features/auth/server/users.server";
import { parseForm, readText, readUuid } from "~/shared/server/validation.server";

// Ações da home (criar, editar, apagar, favoritar, copiar…), uma por "intent".

type Extra = { promptId: string; errors: FieldErrors };
type Reply = ActionReply<Extra>;

const COPY_DEDUP_MS = 10 * 60 * 1000;
const NOT_FOUND = "Esse prompt não existe mais.";
const INVALID = "Prompt inválido.";

const OWNERSHIP_ERRORS: Record<Exclude<OwnershipResult, "ok">, { status: number; message: string }> = {
  not_found: { status: 404, message: NOT_FOUND },
  forbidden: { status: 403, message: "Você só pode alterar os prompts que você criou." },
};

export function promptReply(intent: PromptIntent, status: number, message: string, extra?: Partial<Extra>): Reply {
  return actionReply<Extra>(intent, status, message, extra);
}

// Resposta de uma mudança que exige ser o autor (editar, apagar, restaurar).
function ownedResult(intent: PromptIntent, result: OwnershipResult, message: string, promptId: string): Reply {
  if (result === "ok") {
    return promptReply(intent, 200, message, { promptId });
  }

  const error = OWNERSHIP_ERRORS[result];

  return promptReply(intent, error.status, error.message);
}

// Conta uma cópia (também a de uma IA pelo MCP). A mesma pessoa copiando o mesmo prompt
// várias vezes seguidas conta uma vez a cada 10 minutos. false = prompt apagado.
export async function countCopy(userId: string, promptId: string): Promise<boolean> {
  const key = `copy:${userId}:${promptId}`;

  // Conta antes do await: dois cliques simultâneos não contam duas cópias.
  if ((await consumeAttempt(key, 1, COPY_DEDUP_MS)).limited) {
    return true;
  }

  if (!(await recordCopy(promptId))) {
    await clearAttempts(key, { max: 1, windowMs: COPY_DEDUP_MS });

    return false;
  }

  return true;
}

export const PROMPT_HANDLERS: Record<PromptIntent, IntentHandler<PublicUser, Extra>> = {
  async create(form, user) {
    const parsed = parseForm(promptInputSchema, form);

    if (!parsed.ok) {
      return promptReply("create", 400, "Revise os campos destacados.", { errors: parsed.errors });
    }

    const created = await createPrompt(user.id, parsed.data);

    if (created === null) {
      return promptReply("create", 500, "Não foi possível salvar agora. Tente de novo.");
    }

    return promptReply("create", 200, "Prompt publicado.", { promptId: created.id });
  },

  async update(form, user) {
    const id = readUuid(form, "id");

    if (id === null) {
      return promptReply("update", 400, INVALID);
    }

    const parsed = parseForm(promptInputSchema, form);

    if (!parsed.ok) {
      return promptReply("update", 400, "Revise os campos destacados.", { errors: parsed.errors });
    }

    return ownedResult("update", await updatePrompt(id, user.id, parsed.data), "Prompt atualizado.", id);
  },

  // Vai para a lixeira: o toast oferece "Desfazer" (intent restore).
  async delete(form, user) {
    const id = readUuid(form, "id");

    if (id === null) {
      return promptReply("delete", 400, INVALID);
    }

    const result = await trashPrompt(id, user.id);

    // Sem agendador: cada exclusão aproveita para tirar da lixeira o que passou do prazo.
    // É limpeza de fundo: se falhar, não muda a resposta (o prompt já foi para a lixeira).
    if (result === "ok") {
      await purgeExpiredTrash().catch((error: unknown) => console.error("Falha ao limpar a lixeira:", error));
    }

    return ownedResult("delete", result, "Prompt apagado.", id);
  },

  async restore(form, user) {
    const id = readUuid(form, "id");

    if (id === null) {
      return promptReply("restore", 400, INVALID);
    }

    return ownedResult("restore", await restorePrompt(id, user.id), "Prompt restaurado.", id);
  },

  async restoreVersion(form, user) {
    const id = readUuid(form, "id");
    const versionId = readUuid(form, "versionId");

    if (id === null || versionId === null) {
      return promptReply("restoreVersion", 400, "Versão inválida.");
    }

    return ownedResult("restoreVersion", await restorePromptVersion(id, versionId, user.id), "Versão restaurada.", id);
  },

  async favorite(form, user) {
    const id = readUuid(form, "id");
    const value = readText(form, "value");

    if (id === null || (value !== "1" && value !== "0")) {
      return promptReply("favorite", 400, INVALID);
    }

    const favorite = value === "1";

    if (!(await setFavorite(user.id, id, favorite))) {
      return promptReply("favorite", 404, NOT_FOUND);
    }

    return promptReply("favorite", 200, favorite ? "Adicionado aos favoritos." : "Removido dos favoritos.", { promptId: id });
  },

  // Conta uma cópia (sem inflar o "Mais copiados": ver countCopy).
  async copied(form, user) {
    const id = readUuid(form, "id");

    if (id === null) {
      return promptReply("copied", 400, INVALID);
    }

    if (!(await countCopy(user.id, id))) {
      return promptReply("copied", 404, NOT_FOUND);
    }

    return promptReply("copied", 200, "", { promptId: id });
  },
};
