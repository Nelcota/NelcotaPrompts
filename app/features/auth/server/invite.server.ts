import { eq } from "drizzle-orm";

import type { InviteCode } from "~/features/auth/types";
import { getDb } from "~/shared/server/db.server";
import { siteSettings } from "~/shared/server/db/schema";

// Código de convite (tabela site_settings), editável pelo painel admin.
const INVITE_KEY = "invite_code";

// O código salvo pelo painel vale sobre a variável INVITE_CODE (que vira só o padrão).
export async function getInviteCode(): Promise<InviteCode> {
  const [row] = await getDb().select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, INVITE_KEY));
  const saved = row?.value.trim();

  if (saved !== undefined && saved !== "") {
    return { code: saved, source: "painel" };
  }

  const fromEnv = process.env.INVITE_CODE?.trim();

  return fromEnv === undefined || fromEnv === "" ? { code: null, source: "none" } : { code: fromEnv, source: "env" };
}

export async function setInviteCode(code: string) {
  await getDb()
    .insert(siteSettings)
    .values({ key: INVITE_KEY, value: code })
    .onConflictDoUpdate({ target: siteSettings.key, set: { value: code, updatedAt: new Date() } });
}

// Volta a valer a variável INVITE_CODE.
export async function resetInviteCode() {
  await getDb().delete(siteSettings).where(eq(siteSettings.key, INVITE_KEY));
}
