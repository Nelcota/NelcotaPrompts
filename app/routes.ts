import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("cadastro", "routes/register.tsx"),
  route("sair", "routes/logout.tsx"),
  route("tema", "routes/theme.tsx"),
  route("prompt/:id", "routes/prompt-body.tsx"),
  route("prompt/:id/versoes", "routes/prompt-versions.tsx"),
  route("busca", "routes/search.tsx"),
  route("perfil/foto", "routes/profile-photo.tsx"),
  route("conta", "routes/account.tsx"),
  route("esqueci-senha", "routes/forgot-password.tsx"),
  route("redefinir-senha", "routes/reset-password.tsx"),
  route("avatar/:userId", "routes/avatar.tsx"),
  route("admin", "routes/admin.tsx"),
  route("marca/logo", "routes/brand-logo.tsx"),
  route("health", "routes/health.tsx"),
] satisfies RouteConfig;
