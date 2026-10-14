import { randomBytes } from "node:crypto";

import { actionReply, type ActionReply } from "~/shared/server/action-result.server";
import {
  adminRestorePrompt,
  adminTrashPrompt,
  deleteUser,
  emptyTrash,
  endUserSessions,
  purgePrompt,
  setUserAdmin,
  setUserDisabled,
} from "./admin.server";
import { type AdminIntent, inviteCodeSchema } from "~/features/admin/admin-rules";
import { deleteBrandAsset, saveBrandAsset } from "~/features/brand/server/brand.server";
import { type BrandAsset, MAX_BRAND_IMAGE_BYTES, MAX_BRAND_IMAGE_DIMENSION } from "~/features/brand/brand-rules";
import { readUploadedImage, type UploadedImage, type UploadLimits } from "~/shared/server/image.server";
import type { IntentHandler } from "~/shared/server/intent-dispatch.server";
import { createResetLink } from "~/features/auth/server/password-reset.server";
import { currentSessionId, destroyUserSessions } from "~/features/auth/server/session.server";
import { resetInviteCode, setInviteCode, setInviteRequired } from "~/features/auth/server/invite.server";
import type { PublicUser } from "~/features/auth/server/users.server";
import { parseForm, readText, readUuid } from "~/shared/server/validation.server";

// Ações do painel admin, uma por "intent". Quem chama já conferiu que é admin.

type Context = { admin: PublicUser; request: Request };
type Extra = { resetPath: string };
type Reply = ActionReply<Extra>;

const reply = (intent: AdminIntent, status: number, message: string, extra?: Extra): Reply =>
  actionReply<Extra>(intent, status, message, extra);

const INVALID = "Pedido inválido.";
const NOT_FOUND_USER = "Essa conta não existe mais.";
const NOT_FOUND_PROMPT = "Esse prompt não existe mais.";
const LAST_ADMIN = "Precisa sobrar pelo menos um admin ativo.";

// Sem 0/O/1/l/I: o código é ditado e digitado por gente.
const INVITE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomInvite(): string {
  return Array.from(randomBytes(12), (byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join("");
}

// "1"/"0" do formulário; null = valor inválido.
function readToggle(form: FormData): boolean | null {
  const value = readText(form, "value");

  return value === "1" ? true : value === "0" ? false : null;
}

const BRAND_UPLOAD = { maxBytes: MAX_BRAND_IMAGE_BYTES, maxDimension: MAX_BRAND_IMAGE_DIMENSION };

// A logo aparece com 40 px de altura: guardada com folga para telas de alta densidade. O
// favicon sai quadrado (aba, favoritos e atalhos pedem de 16 a 192 px).
const BRAND_LIMITS: Record<BrandAsset, UploadLimits> = {
  logo: { ...BRAND_UPLOAD, output: { width: 1024, height: 256 } },
  favicon: { ...BRAND_UPLOAD, output: { width: 256, height: 256, fit: "square" } },
};

const BRAND_MESSAGES: Record<BrandAsset, { saved: string; removed: string }> = {
  logo: { saved: "Logo atualizada.", removed: "Voltou a logo padrão." },
  favicon: { saved: "Favicon atualizado.", removed: "Voltou o favicon padrão." },
};

const IMAGE_ERRORS: Record<Exclude<UploadedImage, { ok: true }>["reason"], string> = {
  missing: "Escolha uma imagem.",
  too_large: "A imagem passa de 1 MB.",
  unsupported: "Formato não suportado. Use PNG, WebP ou JPG.",
  dimensions: `A imagem passa de ${MAX_BRAND_IMAGE_DIMENSION} px.`,
  corrupt: "Essa imagem parece corrompida. Tente outra.",
};

function brandUpload(asset: BrandAsset): IntentHandler<Context, Extra> {
  const intent = `${asset}-upload` satisfies AdminIntent;

  return async (form) => {
    const image = await readUploadedImage(form, asset, BRAND_LIMITS[asset]);

    if (!image.ok) {
      return reply(intent, image.status, IMAGE_ERRORS[image.reason]);
    }

    await saveBrandAsset(asset, image.type, image.bytes);

    return reply(intent, 200, BRAND_MESSAGES[asset].saved);
  };
}

function brandRemove(asset: BrandAsset): IntentHandler<Context, Extra> {
  const intent = `${asset}-remove` satisfies AdminIntent;

  return async () => {
    await deleteBrandAsset(asset);

    return reply(intent, 200, BRAND_MESSAGES[asset].removed);
  };
}

// Ações sobre um prompt por id: id malformado = 400; não encontrado = 404.
function promptAction(intent: AdminIntent, run: (id: string, context: Context) => Promise<boolean>, message: string): IntentHandler<Context, Extra> {
  return async (form, context) => {
    const id = readUuid(form, "promptId");

    if (id === null) {
      return reply(intent, 400, INVALID);
    }

    return (await run(id, context)) ? reply(intent, 200, message) : reply(intent, 404, NOT_FOUND_PROMPT);
  };
}

export const ADMIN_HANDLERS: Record<AdminIntent, IntentHandler<Context, Extra>> = {
  async "user-admin"(form, { admin }) {
    const userId = readUuid(form, "userId");
    const value = readToggle(form);

    if (userId === null || value === null) {
      return reply("user-admin", 400, INVALID);
    }

    // Tirar o próprio acesso poderia deixar o painel sem nenhum admin.
    if (userId === admin.id && !value) {
      return reply("user-admin", 400, "Você não pode tirar o seu próprio acesso de admin.");
    }

    const result = await setUserAdmin(userId, value);

    if (result !== "ok") {
      return result === "last_admin" ? reply("user-admin", 400, LAST_ADMIN) : reply("user-admin", 404, NOT_FOUND_USER);
    }

    return reply("user-admin", 200, value ? "Agora é admin." : "Não é mais admin.");
  },

  async "user-disable"(form, { admin }) {
    const userId = readUuid(form, "userId");
    const value = readToggle(form);

    if (userId === null || value === null) {
      return reply("user-disable", 400, INVALID);
    }

    if (userId === admin.id) {
      return reply("user-disable", 400, "Você não pode bloquear a sua própria conta.");
    }

    const result = await setUserDisabled(userId, value);

    if (result !== "ok") {
      return result === "last_admin" ? reply("user-disable", 400, LAST_ADMIN) : reply("user-disable", 404, NOT_FOUND_USER);
    }

    return reply("user-disable", 200, value ? "Conta bloqueada e desconectada." : "Conta desbloqueada.");
  },

  // Na própria conta, mantém esta sessão (senão o admin cairia do painel).
  async "user-sessions"(form, { admin, request }) {
    const userId = readUuid(form, "userId");

    if (userId === null) {
      return reply("user-sessions", 400, INVALID);
    }

    if (userId === admin.id) {
      await destroyUserSessions(userId, await currentSessionId(request));

      return reply("user-sessions", 200, "Seus outros dispositivos foram desconectados.");
    }

    const count = await endUserSessions(userId);

    return reply("user-sessions", 200, count === 0 ? "Não havia sessões abertas." : "Sessões encerradas.");
  },

  // Exige o email da conta digitado: excluir leva junto todos os prompts da pessoa.
  async "user-delete"(form, { admin }) {
    const userId = readUuid(form, "userId");
    const confirm = readText(form, "confirm");

    if (userId === null) {
      return reply("user-delete", 400, INVALID);
    }

    if (userId === admin.id) {
      return reply("user-delete", 400, "Você não pode excluir a sua própria conta.");
    }

    if (confirm === null || !(await deleteUser(userId, confirm))) {
      return reply("user-delete", 400, "O email digitado não confere com o da conta.");
    }

    return reply("user-delete", 200, "Conta excluída.");
  },

  async "user-reset"(form) {
    const userId = readUuid(form, "userId");

    if (userId === null) {
      return reply("user-reset", 400, INVALID);
    }

    const resetPath = await createResetLink(userId);

    if (resetPath === null) {
      return reply("user-reset", 404, "Essa conta não existe ou está bloqueada (desbloqueie antes).");
    }

    return reply("user-reset", 200, "Link gerado. Vale 1 hora, uma única vez.", { resetPath });
  },

  "prompt-trash": promptAction("prompt-trash", (id, { admin }) => adminTrashPrompt(id, admin.id), "Prompt movido para a lixeira."),
  "prompt-restore": promptAction("prompt-restore", adminRestorePrompt, "Prompt restaurado."),
  "prompt-purge": promptAction("prompt-purge", purgePrompt, "Prompt excluído de vez."),

  async "trash-empty"() {
    const count = await emptyTrash();

    return reply("trash-empty", 200, count === 0 ? "A lixeira já estava vazia." : `Lixeira esvaziada (${count}).`);
  },

  async "invite-toggle"(form) {
    const required = form.get("required") === "true";

    await setInviteRequired(required);

    return reply(
      "invite-toggle",
      200,
      required ? "Convite ligado: o cadastro volta a pedir o código." : "Convite desligado: qualquer pessoa com o link pode criar conta.",
    );
  },

  async "invite-save"(form) {
    const parsed = parseForm(inviteCodeSchema, form);

    if (!parsed.ok) {
      return reply("invite-save", 400, parsed.errors.code ?? "Código inválido.");
    }

    await setInviteCode(parsed.data.code);

    return reply("invite-save", 200, "Código de convite atualizado. O anterior deixou de valer.");
  },

  async "invite-random"() {
    await setInviteCode(randomInvite());

    return reply("invite-random", 200, "Novo código gerado. O anterior deixou de valer.");
  },

  async "invite-reset"() {
    await resetInviteCode();

    return reply("invite-reset", 200, "Voltou a valer o código da variável INVITE_CODE.");
  },

  "logo-upload": brandUpload("logo"),
  "logo-remove": brandRemove("logo"),
  "favicon-upload": brandUpload("favicon"),
  "favicon-remove": brandRemove("favicon"),
};

// Folga para os outros campos do formulário além da imagem.
export const ADMIN_MAX_REQUEST_BYTES = MAX_BRAND_IMAGE_BYTES + 64 * 1024;
