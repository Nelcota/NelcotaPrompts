// Quem está logado, como a interface precisa (menu da conta, autor dos prompts).
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

// Código de convite em vigor e de onde ele vem (painel admin ou variável INVITE_CODE).
// "none": nenhum dos dois configurado; o cadastro fica fechado até o admin definir um.
export type InviteCode = { code: string; source: "painel" | "env" } | { code: null; source: "none" };
