# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/).

## [Unreleased]

### Performance
- None (Safety-First pass: no invasive hot-path changes).

### Dependencies
- Inventory completed across root, `@nocturna/shared`, `@nocturna/server`, `@nocturna/client`, and `nocturna-host`.
- **No packages removed or added** — zero safe uninstall candidates.

### Refactoring
- Removed unused client helper `selectSanitized` (zero call sites).
- Removed unused Vite `@` path alias (no `from '@/…'` imports).
- Removed empty `client/src/pages/` and `client/src/assets/` scaffolds.
- Documented watchlist exports `listRoomIds` / `deleteRoom` (reserved GC/admin).
- Added JSDoc on LAN helpers and `isMasterGameState` type guard.

### Tests
- Expanded `@nocturna/shared` suite (node:test via tsx): sanitize anti-leak, win conditions, night scheduler frequencies / `injectTriggeredTurn` / DELAYED band, LAN private-IP matrix + URL override, socket event-name freeze.
- Existing engine + LAN tests retained at 100%.

### Documentation & AI Context
- README: Quickstart, Dependencies & Libraries Stack table, AI Context & Developer Guidelines, watchlist.
- Added this CHANGELOG.

### Breaking Changes
- **None.**

## [1.0.0] — 2026-09-16

### Added
- Initial Nocturna webapp: shared night engine, Fastify + Socket.io server, React SPA, Docker, portable Electron Host.
- LAN-only QR / join advertise, configurable port, IT/EN i18n, Host-configurable room settings (subsequent in-place release updates).
- Desktop scroll fix + Host/Master layouts (PR #4) included in tagged `v1.0.0` overwrite.
