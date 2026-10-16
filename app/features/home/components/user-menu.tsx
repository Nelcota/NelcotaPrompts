import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Camera, FileText, LogOut, Plug, ShieldCheck, Star, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useSubmit } from "react-router";

import type { SessionUser } from "~/features/auth/types";
import { type HomeQuery, shortcutHref } from "~/features/prompts/list-query";
import { Avatar } from "~/shared/ui/avatar";
import { cn } from "~/shared/ui/cn";
import { menuContentClass, menuIconClass, menuItemClass } from "~/shared/ui/styles";

type UserMenuProps = {
  user: SessionUser;
  query: HomeQuery;
  onEditPhoto: () => void;
  onEditAccount: () => void;
};

const menuItem = menuItemClass;
const menuIcon = menuIconClass;
const separator = "my-1.5 h-px bg-line";

// Menu da conta (Radix DropdownMenu): setas, letra inicial, Esc devolvendo o foco ao
// avatar, clique fora e posicionamento ficam por conta da biblioteca.
export function UserMenu({ user, query, onEditPhoto, onEditAccount }: UserMenuProps) {
  const submit = useSubmit();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu.Root modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger
        aria-label="Menu da conta"
        className="grid size-10 shrink-0 place-items-center rounded-full ring-line transition outline-none hover:ring-4 focus-visible:ring-4 data-[state=open]:ring-4"
      >
        <Avatar name={user.name} url={user.avatarUrl} sizeClassName="size-10" fallbackClassName="bg-ink text-base text-canvas" />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          aria-label="Conta"
          // Padrão de menu (WAI-ARIA): Tab fecha e segue para o próximo elemento da página.
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              setOpen(false);
            }
          }}
          className={cn(menuContentClass, "w-64")}
        >
          <div className="flex items-center gap-3 px-3 pt-2.5 pb-3">
            <Avatar name={user.name} url={user.avatarUrl} sizeClassName="size-10" fallbackClassName="bg-ink/10 text-sm text-ink" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium">{user.name}</p>
              <p className="truncate font-mono text-xs text-muted">{user.email}</p>
            </div>
          </div>

          <DropdownMenu.Separator className={separator} />
          <DropdownMenu.Item asChild className={menuItem}>
            <Link to={shortcutHref(query, { authorId: user.id })}>
              <FileText className={menuIcon} aria-hidden />
              Meus prompts
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={menuItem}>
            <Link to={shortcutHref(query, { favorites: true })}>
              <Star className={menuIcon} aria-hidden />
              Favoritos
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className={separator} />
          <DropdownMenu.Item onSelect={onEditPhoto} className={menuItem}>
            <Camera className={menuIcon} aria-hidden />
            Foto de perfil
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={onEditAccount} className={menuItem}>
            <UserRound className={menuIcon} aria-hidden />
            Minha conta
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={menuItem}>
            <Link to="/conectar">
              <Plug className={menuIcon} aria-hidden />
              Conectar IA
            </Link>
          </DropdownMenu.Item>
          {user.isAdmin ? (
            <DropdownMenu.Item asChild className={menuItem}>
              <Link to="/admin">
                <ShieldCheck className={menuIcon} aria-hidden />
                Painel admin
              </Link>
            </DropdownMenu.Item>
          ) : null}

          <DropdownMenu.Separator className={separator} />
          <DropdownMenu.Item
            onSelect={() => void submit(null, { method: "post", action: "/sair" })}
            className={cn(menuItem, "group data-[highlighted]:bg-danger/10 data-[highlighted]:text-danger")}
          >
            <LogOut className={cn(menuIcon, "group-data-[highlighted]:text-danger")} aria-hidden />
            Sair
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
