import { Plus } from "lucide-react";
import { Link } from "react-router";

import type { HomeQuery } from "~/features/prompts/list-query";
import type { SessionUser } from "~/features/auth/types";
import { BrandWordmark } from "~/features/brand/components/brand-logo";
import { SearchForm } from "./search-form";
import { ThemeToggle } from "~/features/theme/components/theme-toggle";
import { UserMenu } from "./user-menu";

type NavbarProps = {
  user: SessionUser;
  query: HomeQuery;
  onNewPrompt: () => void;
  onOpenPalette: () => void;
  onEditPhoto: () => void;
  onEditAccount: () => void;
};

export function Navbar({ user, query, onNewPrompt, onOpenPalette, onEditPhoto, onEditAccount }: NavbarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-canvas/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        {/* Em telas estreitas o nome encolhe (e, no limite, corta com reticências) para os
            botões da direita nunca saírem da tela. */}
        <Link
          to="/"
          className="font-display mr-auto inline-flex min-w-0 items-center gap-2 text-xl font-light tracking-tight whitespace-nowrap min-[400px]:gap-2.5 min-[400px]:text-2xl sm:mr-0 sm:shrink-0 md:gap-3 md:text-3xl"
        >
          <BrandWordmark logoClassName="h-7 min-[400px]:h-8 md:h-10" />
        </Link>
        <SearchForm query={query} onOpenPalette={onOpenPalette} className="mx-auto hidden w-full max-w-md min-w-0 sm:block" />
        <button
          type="button"
          onClick={onNewPrompt}
          title="Novo prompt (N)"
          className="inline-flex size-10 shrink-0 items-center justify-center gap-2 rounded-full bg-accent text-base md:w-auto md:px-4 font-medium whitespace-nowrap text-accent-ink transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-ink/20 focus-visible:outline-none"
        >
          <Plus className="size-4" aria-hidden />
          <span className="hidden md:inline">Novo prompt</span>
          <span className="sr-only md:hidden">Novo prompt</span>
        </button>
        <ThemeToggle />
        <UserMenu user={user} query={query} onEditPhoto={onEditPhoto} onEditAccount={onEditAccount} />
      </div>
      <div className="px-4 pb-3 sm:hidden">
        <SearchForm query={query} onOpenPalette={onOpenPalette} className="w-full" />
      </div>
    </header>
  );
}
