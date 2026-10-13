import ipaddr from "ipaddr.js";
import type { AppLoadContext } from "react-router";

// Faixas publicadas pelo Cloudflare (https://www.cloudflare.com/ips/).
const CLOUDFLARE_RANGES = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
].map((range) => ipaddr.parseCIDR(range));

// Endereço normalizado (IPv4 mapeado em IPv6 vira IPv4); null se não for um IP.
function parse(ip: string): ipaddr.IPv4 | ipaddr.IPv6 | null {
  return ipaddr.isValid(ip) ? ipaddr.process(ip) : null;
}

// Rede interna/loopback: é daí que o proxy do Coolify (Traefik) se conecta.
function isInternal(ip: string): boolean {
  const range = parse(ip)?.range();

  return range === "private" || range === "loopback" || range === "uniqueLocal";
}

function isCloudflare(ip: string): boolean {
  const address = parse(ip);

  return address !== null && CLOUDFLARE_RANGES.some(([network, bits]) => address.kind() === network.kind() && address.match(network, bits));
}

// Último salto do X-Forwarded-For: o IP que o proxy da rede interna viu se conectar.
function lastForwardedFor(request: Request): string | null {
  const last = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .at(-1);

  return last ?? null;
}

// Só confia nos cabeçalhos de proxy quando a conexão vem de um proxy da rede interna;
// assim ninguém burla o limite de tentativas forjando X-Forwarded-For direto na porta.
// Atrás do Cloudflare (TRUSTED_PROXY=cloudflare), o CF-Connecting-IP só vale quando
// quem se conectou ao proxy é de fato um servidor do Cloudflare: acessando a origem
// direto, o cabeçalho forjado é ignorado.
export function getClientIp(request: Request, context: AppLoadContext | undefined): string {
  const socketIp = context?.clientIp;

  // No dev do Vite não há IP do socket: usa o cabeçalho, se houver.
  if (socketIp === undefined || socketIp === "") {
    return lastForwardedFor(request) ?? "desconhecido";
  }

  if (!isInternal(socketIp)) {
    return socketIp;
  }

  const proxiedIp = lastForwardedFor(request) ?? socketIp;
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();

  if (process.env.TRUSTED_PROXY?.trim() === "cloudflare" && cloudflareIp && isCloudflare(proxiedIp)) {
    return cloudflareIp;
  }

  return proxiedIp;
}
