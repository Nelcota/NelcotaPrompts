import "react-router";

declare module "react-router" {
  interface AppLoadContext {
    // Preenchido pelo server.ts em produção; ausente no dev do Vite.
    clientIp?: string;
  }
}
