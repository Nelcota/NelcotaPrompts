import type { ReactNode } from "react";
import { cn } from "~/shared/ui/cn";

export function Section({ title, description, children, aside }: { title: string; description?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description === undefined ? null : <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "danger" }) {
  const toneClass = tone === "danger" ? "border-danger/30 text-danger" : "border-line text-muted";

  return <span className={cn("rounded-md border px-1.5 py-0.5 font-mono text-[11px]", toneClass)}>{children}</span>;
}

export const adminInputClass =
  "block w-full rounded-xl border border-line bg-canvas px-3 py-2 text-base outline-none transition focus:border-ink/40 focus:ring-4 focus:ring-ink/5";
