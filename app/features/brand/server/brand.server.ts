import { eq } from "drizzle-orm";

import type { BrandAsset } from "~/features/brand/brand-rules";
import { getDb } from "~/shared/server/db.server";
import { siteAssets } from "~/shared/server/db/schema";
import type { ImageType } from "~/shared/server/image.server";
import { type StoredImage, versionedUrl } from "~/shared/server/stored-image.server";

// Logo da navbar e favicon (tabela site_assets, uma linha por imagem). O root loader roda em
// toda navegação, então a versão fica em memória (uma instância só) e é atualizada aqui
// quando o painel troca a imagem.

type AssetCache = {
  // undefined = ainda não consultado; null = sem imagem personalizada.
  updatedAt: Date | null | undefined;
  // Conta trocas: uma leitura que começou antes de uma troca não sobrescreve o valor novo
  // com o antigo.
  generation: number;
};

declare global {
  var __nelcotaBrandAssets: Map<BrandAsset, AssetCache> | undefined;
}

function cacheOf(asset: BrandAsset): AssetCache {
  globalThis.__nelcotaBrandAssets ??= new Map();
  let cache = globalThis.__nelcotaBrandAssets.get(asset);

  if (cache === undefined) {
    cache = { updatedAt: undefined, generation: 0 };
    globalThis.__nelcotaBrandAssets.set(asset, cache);
  }

  return cache;
}

function bumpGeneration(asset: BrandAsset, updatedAt: Date | null) {
  const cache = cacheOf(asset);
  cache.generation += 1;
  cache.updatedAt = updatedAt;
}

export async function getBrandAssetUrl(asset: BrandAsset): Promise<string | null> {
  const cache = cacheOf(asset);

  if (cache.updatedAt === undefined) {
    const generation = cache.generation;
    const [row] = await getDb().select({ updatedAt: siteAssets.updatedAt }).from(siteAssets).where(eq(siteAssets.key, asset));

    if (cache.generation === generation && cache.updatedAt === undefined) {
      cache.updatedAt = row?.updatedAt ?? null;
    }
  }

  return versionedUrl(`/marca/${asset}`, cache.updatedAt ?? null);
}

export async function saveBrandAsset(asset: BrandAsset, type: ImageType, bytes: Uint8Array) {
  const values = { contentType: type, data: bytes, byteSize: bytes.byteLength, updatedAt: new Date() };
  const [row] = await getDb()
    .insert(siteAssets)
    .values({ key: asset, ...values })
    .onConflictDoUpdate({ target: siteAssets.key, set: values })
    .returning({ updatedAt: siteAssets.updatedAt });
  bumpGeneration(asset, row?.updatedAt ?? null);
}

export async function deleteBrandAsset(asset: BrandAsset) {
  await getDb().delete(siteAssets).where(eq(siteAssets.key, asset));
  bumpGeneration(asset, null);
}

export async function loadBrandAsset(asset: BrandAsset): Promise<StoredImage | null> {
  const [row] = await getDb()
    .select({ contentType: siteAssets.contentType, data: siteAssets.data, updatedAt: siteAssets.updatedAt })
    .from(siteAssets)
    .where(eq(siteAssets.key, asset));

  return row ?? null;
}
