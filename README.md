# Nocturna

**Chi dorme non sopravvive.**

Mobile-first social deduction webapp with a data-driven night narrator, anti-leaking sensory protocol, and dual Host modes (`AUTOMATED` / `ASSISTED`).

Original folklore-inspired naming (Villaggio / Ombre / Neutrali). No trademarked commercial titles or art.

---

## Core UX requirement: extreme mobile responsiveness

**Hard constraint (not polish):** the main game SPA and the QR-accessible join portal must be playable from any device — phones of all sizes (~360–430px and up), tablets, and small laptops.

Implemented as:

- Mobile-first layouts with **fluid typography/spacing** (`clamp`), **≥44px touch targets**, **safe-area insets** (notch / home indicator), and **no horizontal scroll** on common phone widths
- Fast QR join path (`?pin=` deep link) tuned for constrained mobile browsers
- Night stealth, role reveal (press-and-hold), tribunal voting, and Master dashboard all usable on narrow viewports (Master stacks/scrolls on phone/tablet)
- Verified against lobby, night, and day/tribunal flows at phone widths

---

## Deploy without Node on player devices

Players only need a browser. The **Host** can run Nocturna in either of these production ways:

### 1) Docker (recommended for LAN servers / always-on hosts)

```bash
docker compose up --build
# → http://localhost:3001  (phones: http://<host-lan-ip>:3001)
```

Or without Compose:

```bash
docker build -t nocturna .
docker run --rm -p 3001:3001 nocturna
```

Optional: `NOCTURNA_PORT=8080 docker compose up --build` maps host port 8080 → container 3001.

Health: `GET /api/health` · LAN helper: `GET /api/host-info`

### 2) Portable Host app (Windows / Linux AppImage / macOS)

A thin **Electron** Host console bundles the Fastify + Socket.io server and the static SPA. The Host does **not** need a system Node install; players still join via phone browsers on the LAN.

```bash
# One-time tooling (from repo root)
npm install
npm run dist:host:prepare   # build SPA/server + embed + install Electron

# Build distributables for your platform / targets:
npm run dist:host:linux     # → host/dist/*.AppImage
npm run dist:host:win       # → host/dist/*windows-portable.exe + .zip
npm run dist:host:mac       # → host/dist/*.zip (+ unpacked .app dir)
# or everything electron-builder can produce on this machine:
npm run dist:host
```

| Platform | Artifact | How to run |
|----------|----------|------------|
| Windows | `Nocturna-*-windows-portable.exe` (also `.zip`) | Double-click portable exe — no installer |
| Linux | `Nocturna-*-linux-*.AppImage` | `chmod +x` then run; or open from file manager |
| macOS | `Nocturna-*-mac-*.zip` (contains `.app`) | Unzip and launch Nocturna.app |

Notes:

- Cross-building macOS from Linux/Windows usually requires a Mac (Apple code-signing / `dir`+`zip` targets are configured; unsigned builds use `"identity": null`).
- Windows portable can be built on Linux with electron-builder when Wine is available; otherwise build on Windows.
- The Host window shows local + LAN URLs; tap **Apri sul computer Host** to open the SPA. Phones use the LAN URL / QR from the lobby.

Dev-run the Host UI after prepare:

```bash
npm run prepare:host
npm --prefix host start
```

---

## Architecture

```
nocturna/
├── packages/shared/     # Types, night scheduler, resolution, sanitisation, socket contract
├── server/              # Fastify + Socket.io (authoritative FSM, in-memory rooms)
├── client/              # React + Vite + Tailwind + Zustand SPA
├── host/                # Electron portable Host (extraResources embed/)
├── scripts/             # prepare-host-embed.mjs
├── Dockerfile           # Production image
├── docker-compose.yml
├── README.md
└── MANUAL.md            # Host & player guide (IT / EN)
```

### Core invariants

1. **Server authority** — timers, eliminations, ties, and win checks never run in the browser. Clients render `phaseEndsAt` only.
2. **Zero data leaks** — each socket receives `SanitizedGameState` or (Master only) `MasterGameState`. Never a filterable global dump.
3. **Data-driven roles** — behaviour comes from `RoleDefinition` + `WakeSchedule`, not hardcoded role branches.
4. **Atomic dawn resolution** — night effects queue as `PendingAction[]` and flush in band order: Protection → Investigation → Attack → Delayed.
5. **Sensory anti-leak** — default haptic policy is `NONE`. When enabled, only a **universal heartbeat** vibrates every device together. Night UI is OLED `#000000` with matched luminance for awake/asleep screens.
6. **Extreme mobile-first UI** — every interactive control is touch-friendly on small phones.
7. **Dual packaging** — Docker image and portable Host binaries for offline LAN parties.

---

## Stack

| Layer | Tech |
|-------|------|
| Realtime | Node.js, Fastify, Socket.io (`connectionStateRecovery: 2 min`) |
| Shared | TypeScript package `@nocturna/shared` |
| Client | React 19, Vite 6, Tailwind 4, Zustand, Howler, Lucide, qrcode.react |
| Portable Host | Electron + electron-builder (Win portable / Linux AppImage / macOS zip) |
| Persistenza | In-memory `Map<RoomId, GameState>`; Host presets in `localStorage` / JSON |

---

## Quick start (development)

**Requirements:** Node.js ≥ 20, npm 10+

```bash
npm install
npm run build:shared
npm run dev
```

- SPA (Vite): http://localhost:5173  
- API / Socket.io: http://localhost:3001  
- Health: http://localhost:3001/api/health  

On a phone (same LAN / tunnel), open the Host QR or `https://<host>/?pin=NNNNNN` for the join portal.

Node production (SPA served by Fastify, no Docker):

```bash
npm run build
npm start
# → http://localhost:3001
```

Optional: set `VITE_SOCKET_URL` if the Vite client talks to a remote socket server. Docker / portable Host set `CLIENT_DIST` automatically.

---

## Key modules

| Path | Responsibility |
|------|----------------|
| `packages/shared/src/types.ts` | Domain models |
| `packages/shared/src/nightScheduler.ts` | `buildNightTurnQueue` |
| `packages/shared/src/nightResolution.ts` | `resolveNightActions` |
| `packages/shared/src/sanitize.ts` | Per-socket view builders |
| `packages/shared/src/socketEvents.ts` | Typed Socket.io contract |
| `server/src/gameFsm.ts` | Phase machine + timers |
| `server/src/index.ts` | `startServer()` — CLI / Docker / Host embed |
| `host/main.cjs` | Portable Host process (ELECTRON_RUN_AS_NODE server) |
| `client/src/components/NightScreen.tsx` | Stealth night UI |
| `client/src/components/MasterDashboard.tsx` | Assisted God-View |

---

## Extending roles

1. Clone a `RoleDefinition` in the lobby editor or import a JSON preset.
2. Set `wakeSchedule.frequency`, `priority`, `actionType`, `resolutionBand`, and `timeMaskingDuration`.
3. Flags: `grantsProtection`, `isLethal`, `inspectReveals`.
4. Export JSON from the Host panel — also under `localStorage` key `nocturna.presets.v1`.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Shared build + server watch + Vite |
| `npm run build` | Build shared, server, client |
| `npm start` | Run compiled server (serves `client/dist`) |
| `npm test` | Shared engine unit tests |
| `npm run typecheck` | Typecheck all workspaces |
| `npm run dist:docker` / `dist:docker:up` | Build / run Docker image |
| `npm run prepare:host` | Stage `host/embed` for Electron |
| `npm run dist:host:linux` / `:win` / `:mac` | Portable Host artifacts |

---

## Licence

See [LICENSE](./LICENSE).
