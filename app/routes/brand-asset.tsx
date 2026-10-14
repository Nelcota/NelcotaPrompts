import { BRAND_ASSETS, type BrandAsset } from "~/features/brand/brand-rules";
import { loadBrandAsset } from "~/features/brand/server/brand.server";
import { storedImageResponse } from "~/shared/server/stored-image.server";
import type { Route } from "./+types/brand-asset";

function isBrandAsset(value: string): value is BrandAsset {
  return BRAND_ASSETS.some((asset) => asset === value);
}

// Rota de recurso pública (logo e favicon): aparecem também na tela de login, antes de entrar.
export async function loader({ request, params }: Route.LoaderArgs) {
  const image = isBrandAsset(params.asset) ? await loadBrandAsset(params.asset) : null;

  if (image === null) {
    return new Response("Sem imagem.", { status: 404 });
  }

  return storedImageResponse(image, request, "public");
}
