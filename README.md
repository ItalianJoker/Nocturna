# Nocturna

**Chi dorme non sopravvive.** / **Who sleeps does not survive.**

Mobile-first social deduction webapp with a data-driven night narrator, anti-leaking sensory protocol, and dual Host modes (`AUTOMATED` / `ASSISTED`).

Original folklore-inspired naming (Villaggio / Ombre / Neutrali). No trademarked commercial titles or art.

UI languages: **Italian + English** (i18next; preference persisted).

---

## Hard constraints

### Extreme mobile responsiveness
Playable on phones (~360–430px+), tablets, small laptops: fluid type, ≥44px targets, safe-area insets, no horizontal scroll. QR join must work on constrained mobile browsers.

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

Health: `GET /api/health` · Advertise: `GET /api/host-info`

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
└── MANUAL.md
```

### RoomSettings (Host-configurable, server-authoritative)
Previously magic / partial UI — now editable in lobby:
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
| `npm test` | Shared engine + LAN advertise tests |
| `npm run dist:docker:up` | Docker Compose up --build |
| `npm run dist:host:linux` / `:win` / `:mac` | Portable Host artifacts |

---

## Licence

See [LICENSE](./LICENSE).
