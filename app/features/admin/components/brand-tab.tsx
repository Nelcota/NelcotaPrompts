import { ImageUp, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useObjectUrl } from "~/shared/hooks/use-object-url";
import { MAX_LOGO_BYTES } from "~/features/brand/brand-rules";
import { BrandWordmark, useLogoUrl } from "~/features/brand/components/brand-logo";
import { buttonClass } from "~/shared/ui/styles";
import { Section } from "./admin-ui";
import { useAdminAction } from "~/features/admin/hooks/use-admin-action";
import { cn } from "~/shared/ui/cn";

// Prévia da navbar num tema fixo (.dark/.light redefinem as cores só aqui dentro).
function NavbarPreview({ theme, previewUrl }: { theme: "dark" | "light"; previewUrl: string | null }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-xs text-muted">tema {theme === "dark" ? "escuro" : "claro"}</p>
      <div className={cn(theme, "overflow-hidden rounded-2xl border border-line")}>
        <div className="font-display flex h-16 items-center gap-3 bg-canvas px-4 text-3xl font-light tracking-tight whitespace-nowrap text-ink">
          <BrandWordmark logoClassName="h-10" src={previewUrl} />
        </div>
      </div>
    </div>
  );
}

export function BrandTab() {
  const logoUrl = useLogoUrl();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const previewUrl = useObjectUrl(file);
  const { fetcher, busy, submit } = useAdminAction((result) => {
    // Enviada: a prévia some e a navbar já mostra a logo nova.
    if (result.intent === "logo-upload") {
      setFile(null);

      if (inputRef.current !== null) {
        inputRef.current.value = "";
      }
    }
  });

  return (
    <Section
      title="Logo da navbar"
      description="Aparece na navbar e nas telas de login e cadastro. PNG ou WebP com fundo transparente fica melhor; quadrada ou horizontal, até 1 MB."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <NavbarPreview theme="dark" previewUrl={previewUrl} />
        <NavbarPreview theme="light" previewUrl={previewUrl} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {previewUrl !== null ? "Prévia da imagem escolhida (ainda não salva)." : logoUrl === null ? "Usando a logo padrão (mascote)." : "Usando a logo enviada."}
      </p>

      <fetcher.Form method="post" encType="multipart/form-data" className="mt-5 flex flex-wrap items-center gap-2">
        <input type="hidden" name="intent" value="logo-upload" />
        <input
          ref={inputRef}
          type="file"
          name="logo"
          accept="image/png,image/webp,image/jpeg"
          aria-label="Arquivo da logo"
          onChange={(event) => {
            const chosen = event.target.files?.[0] ?? null;

            if (chosen !== null && chosen.size > MAX_LOGO_BYTES) {
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
          {busy ? "Enviando…" : "Salvar logo"}
        </button>
        {logoUrl === null ? null : (
          <button type="button" disabled={busy} onClick={() => submit("logo-remove")} className={buttonClass("outline", "sm")}>
            <RotateCcw className="size-3.5" aria-hidden />
            Voltar ao padrão
          </button>
        )}
      </fetcher.Form>
    </Section>
  );
}
