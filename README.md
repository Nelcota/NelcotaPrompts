<div align="center">

<img src="app/assets/mascot/badge.webp" width="72" alt="" />

# Nelcota Prompts

**A private prompt library for developers.**
Write a prompt once, share it with your team, copy it with the blanks already filled in.

[![Bun](https://img.shields.io/badge/Bun-1.4-000?logo=bun&logoColor=fff)](https://bun.sh)
[![React Router](https://img.shields.io/badge/React_Router-7-CA4245?logo=reactrouter&logoColor=fff)](https://reactrouter.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17+-4169E1?logo=postgresql&logoColor=fff)](https://www.postgresql.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=fff)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey)](LICENSE)

[Português](README.pt-BR.md)

</div>

---

## Features

|  |  |
|---|---|
| **⌘K command palette** | Search the whole library as you type, open with <kbd>Enter</kbd>, copy with <kbd>Ctrl</kbd>+<kbd>Enter</kbd>. |
| **Variables with defaults** | Write `{language=TypeScript}` in a prompt; copying asks for the values, pre-filled with the default or the last value you used. |
| **Markdown** | Headings, lists, tables, task lists and fenced code render on read. Copy always uses the raw text. |
| **Version history** | Every edit keeps the previous version. See a word-level diff and restore any of them. |
| **Full-text search** | Accent-insensitive Portuguese search with stemming, prefix matching while you type and typo tolerance on titles. |
| **Favorites & most copied** | Star prompts, sort by copy count, filter by author. |
| **Trash with undo** | Deleting is reversible for 7 days. |
| **Profile photos** | In-browser editor: crop, zoom, rotate, flip, brightness, contrast, saturation, temperature and presets. |
| **Admin panel** | Users (reset links, admin role, sessions, block, delete), moderation and trash, invite toggle and code, logo. |
| **Keyboard first** | <kbd>⌘K</kbd> palette · <kbd>/</kbd> search · <kbd>N</kbd> new prompt · <kbd>C</kbd> copy · <kbd>Enter</kbd> open. |

## Stack

| Layer | Tools |
|---|---|
| Runtime | [Bun](https://bun.sh): runtime, package manager, `Bun.SQL`, `Bun.password` |
| App | [React Router 7](https://reactrouter.com) (framework mode) · React 19 |
| Data | PostgreSQL · [Drizzle ORM](https://orm.drizzle.team) · plain SQL migrations |
| Validation | [Zod](https://zod.dev): the same schemas run in the browser and on the server |
| UI | [Tailwind CSS 4](https://tailwindcss.com) · [cmdk](https://cmdk.paco.me) · [Radix](https://www.radix-ui.com) · [Embla](https://www.embla-carousel.com) · [Sonner](https://sonner.emilkowal.ski) · [Lucide](https://lucide.dev) |
| Content | [react-markdown](https://github.com/remarkjs/react-markdown) + GFM · [jsdiff](https://github.com/kpdecker/jsdiff) · [react-easy-crop](https://github.com/ValentinH/react-easy-crop) |
| Server | [Hono](https://hono.dev) on `Bun.serve` · [sharp](https://sharp.pixelplumbing.com) · [rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible) |

## Quick start

Requires **Bun 1.3+** and **Docker** (for Postgres).

```sh
# 1. Postgres
docker run -d --name nelcota-prompts-db -p 127.0.0.1:5432:5432 \
  -e POSTGRES_USER=nelcota -e POSTGRES_PASSWORD=nelcota -e POSTGRES_DB=nelcota_prompts \
  postgres:18-alpine

# 2. Environment (Bun loads .env automatically)
cp .env.example .env

# 3. Install, migrate and seed
bun install
bun run migrate
bun run seed          # demo@nelcota.local / demo12345, with a few prompts

# 4. Make yourself an admin and start
bun run make-admin demo@nelcota.local
bun run dev           # http://localhost:5173
```

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Development server (Vite + React Router on Bun) |
| `bun run build` | Production build in `build/`, with pre-compressed `.br`/`.gz` assets |
| `bun run start` | Production server (`server.ts`) |
| `bun run typecheck` | Route type generation + `tsc` |
| `bun run migrate` | Apply pending `migrations/NNN_*.sql` (advisory-locked, safe with parallel boots) |
| `bun run seed` | Optional demo account and prompts. Never run it in production |
| `bun run make-admin <email> [--remover]` | Grant (or revoke) access to `/admin` |
| `bun run reset-link <email> [url]` | One-time password reset link, valid for 1 hour |

## Configuration

| Variable | Required | Description |
|---|:---:|---|
| `DATABASE_URL` | ✓ | `postgres://user:password@host:5432/database` |
| `SESSION_SECRET` | ✓ | Long random string that signs the session cookie |
| `INVITE_CODE` |  | Default sign-up code, used when the admin panel requires an invite. The panel can also set or rotate it at runtime |
| `PORT` |  | Port for `server.ts` (default `3000`) |
| `APP_URL` |  | Public address (`https://prompts.example.com`), shown in the startup log and used by `reset-link`. On Coolify it defaults to the app's domain |
| `TRUSTED_PROXY` |  | Set to `cloudflare` when Cloudflare proxies the app, so the client IP comes from `CF-Connecting-IP` |

Generate a secret with:

```sh
bun -e "console.log(crypto.randomUUID() + crypto.randomUUID())"
```

## Project structure

Organized by feature. Each feature has `server/` (server-only `*.server.ts`), `components/`, `hooks/`, and shared rules and types at its root.

```
app/
├── routes/            HTTP only: loaders, actions, pages
├── features/
│   ├── prompts/       repository, actions, search, variables, markdown, diff, cards, history
│   ├── home/          page shell: navbar, search, user menu, filters, palette, shortcuts
│   ├── auth/          sessions, users, passwords, invite code, sign-in screens
│   ├── profile/       profile photo editor and storage
│   ├── admin/         admin panel, actions and queries
│   ├── brand/         logo
│   └── theme/         light / dark theme
└── shared/
    ├── server/        database, schema, validation, actions, rate limiting, images
    ├── lib/           pure utilities
    ├── hooks/         generic React hooks
    └── ui/            dialog, fields, buttons, avatar
```

Dependencies only point one way (`shared` → `profile` · `brand` · `theme` → `auth` → `prompts` → `home` · `admin` → `routes`), and `shared/` never imports a feature.

## Deployment

The `Dockerfile` builds a Bun-only image (no Node). On start it runs pending migrations, then the server.

**Coolify**

1. Create a **PostgreSQL** resource and copy its internal connection URL.
2. Create an **Application** from this repository with the **Dockerfile** build pack.
3. Set `DATABASE_URL`, `SESSION_SECRET`, `INVITE_CODE` (optional), `APP_URL` and `PORT=3000`; expose port `3000`.
4. Health check: path `/health`, port `3000`.
5. Deploy, then open the container terminal once and run `bun run make-admin you@example.com`.

The session cookie is `Secure` in production, so sign-in persists only over HTTPS.

## Security

- **Optional invite code**: sign-up is open by default; one switch in the admin panel requires a code (rotatable without a redeploy).
- **Server-side sessions** in Postgres: signing out, blocking a user or changing a password revokes them immediately.
- **CSRF**: form submissions are accepted only from the same origin (`Origin` / `Sec-Fetch-Site`).
- **CSP** with a per-request nonce, HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **Rate limits** on sign-in, sign-up, password reset, password change and uploads. Behind Cloudflare, `CF-Connecting-IP` is trusted only when the connection really comes from Cloudflare's published ranges.
- **Uploads are re-encoded** with sharp: metadata (EXIF/GPS) and anything hidden in the file are dropped; SVG is rejected.
- **Markdown never renders raw HTML**, and `javascript:` links are blocked.
- Images are served from the app only to signed-in users (avatars) with a sandboxing CSP.

## How it works

- **Lean list.** The list sends only the first 280 characters of each prompt; the full body is fetched when you open or copy it.
- **Coverflow without per-frame effects.** Card art is generated from the prompt id as SVG, rasterized once in the browser. No CSS radius, shadow or blur inside the 3D transform, which keeps scrolling smooth in Firefox.
- **One query for every list.** The library, the palette and direct links share a single typed query; search adds a weighted `tsvector` (title › tags › body) plus trigram similarity.
- **Optimistic, but honest.** Favorites flip instantly; deletes go to the trash and the toast offers *Undo*. Authors can only restore what they deleted themselves, so admin moderation sticks.
- **URL as state.** Filters, view and the open prompt live in the URL: links are shareable and the Back button closes an open prompt.
- **Single instance by design.** Rate limits and the logo cache live in memory. To run several replicas, swap the limiter store for Postgres or Redis in `shared/server/rate-limit.server.ts`.

## License

[MIT](LICENSE) © Nelcota

---

<div align="center">
<sub>Built with Bun · React Router · PostgreSQL</sub>
</div>
