import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";

import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  type ShouldRevalidateFunctionArgs,
  useNavigation,
} from "react-router";
import { Toaster } from "sonner";

import frauncesLatin from "@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2?url";
import geistLatin from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";

import appleTouchIconUrl from "~/assets/mascot/apple-touch-icon.png";
import faviconUrl from "~/assets/mascot/favicon.png";

import { getTheme } from "~/features/theme/server/theme.server";
import { getLogoUrl } from "~/features/brand/server/brand.server";
import { useTheme } from "~/features/theme/theme";
import type { Route } from "./+types/root";
import "./app.css";

// Pré-carrega só os subconjuntos latinos das fontes vistas logo de cara (títulos e texto),
// evitando a troca visível de fonte; o resto continua sob demanda via unicode-range.
export const links: Route.LinksFunction = () => [
  { rel: "preload", href: frauncesLatin, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
  { rel: "preload", href: geistLatin, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
];

export async function loader({ request }: Route.LoaderArgs) {
  return { theme: await getTheme(request), logoUrl: await getLogoUrl() };
}

// Tema e logo só mudam por ação (POST): navegar na mesma página trocando só a URL (abrir
// um prompt, slider/grade, filtros) não precisa recarregar estes dados.
export function shouldRevalidate({ currentUrl, nextUrl, formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod === undefined && currentUrl.pathname === nextUrl.pathname) {
    return false;
  }

  return defaultShouldRevalidate;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useTheme();

  return (
    <html lang="pt-BR" className={theme === "dark" ? "dark" : ""}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content={theme} />
        <link rel="icon" type="image/png" href={faviconUrl} />
        <link rel="apple-touch-icon" href={appleTouchIconUrl} />
        <Meta />
        <Links />
      </head>
      <body className="min-h-dvh">
        {children}
        <Toaster theme={theme} position="bottom-center" />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Barra fina no topo enquanto a página carrega dados (troca de filtro, busca, paginação).
// Só aparece se demorar mais que 150 ms, para não piscar em respostas rápidas.
function NavigationProgress() {
  const navigation = useNavigation();
  const loading = navigation.state === "loading";

  return (
    <div
      aria-hidden
      data-loading={loading}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left scale-x-0 bg-ink opacity-0 transition-[transform,opacity] duration-300 data-[loading=true]:scale-x-90 data-[loading=true]:opacity-100 data-[loading=true]:delay-150 data-[loading=true]:duration-[2000ms]"
    />
  );
}

export default function App() {
  return (
    <>
      <NavigationProgress />
      <Outlet />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  const title = isNotFound ? "Página não encontrada" : "Algo deu errado";
  const details = isNotFound
    ? "O endereço que você abriu não existe."
    : "Tente novamente. Se persistir, avise um admin.";

  if (!isRouteErrorResponse(error)) {
    console.error(error);
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-5xl font-light tracking-tight">{title}</h1>
        <p className="mt-4 text-muted">{details}</p>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-full bg-accent px-5 py-2.5 text-base font-medium text-accent-ink"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
