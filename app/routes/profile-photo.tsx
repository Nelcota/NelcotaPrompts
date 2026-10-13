import { actionReply } from "~/shared/server/action-result.server";
import { AVATAR_SIZE, MAX_AVATAR_BYTES } from "~/features/profile/avatar-rules";
import { deleteAvatar, saveAvatar } from "~/features/profile/server/avatars.server";
import { readUploadedImage, type UploadedImage } from "~/shared/server/image.server";
import { dispatchIntent, type IntentHandler } from "~/shared/server/intent-dispatch.server";
import { consumeAttempt, tooManyAttemptsMessage } from "~/shared/server/rate-limit.server";
import { requireUser } from "~/features/auth/server/session.server";
import type { PublicUser } from "~/features/auth/server/users.server";
import type { Route } from "./+types/profile-photo";

// O navegador já manda a foto recortada e reduzida (256x256), então os limites são folgados;
// o servidor recodifica e garante o tamanho final.
const LIMITS = { maxBytes: MAX_AVATAR_BYTES, maxDimension: 1024, output: { width: AVATAR_SIZE, height: AVATAR_SIZE } };
const UPLOADS_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

const UPLOAD_ERRORS: Record<Exclude<UploadedImage, { ok: true }>["reason"], string> = {
  missing: "Escolha uma foto.",
  too_large: "A foto ficou grande demais. Tente outra imagem.",
  unsupported: "Formato não suportado. Use JPG, PNG ou WebP.",
  dimensions: "A foto tem dimensões grandes demais.",
  corrupt: "Essa imagem parece corrompida. Tente outra.",
};

const HANDLERS: Record<"upload" | "remove", IntentHandler<PublicUser, object>> = {
  async upload(form, user) {
    const limit = await consumeAttempt(`avatar-upload:${user.id}`, UPLOADS_PER_HOUR, HOUR_MS);

    if (limit.limited) {
      return actionReply("upload", 429, tooManyAttemptsMessage(limit.retryAfterSeconds));
    }

    const image = await readUploadedImage(form, "photo", LIMITS);

    if (!image.ok) {
      return actionReply("upload", image.status, UPLOAD_ERRORS[image.reason]);
    }

    await saveAvatar(user.id, image.type, image.bytes);

    return actionReply("upload", 200, "Foto de perfil atualizada.");
  },

  async remove(_form, user) {
    await deleteAvatar(user.id);

    return actionReply("remove", 200, "Foto removida.");
  },
};

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);

  return dispatchIntent({ request, handlers: HANDLERS, context: user, label: "foto", maxBytes: LIMITS.maxBytes + 64 * 1024 });
}
