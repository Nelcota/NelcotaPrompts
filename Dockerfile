# Imagem 100% Bun: nada de Node no build nem na execução.
# Versão fixa: builds reproduzíveis (atualize de propósito, não por acaso).
FROM oven/bun:1.4.3 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS prod-deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS runtime
# curl só para o healthcheck do Coolify, que roda curl/wget dentro do container
# (a imagem do Bun não traz nenhum dos dois).
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=3000
COPY package.json bun.lock tsconfig.json server.ts ./
COPY migrations ./migrations
COPY scripts ./scripts
# Os scripts (migrate, reset-link, make-admin, seed) reaproveitam o código do app; os
# imports "~/" são resolvidos pelo tsconfig.json.
COPY app ./app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "const r = await fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health'); process.exit(r.ok ? 0 : 1)"
# Aplica migrations pendentes e sobe o servidor. O exec troca o sh pelo Bun: o SIGTERM
# do Coolify chega direto no servidor e o container para na hora, sem esperar o timeout.
CMD ["sh", "-c", "bun run migrate && exec bun server.ts"]
