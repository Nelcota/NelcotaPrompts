import { ImageUp, RotateCcw, X } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";

import defaultFaviconUrl from "~/assets/mascot/favicon.png";
import { useObjectUrl } from "~/shared/hooks/use-object-url";
import { type BrandAsset, MAX_BRAND_IMAGE_BYTES } from "~/features/brand/brand-rules";
import { BrandWordmark, useFaviconUrl, useLogoUrl } from "~/features/brand/components/brand-logo";
import { buttonClass } from "~/shared/ui/styles";
import { Section } from "./admin-ui";
import type { AdminIntent } from "~/features/admin/admin-rules";
import { useAdminAction } from "~/features/admin/hooks/use-admin-action";
import { cn } from "~/shared/ui/cn";

type Theme = "dark" | "light";

const THEMES: Theme[] = ["dark", "light"];

// Prévia num tema fixo (.dark/.light redefinem as cores só aqui dentro).
function ThemePreview({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-xs text-muted">tema {theme === "dark" ? "escuro" : "claro"}</p>
      <div className={cn(theme, "overflow-hidden rounded-2xl border border-line")}>{children}</div>
    </div>
  );
}

function NavbarPreview({ previewUrl }: { previewUrl: string | null }) {
  return (
    <div className="font-display flex h-16 items-center gap-2.5 bg-canvas px-4 text-2xl font-light tracking-tight whitespace-nowrap text-ink sm:gap-3 sm:text-3xl">
      <BrandWordmark logoClassName="h-8 sm:h-10" src={previewUrl} />
    </div>
  );
}

// Aba do navegador com o favicon em 16 px (o tamanho real na aba).
function BrowserTabPreview({ iconUrl }: { iconUrl: string }) {
  return (
    <div className="bg-surface px-3 pt-2.5">
      <div className="flex max-w-56 items-center gap-2 rounded-t-lg bg-canvas px-3 py-2 text-[13px] text-ink">
        <img src={iconUrl} alt="" aria-hidden className="size-4 shrink-0 rounded-[3px] object-contain" />
        <span className="truncate">Nelcota Prompts</span>
        <X aria-hidden className="ml-auto size-3.5 shrink-0 text-muted" />
      </div>
    </div>
  );
}

type BrandImageFormProps = {
  asset: BrandAsset;
  // Imagem atual enviada pelo painel; null = padrão.
  currentUrl: string | null;
  label: string;
  // Rótulo do campo de arquivo para leitores de tela (com o gênero certo).
  fileLabel: string;
  // Prévia (mostrada nos dois temas) com a imagem escolhida, ainda não salva, ou null para a atual.
  preview: (previewUrl: string | null) => ReactNode;
  statusText: { custom: string; fallback: string };
};

// Escolher, pré-visualizar, salvar e voltar ao padrão: o mesmo fluxo para logo e favicon.
function BrandImageForm({ asset, currentUrl, label, fileLabel, preview, statusText }: BrandImageFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const previewUrl = useObjectUrl(file);
  const uploadIntent = `${asset}-upload` satisfies AdminIntent;
  const removeIntent = `${asset}-remove` satisfies AdminIntent;
  const { fetcher, busy, submit } = useAdminAction((result) => {
    // Enviada: a prévia some e o site já mostra a imagem nova.
    if (result.intent === uploadIntent) {
      setFile(null);

      if (inputRef.current !== null) {
        inputRef.current.value = "";
      }
    }
  });

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {THEMES.map((theme) => (
          <ThemePreview key={theme} theme={theme}>
            {preview(previewUrl)}
          </ThemePreview>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        {previewUrl !== null ? "Prévia da imagem escolhida (ainda não salva)." : currentUrl === null ? statusText.fallback : statusText.custom}
      </p>

      <fetcher.Form method="post" encType="multipart/form-data" className="mt-5 flex flex-wrap items-center gap-2">
        <input type="hidden" name="intent" value={uploadIntent} />
        <input
          ref={inputRef}
          type="file"
          name={asset}
          accept="image/png,image/webp,image/jpeg"
          aria-label={fileLabel}
          onChange={(event) => {
            const chosen = event.target.files?.[0] ?? null;

            if (chosen !== null && chosen.size > MAX_BRAND_IMAGE_BYTES) {
              toast.error("A imagem passa de 1 MB.");
              event.target.value = "";
              setFile(null);

              return;
            }

            setFile(chosen);
          }}
          className="block max-w-full text-sm text-muted file:mr-3 file:rounded-full file:border file:border-line file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-ink/5"
        />
        <button type="submit" disabled={busy || file === null} className={buttonClass("primary", "sm")}>
          <ImageUp className="size-4" aria-hidden />
          {busy ? "Enviando…" : `Salvar ${label}`}
        </button>
        {currentUrl === null ? null : (
          <button type="button" disabled={busy} onClick={() => submit(removeIntent)} className={buttonClass("outline", "sm")}>
            <RotateCcw className="size-3.5" aria-hidden />
            Voltar ao padrão
          </button>
        )}
      </fetcher.Form>
    </>
  );
}

export function BrandTab() {
  const logoUrl = useLogoUrl();
  const faviconUrl = useFaviconUrl();

  return (
    <div className="space-y-6">
      <Section
        title="Logo da navbar"
        description="Aparece na navbar e nas telas de login e cadastro. PNG ou WebP com fundo transparente fica melhor; quadrada ou horizontal, até 1 MB."
      >
        <BrandImageForm
          asset="logo"
          currentUrl={logoUrl}
          label="logo"
          fileLabel="Arquivo da logo"
          preview={(previewUrl) => <NavbarPreview previewUrl={previewUrl} />}
          statusText={{ custom: "Usando a logo enviada.", fallback: "Usando a logo padrão (mascote)." }}
        />
      </Section>
      <Section
        title="Favicon"
        description="O ícone da aba do navegador e dos favoritos. Use uma imagem quadrada e simples, que se leia em 16 px; PNG ou WebP com fundo transparente, até 1 MB. Imagens retangulares são centralizadas num quadrado transparente."
      >
        <BrandImageForm
          asset="favicon"
          currentUrl={faviconUrl}
          label="favicon"
          fileLabel="Arquivo do favicon"
          preview={(previewUrl) => <BrowserTabPreview iconUrl={previewUrl ?? faviconUrl ?? defaultFaviconUrl} />}
          statusText={{ custom: "Usando o favicon enviado.", fallback: "Usando o favicon padrão (mascote)." }}
        />
      </Section>
    </div>
  );
}
