# Nelcota Prompts

Mural privado de prompts para você e seus amigos. Só entra quem tem o código de convite.

Stack: **Bun** (runtime, gerenciador de pacotes, `Bun.SQL`, `Bun.password`), React Router v7 (framework mode), PostgreSQL com **Drizzle ORM**, **zod**, Tailwind CSS v4, **Hono** (servidor de produção), **sharp** (imagens), **react-markdown**, **jsdiff**, **cmdk**, **Radix**, **react-easy-crop**, Embla e Sonner. [English](README.md)

## Rodar local

Requisitos: [Bun](https://bun.sh) 1.3 ou mais recente e Docker (para o Postgres).

```sh
# 1. Postgres
docker run -d --name nelcota-prompts-db -p 127.0.0.1:5432:5432 \
  -e POSTGRES_USER=nelcota -e POSTGRES_PASSWORD=nelcota -e POSTGRES_DB=nelcota_prompts \
  postgres:18-alpine

# 2. Variáveis (o Bun carrega o .env sozinho)
cp .env.example .env

# 3. Dependências, banco e seed opcional
bun install
bun run migrate
bun run seed        # cria demo@nelcota.local / demo12345 com alguns prompts

# 4. Dev
bun run dev         # http://localhost:5173
```

Build de produção local: `bun run build && bun run start`. Em produção o cookie de sessão é `Secure`, então o login só persiste em HTTPS (ou em `localhost` no Chrome).

## Scripts

| Script | O que faz |
| --- | --- |
| `bun run dev` | Servidor de desenvolvimento (Vite + React Router) rodando no Bun |
| `bun run build` | Build de produção em `build/`, com `.br`/`.gz` pré-comprimidos (`scripts/precompress.ts`) |
| `bun run start` | `server.ts`: Hono sobre `Bun.serve` (estáticos, compressão, CSRF, headers) + React Router |
| `bun run migrate` | Aplica `migrations/NNN_*.sql` pendentes (controle em `schema_migrations`) |
| `bun run seed` | Seed opcional de demonstração |
| `bun run reset-link email [url]` | Gera um link de redefinição de senha (1 hora, uso único) |
| `bun run make-admin email [--remover]` | Dá (ou tira) acesso ao painel admin em `/admin` |
| `bun run typecheck` | Gera os tipos das rotas e roda o `tsc` |

## Variáveis de ambiente

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | `postgres://usuario:senha@host:5432/banco` |
| `SESSION_SECRET` | Segredo longo e aleatório que assina o cookie de sessão |
| `INVITE_CODE` | Código exigido no cadastro (padrão; o painel admin pode trocar sem redeploy) |
| `PORT` | Porta HTTP do `server.ts` (padrão 3000) |
| `TRUSTED_PROXY` | Opcional. `cloudflare` se houver Cloudflare (proxy ativo) na frente do Coolify |

## Organização do código

Pastas por funcionalidade (cada uma é um "pacote"), não por tipo de arquivo:

```
app/
  routes/        só HTTP: loader, action e página (o React Router exige esta pasta)
  features/
    prompts/     repositório, ações, validação, variáveis, Markdown, diff, URL da lista,
                 cards, slider, grade, prompt aberto, histórico, copiar/favoritar
    home/        casca do mural: navbar, busca, menu da conta, filtros, palette, atalhos
    auth/        sessão, usuários, senha, convite, telas de login/cadastro, "Minha conta"
    profile/     foto de perfil: editor, gestos, processamento e armazenamento
    admin/       painel (uma aba por arquivo), ações e consultas
    brand/       logo (armazenamento e componente)
    theme/       tema claro/escuro
  shared/
    server/      infraestrutura de servidor: banco, env, validação, actions, rate limit, imagem
    lib/         utilitários puros: ids, formatação, storage, navegação por teclado, cópia
    hooks/       hooks genéricos: resultado de fetcher, diálogo modal, origin, localStorage…
    ui/          diálogo, campo, estilos de botão, avatar, mascote, arte gerada
```

Dentro de cada feature: `server/` (arquivos `.server.ts`, só servidor), `components/`, `hooks/` e, na raiz, o que serve aos dois lados (regras, tipos, parsing).

**Regras de dependência** (sem ciclos):

- `shared/` nunca importa `features/`.
- `profile`, `brand` e `theme` só usam `shared`; `auth` usa `profile` e `brand`; `prompts` usa `auth` e `profile`; `home` e `admin` montam as demais. `routes/` fica por cima de tudo.
- Imports: `./arquivo` dentro da mesma pasta; `~/caminho` entre pastas.

Actions com vários `intent` passam por `dispatchIntent` (`shared/server/intent-dispatch.server.ts`): tamanho do corpo, formulário, handler e erro 500 num lugar só; cada rota só declara o mapa de handlers (`PROMPT_HANDLERS`, `ADMIN_HANDLERS`…), tipado pelos nomes de intent compartilhados com a tela. Respostas de action têm um formato só (`ActionResult` + `actionReply`).

## Deploy no Coolify

1. Crie um recurso **PostgreSQL** no Coolify e copie a URL interna de conexão.
2. Crie uma **Application** apontando para o repositório, com build pack **Dockerfile**.
3. Defina `DATABASE_URL`, `SESSION_SECRET`, `INVITE_CODE` e `PORT=3000`; em *Ports Exposes* use `3000`.
4. Healthcheck: caminho `/health`, porta `3000`. A imagem inclui `curl` para o healthcheck do Coolify funcionar (o Dockerfile também declara um `HEALTHCHECK` próprio, feito com Bun).
5. Faça o deploy. O container roda `bun run migrate && bun run start`, então as migrations são aplicadas a cada subida.

A imagem é `oven/bun`, sem Node. O único `node` que existe nela é o symlink de fallback da própria imagem, que aponta para o Bun.

## Como funciona

- **Navegação:** no slider, a roda do mouse (ou o trackpad) passa um prompt por vez; também dá para arrastar ou usar as setas do teclado. Clique no card central para abrir o prompt completo.
- **Permissões:** quem está logado lê tudo. Editar e apagar passam por `action` no servidor, que confere se o usuário é o autor (`403` se não for) e repete o filtro `author_id` no próprio `UPDATE`/`DELETE`.
- **Sessões:** ficam na tabela `sessions`; o cookie assinado carrega só o id. Sair apaga a linha, então um cookie copiado deixa de valer na hora.
- **Limite de tentativas** (rate-limiter-flexible, em memória): login aceita 5 tentativas por email (em cada IP) e 30 por IP a cada 15 min (login certo devolve a tentativa do IP); cadastro (código de convite) 10 por IP por hora; redefinição de senha 20 por IP por hora; senha atual errada em "Minha conta" 5 a cada 15 min; 20 uploads de foto por hora. Conferir e contar é uma operação só. O IP vem do `X-Forwarded-For` só quando a conexão chega pelo proxy da rede interna; com `TRUSTED_PROXY=cloudflare`, o `CF-Connecting-IP` só vale se quem se conectou ao proxy estiver nas faixas publicadas do Cloudflare (cabeçalho forjado direto na origem é ignorado).
- **Headers de segurança:** em produção vão CSP com nonce, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e HSTS. Envios (POST) vindos de outro site são recusados pelo `server.ts` (checagem de `Origin`/`Sec-Fetch-Site`), o que também impede "login CSRF".
- **Paginação:** a página mostra 60 prompts e o botão "Carregar mais" sobe até 600. Para achar os mais antigos, use a busca.
- **Migrations:** `bun run migrate` usa um advisory lock do Postgres, então duas instâncias subindo juntas não aplicam a mesma migration duas vezes.
- **Senhas:** são a única string que não passa por `trim()`, porque espaços nas pontas fazem parte da senha.
- **Performance:** o servidor de produção (Hono) entrega os assets já comprimidos no build (brotli/gzip) e comprime HTML e dados em streaming. A lista manda só os primeiros 280 caracteres de cada prompt; o texto completo vem de `/prompt/:id` quando você abre ou copia. No slider, só os slides perto do centro são animados e têm arte. Abrir/fechar um prompt e trocar slider/grade não recarregam dados do servidor.
- **Por que os cards não têm `border-radius`, sombra nem blur em CSS:** dentro do giro 3D do coverflow, o Firefox refaz esses efeitos a cada quadro (o scroll caía para ~20 fps). A arte é desenhada uma vez num canvas, já com os cantos arredondados e o escurecimento, e vira uma imagem comum.
- **Uso:** busca textual enquanto digita (sem acento, por prefixo, com radicais em português e tolerante a erro de digitação no título; ordenada por relevância); filtro por autor (clique no nome); favoritos pelo menu da conta ou pela palette, que também tem "Mais copiados"; cada prompt aberto tem link próprio (`/?p=id`) e o "voltar" do navegador fecha o prompt. Atalhos: `Ctrl/⌘+K` palette, `/` busca, `N` novo prompt, `C` copia o prompt em destaque, `Enter` abre.
- **Command palette (`Ctrl/⌘+K`):** busca no mural inteiro enquanto digita (rota `/busca`); `Enter` abre o prompt, `Ctrl+Enter` copia, e os comandos (novo prompt, favoritos, meus prompts, grade/slider, tema) aparecem junto.
- **Variáveis:** escreva `{tema}`, `{idioma}`… no corpo do prompt, ou `{linguagem=TypeScript}` com valor padrão. Ao copiar, o app pede os valores e copia o texto já preenchido. Os campos já vêm com o último valor que você digitou naquela variável (o padrão de um prompt não vira "último valor" de outro) (guardado no `localStorage` do navegador) ou com o padrão; campo vazio usa o padrão.
- **Markdown** (react-markdown + GFM): títulos, listas, tabelas, listas de tarefas, citações, links e blocos de código; as `{variáveis}` ficam destacadas mesmo dentro de código ou com padrão que tenha sintaxe de Markdown. Não renderiza HTML cru e bloqueia links `javascript:`. O botão "Texto" mostra o original, e a cópia é sempre o texto original.
- **Histórico de versões:** cada edição guarda a versão anterior em `prompt_versions` (salvar sem mudar nada não cria versão). No prompt aberto, o ícone de histórico lista as versões com o diff para a atual; o autor pode restaurar, e a versão atual também vai para o histórico.
- **Apagar com "Desfazer":** apagar manda para a lixeira por 7 dias; o toast oferece "Desfazer". O autor só restaura o que ele mesmo apagou: o que o admin moderou fica na lixeira. Itens mais antigos são removidos de vez.
- **Painel admin (`/admin`):** aparece no menu da conta só para admins; para os outros, a rota responde 404. O primeiro admin é definido no terminal (`bun run make-admin email`, no Coolify pelo Terminal do container); depois, admins promovem outros pelo painel. Abas: **Visão geral** (números do mural), **Usuários** (link de nova senha sem terminal, tornar/remover admin, encerrar sessões, bloquear, que desconecta na hora e impede login, e excluir conta confirmando o email), **Prompts** (buscar e apagar qualquer prompt; lixeira com restaurar, excluir de vez e esvaziar), **Convite** (trocar ou gerar o código; o salvo no painel vale sobre o `INVITE_CODE`) e **Marca** (logo da navbar e das telas de login, com prévia nos dois temas). Ninguém tira o próprio admin, se bloqueia ou se exclui.
- **Logo:** PNG, WebP ou JPG até 1 MB e 2048 px. O servidor recodifica com **sharp** (sai em WebP, até 1024×256, sem metadados nem nada escondido no arquivo); SVG é recusado. Fica na tabela `site_assets` e é servida em `/marca/logo` (pública, porque aparece no login) com cache longo por versão.
- **Conta:** menu → "Minha conta" troca nome e senha (trocar a senha desconecta os outros dispositivos). Esqueceu a senha? Quem administra roda `bun run reset-link email@x https://seu-endereco` (no Coolify, pelo Terminal do container) e manda o link.
- **Foto de perfil:** menu da conta → "Foto de perfil". Depois de escolher a imagem, um editor no navegador (react-easy-crop) permite enquadrar (arrastar, zoom pela barra, roda do mouse, pinça ou teclado, girar 90° e espelhar) e ajustar brilho, contraste, saturação e temperatura, com filtros prontos e prévia nos tamanhos reais. Os ajustes são feitos nos pixels, iguais na prévia e no arquivo. O resultado sai em 256×256 e é salvo já em círculo (WebP com cantos transparentes, ~5–20 KB). O servidor recodifica a imagem com sharp (só JPEG, PNG ou WebP entram; até 512 KB e 1024 px), o que descarta metadados (EXIF/GPS) mesmo de envios feitos sem passar pela tela; a foto fica na tabela `user_avatars` e é servida em `/avatar/:userId` só para quem está logado.
- **Arte dos cards:** é gerada de forma determinística a partir do id do prompt (SVG com turbulência, rasterizado no navegador), então cada prompt sempre tem a mesma arte.

## Licença

[MIT](LICENSE) © Nelcota
