import { eq } from "drizzle-orm";

import { getDb } from "~/shared/server/db.server";
import { siteAssets } from "~/shared/server/db/schema";
import type { ImageType } from "~/shared/server/image.server";
import { type StoredImage, versionedUrl } from "~/shared/server/stored-image.server";

// Logo da navbar (tabela site_assets). O root loader roda em toda navegação, então a
// versão fica em memória (uma instância só) e é atualizada aqui quando o painel troca a logo.
const LOGO_KEY = "logo";

declare global {
  // undefined = ainda não consultado; null = sem logo personalizada.
  var __nelcotaLogoUpdatedAt: Date | null | undefined;
  // Conta trocas da logo: uma leitura que começou antes de uma troca não sobrescreve o
  // valor novo com o antigo.
  var __nelcotaLogoGeneration: number | undefined;
}

function bumpGeneration(updatedAt: Date | null) {
  globalThis.__nelcotaLogoGeneration = (globalThis.__nelcotaLogoGeneration ?? 0) + 1;
  globalThis.__nelcotaLogoUpdatedAt = updatedAt;
}

export async function getLogoUrl(): Promise<string | null> {
  if (globalThis.__nelcotaLogoUpdatedAt === undefined) {
    const generation = globalThis.__nelcotaLogoGeneration ?? 0;
    const [row] = await getDb().select({ updatedAt: siteAssets.updatedAt }).from(siteAssets).where(eq(siteAssets.key, LOGO_KEY));

    if ((globalThis.__nelcotaLogoGeneration ?? 0) === generation && globalThis.__nelcotaLogoUpdatedAt === undefined) {
      globalThis.__nelcotaLogoUpdatedAt = row?.updatedAt ?? null;
    }
  }

  return versionedUrl("/marca/logo", globalThis.__nelcotaLogoUpdatedAt ?? null);
}

export async function saveLogo(type: ImageType, bytes: Uint8Array) {
  const values = { contentType: type, data: bytes, byteSize: bytes.byteLength, updatedAt: new Date() };
  const [row] = await getDb()
    .insert(siteAssets)
    .values({ key: LOGO_KEY, ...values })
    .onConflictDoUpdate({ target: siteAssets.key, set: values })
    .returning({ updatedAt: siteAssets.updatedAt });
  bumpGeneration(row?.updatedAt ?? null);
}

export async function deleteLogo() {
  await getDb().delete(siteAssets).where(eq(siteAssets.key, LOGO_KEY));
  bumpGeneration(null);
}

export async function loadLogo(): Promise<StoredImage | null> {
  const [row] = await getDb()
    .select({ contentType: siteAssets.contentType, data: siteAssets.data, updatedAt: siteAssets.updatedAt })
    .from(siteAssets)
    .where(eq(siteAssets.key, LOGO_KEY));

  return row ?? null;
}
