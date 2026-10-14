import { z } from "zod";

import type { ActionResult } from "~/shared/lib/action-result";
import type { InviteCode } from "~/features/auth/types";

export type { InviteCode };

// Tipos e regras do painel admin compartilhados entre servidor e navegador.
export const ADMIN_TABS = ["visao", "usuarios", "prompts", "convite", "marca"] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];

// Ações do painel (campo "intent"); o servidor tem um handler para cada uma.
export const ADMIN_INTENTS = [
  "user-admin",
  "user-disable",
  "user-sessions",
  "user-delete",
  "user-reset",
  "prompt-trash",
  "prompt-restore",
  "prompt-purge",
  "trash-empty",
  "invite-toggle",
  "invite-save",
  "invite-random",
  "invite-reset",
  "logo-upload",
  "logo-remove",
  "favicon-upload",
  "favicon-remove",
] as const;

export type AdminIntent = (typeof ADMIN_INTENTS)[number];

export const INVITE_MIN = 6;
export const INVITE_MAX = 100;

const INVITE_RULE = `Use de ${INVITE_MIN} a ${INVITE_MAX} caracteres, sem espaços.`;

export const inviteCodeSchema = z.object({
  code: z.string({ error: INVITE_RULE }).trim().min(INVITE_MIN, INVITE_RULE).max(INVITE_MAX, INVITE_RULE).regex(/^\S+$/, INVITE_RULE),
});

export type AdminActionData = ActionResult<{ resetPath: string }>;

export type AdminStats = {
  users: number;
  admins: number;
  disabledUsers: number;
  prompts: number;
  promptsLastWeek: number;
  trashed: number;
  copies: number;
  // Pessoas (não sessões) logadas em algum aparelho.
  usersWithActiveSession: number;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  disabled: boolean;
  createdAt: string;
  prompts: number;
  sessions: number;
};

export type AdminPrompt = {
  id: string;
  title: string;
  authorName: string;
  authorEmail: string;
  tags: string[];
  copyCount: number;
  createdAt: string;
  deletedAt: string | null;
};


// O que cada aba do painel recebe do loader: um formato por aba, sem campos opcionais.
export type AdminTabData =
  | { tab: "visao"; stats: AdminStats }
  | { tab: "usuarios"; users: AdminUser[] }
  | { tab: "prompts"; search: string | null; prompts: AdminPrompt[]; trash: AdminPrompt[] }
  | { tab: "convite"; invite: InviteCode; inviteRequired: boolean }
  | { tab: "marca" };
