import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./cn";

// Estilos compartilhados de botões e campos, com variantes tipadas (cva). Para ajustar
// num lugar só, passe classes extras: cn() resolve conflitos (a classe extra vence).

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:outline-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-ink hover:opacity-90",
        outline: "border border-line text-ink hover:bg-ink/5",
        ghost: "text-muted hover:bg-ink/5 hover:text-ink",
        danger: "border border-danger/30 text-danger hover:bg-danger/10",
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-5 py-2.5 text-base",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export type ButtonVariants = VariantProps<typeof button>;

export function buttonClass(variant: ButtonVariants["variant"], size: ButtonVariants["size"] = "md", extra?: string): string {
  return cn(button({ variant, size }), extra);
}

// Botão redondo só com ícone (o texto vai em aria-label/title).
const iconButton = cva(
  "grid shrink-0 place-items-center rounded-full border border-line text-muted transition hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:outline-none disabled:opacity-50",
  {
    variants: {
      size: { sm: "size-9", md: "size-10", lg: "size-11" },
      tone: {
        neutral: "",
        danger: "hover:border-danger/40 hover:bg-danger/10 hover:text-danger",
      },
    },
    defaultVariants: { size: "md", tone: "neutral" },
  },
);

export function iconButtonClass(options: VariantProps<typeof iconButton> = {}, extra?: string): string {
  return cn(iconButton(options), extra);
}

// Campo sobre o fundo do diálogo ("canvas") ou da página ("surface").
const input = cva(
  "block w-full rounded-2xl border border-line px-4 py-3 text-base outline-none transition placeholder:text-muted/70 focus:border-ink/40 focus:ring-4 focus:ring-ink/5 aria-invalid:border-danger/60",
  { variants: { background: { canvas: "bg-canvas", surface: "bg-surface" } }, defaultVariants: { background: "canvas" } },
);

export function inputClass(background: "canvas" | "surface" = "canvas", extra?: string): string {
  return cn(input({ background }), extra);
}

export const labelClass = "text-sm font-medium tracking-wide text-muted uppercase";

// Destaque das {variáveis} no texto e nos chips.
export const variableMarkClass = "rounded bg-amber-300/25 px-0.5 text-ink";

// Menus suspensos (Radix DropdownMenu): caixa, item e ícone. A largura fica com quem usa.
export const menuContentClass =
  "menu-pop z-50 origin-(--radix-dropdown-menu-content-transform-origin) rounded-2xl border border-line bg-elevated p-1.5 text-ink shadow-2xl shadow-black/40";
export const menuItemClass =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[15px] text-ink outline-none transition select-none data-[highlighted]:bg-ink/8";
export const menuIconClass = "size-4 shrink-0 text-muted";
