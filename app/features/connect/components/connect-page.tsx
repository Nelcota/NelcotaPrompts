import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import type { ApiTokenSummary } from "~/features/api-tokens/api-token-rules";
import type { SessionUser } from "~/features/auth/types";
import { BrandWordmark } from "~/features/brand/components/brand-logo";
import { copyText } from "~/shared/lib/copy-text";
import { Avatar } from "~/shared/ui/avatar";
import { cn } from "~/shared/ui/cn";
import { buttonClass } from "~/shared/ui/styles";
import { type ClientGuide, type ClientId, clientGuides, mcpUrl } from "../clients";
import { AppLogo } from "./app-logos";
import { ConnectedApps } from "./connected-apps";
import { ManualToken } from "./manual-token";

function CopyLine({ text, label }: { text: string; label: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-sm break-all">{text}</code>
      <button type="button" onClick={() => void copyText(text, `${label} copiado.`)} className={buttonClass("outline", "sm", "shrink-0 self-start sm:self-auto")}>
        <Copy className="size-4" aria-hidden /> Copiar
      </button>
    </div>
  );
}

function GuidePanel({ guide }: { guide: ClientGuide }) {
  return (
    <div className="space-y-4">
      {guide.install === undefined ? null : (
        <a href={guide.install.href} className={buttonClass("primary")}>
          <ExternalLink className="size-4" aria-hidden /> {guide.install.label}
        </a>
      )}
      {guide.command === undefined ? null : <CopyLine text={guide.command} label="Comando" />}
      <ol className="list-decimal space-y-1.5 pl-5 text-base text-muted marker:text-ink/50">
        {guide.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

// Página "Conectar IA": escolher o app, seguir um ou dois passos e entrar pelo navegador.
export function ConnectPage({ user, tokens, origin }: { user: SessionUser; tokens: ApiTokenSummary[]; origin: string }) {
  const guides = clientGuides(origin);
  const [selected, setSelected] = useState<ClientId>("claude-code");
  const guide = guides.find((candidate) => candidate.id === selected) ?? guides[0];

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="font-display inline-flex shrink-0 items-center gap-2.5 text-2xl font-light tracking-tight whitespace-nowrap">
            <BrandWordmark logoClassName="h-8" hideTextOnMobile />
          </Link>
          <Link
            to="/"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-ink/5 hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar ao mural
          </Link>
          <Avatar name={user.name} url={user.avatarUrl} sizeClassName="size-8" fallbackClassName="bg-ink text-sm text-canvas" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-4 py-8 sm:px-6">
        <section>
          <h1 className="font-display text-4xl font-light tracking-tight">Conectar IA</h1>
          <p className="mt-3 text-base text-muted">
            Ligue seu app de IA ao mural: ele busca, lê e puxa prompts para qualquer projeto, e pode criar e editar os seus. Você entra pelo navegador e
            escolhe o que ele pode fazer; não precisa copiar senha nem token.
          </p>
          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-muted">Endereço do servidor</p>
            <CopyLine text={mcpUrl(origin)} label="Endereço" />
          </div>
        </section>

        <section aria-labelledby="clients-title" className="space-y-4">
          <h2 id="clients-title" className="font-display text-2xl font-light tracking-tight">
            Escolha seu app
          </h2>
          <div role="tablist" aria-label="Apps de IA" className="flex flex-wrap gap-2">
            {guides.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                role="tab"
                aria-selected={candidate.id === selected}
                onClick={() => setSelected(candidate.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                  candidate.id === selected ? "border-ink bg-ink text-canvas" : "border-line text-muted hover:bg-ink/5 hover:text-ink",
                )}
              >
                <AppLogo id={candidate.id} className="size-4 shrink-0" />
                {candidate.label}
              </button>
            ))}
          </div>
          {guide === undefined ? null : (
            <div role="tabpanel" aria-label={guide.label} className="rounded-3xl border border-line p-5 sm:p-6">
              <GuidePanel guide={guide} />
            </div>
          )}
        </section>

        <ConnectedApps tokens={tokens} />

        <ManualToken />
      </main>
    </div>
  );
}
