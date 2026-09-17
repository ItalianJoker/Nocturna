# Nocturna

**Chi dorme non sopravvive.** / **Who sleeps does not survive.**

Mobile-first social deduction webapp with a data-driven night narrator, anti-leaking sensory protocol, and dual Host modes (`AUTOMATED` / `ASSISTED`).

Original folklore-inspired naming (Villaggio / Ombre / Neutrali). No trademarked commercial titles or art.

UI languages: **Italian + English** (i18next; preference persisted).

---

## Quickstart & Setup

```bash
# Requires Node.js >= 20
npm install
npm run build:shared
npm test                 # shared regression suite (node:test via tsx)
npm run typecheck
npm run build            # shared + server + client
npm run dev              # server watch + Vite SPA (:5173 → :3001)
# or production-style:
npm start                # node server/dist (serves SPA + API on PORT)
```

Health: `GET /api/health` · Advertise: `GET /api/host-info`

See [CHANGELOG.md](./CHANGELOG.md) for release history. Ops details: [MANUAL.md](./MANUAL.md).

---

## Hard constraints

### Extreme mobile responsiveness
Playable on phones (~360–430px+), tablets, small laptops: fluid type, ≥44px targets, safe-area insets, no horizontal scroll. Desktop (`lg`+) widens Host/Master panes without breaking mouse-wheel scroll. QR join must work on constrained mobile browsers.

### Never localhost in QR / join links
- Server binds `0.0.0.0` by default.
- `/api/host-info` returns a **LAN advertise base** (`http://<lan-ip>:<port>`).
- Lobby QR and copy-link use that base — **never** `localhost`, `127.0.0.1`, or `::1`.
- If only loopback is available, the UI **fails loud** (no useless QR) until Wi‑Fi is up or Host sets an advertise override.
- Override: env `ADVERTISE_HOST` / `ADVERTISE_BASE`, CLI `--advertise-host`, or portable Host UI field.

### Configurable server port
Default **3001**. Change via:
| Mechanism | Example |
|-----------|---------|
| Env | `PORT=8080` |
| CLI | `node server/dist/index.js --port 8080` |
| Docker Compose | `NOCTURNA_PORT=8080 docker compose up --build` |
| Portable Host UI | Port field → Apply & restart |

QR / join URLs always include the configured port with the LAN IP.

### Full i18n (IT / EN)
Locale files: `client/src/locales/it.json`, `client/src/locales/en.json`. Language switcher in SPA; Host console has IT/EN toggles. Default: browser `it*` → Italian, else English.

---

## Dependencies & Libraries Stack

Versions are ranges from workspace `package.json` files (exact resolved versions live in the lockfile). Prefer **named / granular imports** where libraries support tree-shaking (`lucide-react` icons, shared barrel only at boundaries).

| Package | Version | Scope | Purpose | Tree-shaking / import notes |
|---------|---------|-------|---------|-----------------------------|
| `@nocturna/shared` | `*` (workspace) | runtime (server, client) | Types, night engine, sanitize, LAN advertise, socket contract | Single ESM barrel `packages/shared/src/index.ts` |
| `fastify` | `^5.2.1` | runtime (server) | HTTP API + static SPA | N/A |
| `@fastify/cors` | `^11.0.1` | runtime (server) | CORS for Vite / Host | N/A |
| `@fastify/static` | `^8.1.1` | runtime (server) | Serve `client/dist` | N/A |
| `socket.io` | `^4.8.1` | runtime (server) | Realtime sync + recovery | Typed via shared `socketEvents` |
| `socket.io-client` | `^4.8.1` | runtime (client) | Browser socket | Matches server major |
| `nanoid` | `^5.1.5` | runtime (server) | Room PIN / IDs | `customAlphabet` only |
| `react` / `react-dom` | `^19.0.0` | runtime (client) | SPA UI | ESM |
| `zustand` | `^5.0.3` | runtime (client) | Session + last sync view | Named store API |
| `i18next` / `react-i18next` | `^26` / `^17` | runtime (client) | IT/EN strings | Locale JSON; no hardcoded UI copy |
| `qrcode.react` | `^4.2.0` | runtime (client) | Lobby QR (`QRCodeSVG`) | Named export |
| `lucide-react` | `^0.483.0` | runtime (client) | Icons | Per-icon named imports |
| `howler` | `^2.2.4` | runtime (client) | Ambient audio | Optional Host setting |
| `vite` + `@vitejs/plugin-react` | `^6` / `^4` | dev (client) | Bundler / HMR | — |
| `tailwindcss` + `@tailwindcss/vite` | `^4.0.14` | dev (client) | Utility CSS | Via Vite plugin |
| `typescript` | `^5.8.2` | dev (all) | Build / typecheck | — |
| `tsx` | `^4.19.3` | dev (shared, server) | Tests + `tsx watch` | — |
| `concurrently` | `^9.1.2` | dev (root) | Parallel `npm run dev` | Script only |
| `electron` / `electron-builder` | `^35` / `^25` | dev (`host/`) | Portable Host packaging | Outside npm workspaces |

**No safe uninstall candidates** at last Safety-First audit — every declared dependency is referenced by source or scripts.

---

## Deploy without Node on player devices

### 1) Docker

```bash
docker compose up --build
# Host machine may open http://127.0.0.1:3001 for admin;
# phones MUST use the LAN URL from the lobby QR / /api/host-info
```

```bash
NOCTURNA_PORT=8080 ADVERTISE_HOST=192.168.1.20 docker compose up --build
```

```bash
docker build -t nocturna .
docker run --rm -p 3001:3001 -e HOST=0.0.0.0 -e PORT=3001 nocturna
```

### 2) Portable Host (Windows / Linux AppImage / macOS)

```bash
npm install
npm run dist:host:prepare
npm run dist:host:linux   # AppImage
npm run dist:host:win     # portable .exe + zip
npm run dist:host:mac     # .zip (.app, unsigned when cross-built)
```

Host console: set **port** + optional **advertise override**, then Apply & restart. Only LAN URLs are listed for players; “Open on Host computer” may use loopback on the Host PC only.

### 3) npm (dev / Node on Host PC)

```bash
npm install
npm run build:shared
npm run dev
# SPA :5173 (proxied) · API :3001
```

```bash
npm run build
PORT=8080 node server/dist/index.js --advertise-host 192.168.1.20
```

---

## Architecture

```
nocturna/
├── packages/shared/   # types, night engine, lanAdvertise, socket contract
├── server/            # Fastify + Socket.io (PORT / ADVERTISE_* / --port)
├── client/            # React SPA + i18n (locales/it.json, locales/en.json)
├── host/              # Electron portable Host (port + advertise UI)
├── Dockerfile
├── docker-compose.yml
├── README.md
├── CHANGELOG.md
└── MANUAL.md
```

### RoomSettings (Host-configurable, server-authoritative)
- `moderatorMode`, `hapticPolicy`, `ambientAudioEnabled`, `allowLateJoin`
- `voteVisibility`, `tieBreakPolicy`
- `discussionDurationMs`, `tribunalDurationMs`, `defaultNightTurnDurationMs`
- `dawnDurationMs`, `ballotRevealDurationMs`, `assistedTimerMultiplier`
- `roomName` + full role deck / wake schedule editor

### LAN URL selection
1. `ADVERTISE_HOST` / `ADVERTISE_BASE` / Host UI override (if non-loopback)
2. Else first private IPv4 (10/8, 172.16–31, 192.168/16, then 169.254/16)
3. Else other non-internal IPv4
4. Else `advertiseBase: null` + error (no QR)

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Shared build + server watch + Vite |
| `npm run build` | Build shared, server, client |
| `npm start` | Run compiled server |
| `npm test` | Shared regression suite (engine, LAN, sanitize, wins, socket freeze) |
| `npm run typecheck` | tsc across workspaces |
| `npm run dist:docker:up` | Docker Compose up --build |
| `npm run dist:host:linux` / `:win` / `:mac` | Portable Host artifacts |

---

## AI Context & Developer Guidelines

For humans and coding agents working on this repo:

### Architecture invariants (do not break)
1. **Server-authoritative** — clients never compute win/night outcomes; they render `SanitizedGameState` / `MasterGameState` from `sync:state`.
2. **Anti-leak** — never send raw `GameState` to browsers. Use `viewForPlayer` / `toSanitizedGameState` / `toMasterGameState` only.
3. **No localhost in QR/join** — `lanAdvertise` + `/api/host-info`; fail loud if only loopback.
4. **Configurable port** — `PORT` / `--port` / Host UI must stay reflected in advertise URLs.
5. **i18n** — user-facing strings go through i18next (`it.json` / `en.json`); no new hardcoded UI copy.
6. **Data-driven roles** — behaviour lives in `RoleDefinition` + `WakeSchedule`, not role `switch` trees in app code.
7. **Haptics default** — individual role vibration is forbidden; only optional universal heartbeat.
8. **Socket contract** — event names in `packages/shared/src/socketEvents.ts` are frozen by `socketEvents.test.ts`; rename only with a coordinated PR.

### Library policy for AI
- Do **not** add dependencies without a clear need; prefer Node built-ins / existing stack.
- Do **not** remove packages without proving zero imports (including scripts).
- Prefer stable APIs; avoid deprecated Socket.io / React patterns.
- Keep `@nocturna/shared` as the single source of types + engine; do not duplicate LAN logic in Host without updating shared tests.
- Zero Regression: public signatures, defaults (`DEFAULT_ROOM_SETTINGS`, `DEFAULT_SERVER_PORT`), and ack shapes must stay identical unless the user explicitly requests a breaking change.

### Watchlist (do not delete casually)
- `injectTriggeredTurn` — ON_TRIGGER Master/effect hook (not yet wired from FSM).
- `listRoomIds` / `deleteRoom` — reserved room GC / admin.
- `LAST_SURVIVOR` win branch — currently dominated by `IMPOSTORS===0 → VILLAGE` priority (documented in tests).
- Host Electron `main.cjs` advertise helpers — parallel to shared `lanAdvertise` (consolidation is careful, not drive-by).

---

## Licence

See [LICENSE](./LICENSE).
