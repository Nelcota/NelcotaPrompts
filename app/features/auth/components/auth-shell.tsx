import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { Link } from "react-router";

import { BrandWordmark } from "~/features/brand/components/brand-logo";
import { Field as BaseField } from "~/shared/ui/field";
import { useArtImage } from "~/shared/ui/prompt-art";

type AuthShellProps = {
  title: string;
  subtitle: string;
  footer?: { text: string; linkLabel: string; to: string };
  children: React.ReactNode;
};

// Cards da vitrine: mesma arte e mesmo giro 3D do slider da home, parados.
const SHOWCASE = [
  { seed: "vitrine-0", title: "Commit a partir do diff", offset: -2 },
  { seed: "vitrine-6", title: "Testes para esta função", offset: -1 },
  { seed: "vitrine-7", title: "Code review de PR", offset: 0 },
  { seed: "vitrine-5", title: "Debug pelo stack trace", offset: 1 },
  { seed: "vitrine-1", title: "Refactor seguro", offset: 2 },
];

function ShowcaseCard({ seed, title, offset }: { seed: string; title: string; offset: number }) {
  const { ref, src } = useArtImage<HTMLDivElement>(seed, true, "card");
  const distance = Math.abs(offset);
  // Espaçamento suficiente para o título dos cards laterais não ficar atrás do central.
  const transform = `translateX(${offset * 85}%) perspective(1400px) rotateY(${offset * 14}deg) scale(${1 - distance * 0.12})`;
  const background = src === null ? "linear-gradient(160deg, #2a2a2a, #111)" : `url("${src}")`;

  return (
    <div
      ref={ref}
      style={{ transform, zIndex: 10 - distance, opacity: 1 - distance * 0.18, backgroundImage: background, backgroundSize: "100% 100%" }}
      className="absolute flex aspect-[3/4.2] w-[clamp(150px,13vw,210px)] flex-col justify-end rounded-[1.75rem] p-5 text-center text-white"
    >
      <span className="font-display text-xl leading-tight font-light text-balance [text-shadow:0_1px_12px_rgb(0_0_0/0.4)]">{title}</span>
    </div>
  );
}

function Showcase() {
  return (
    <aside aria-hidden className="relative hidden flex-col items-center justify-center overflow-hidden bg-surface/40 lg:flex">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(127_127_127/0.14),transparent_65%)]" />
      <div className="relative flex h-[min(60dvh,360px)] w-full items-center justify-center">
        {SHOWCASE.map((card) => (
          <ShowcaseCard key={card.seed} {...card} />
        ))}
      </div>
    </aside>
  );
}

// Formulário à esquerda; a vitrine à direita só aparece em telas largas.
export function AuthShell({ title, subtitle, footer, children }: AuthShellProps) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="font-display inline-flex items-center gap-2.5 text-2xl font-light tracking-tight">
            <BrandWordmark logoClassName="h-8" />
          </Link>
          <h1 className="font-display mt-10 text-4xl leading-[1.05] font-light tracking-tight text-balance sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-base text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer === undefined ? null : (
            <p className="mt-8 text-base text-muted">
              {footer.text}{" "}
              <Link to={footer.to} className="font-medium text-ink underline-offset-4 hover:underline">
                {footer.linkLabel}
              </Link>
            </p>
          )}
        </div>
      </section>
      <Showcase />
    </main>
  );
}

// Campos das telas de login/cadastro: o campo compartilhado, sobre o fundo da página.
export function Field(props: Omit<ComponentProps<typeof BaseField>, "background">) {
  return <BaseField background="surface" {...props} />;
}

export function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-base font-medium text-accent-ink transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-ink/20 focus-visible:outline-none disabled:opacity-70"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
      {pending ? pendingLabel : label}
    </button>
  );
}

export function FormError({ message }: { message: string | undefined }) {
  if (message === undefined) {
    return null;
  }

  return (
    <p role="alert" className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-base text-danger">
      {message}
    </p>
  );
}
