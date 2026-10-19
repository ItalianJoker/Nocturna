# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/).

## [Unreleased]

### Added
- Lobby **Partita Personalizzata**: Host manual deck counts, composition vs player-count overview, add missing catalog roles, create custom `RoleDefinition`s (IT/EN).
- Shared `sanitizeRoleDeck` / `sanitizeRoleDefinition`: enum/id/length validation accepting custom role ids (not catalog-only); used by `lobby:updateDeck` and `lobby:importPreset`.
- Lobby **Regolamento** (Host + players): phases, night stealth, tribunal, modes — IT/EN, original Nocturna copy.
- Lobby **Roles in this game** guide: name, faction, editable description before deal (IT/EN).
- **Partite consigliate**: one-tap decks for **every seat count 6–24** (~1 Shadow hunter per 5 seats).
- Expanded original night-world role catalog (Custode, Lunavista, Eco, Legame, Caccianotte, Artiglio, Simulacro, Giudice della Notte, Mannaia, Crepuscolo, Soglia, Corvo, Fiamma Fredda, …).
- Tap-to-open FieldHelp (mobile-friendly) for Frequency, Action, and opaque Host settings.

### Changed
- Role schedule selects no longer show raw enums (`EVERY_NIGHT`, `SINGLE_TARGET`, …) — translated labels + help in IT/EN.
- Friendly “call order” wording (no “priority” jargon in UI).
- Master night stepper shows localized action labels; role reveal prefers Host-edited deck text.

### Fixed
- Windows portable Host: embed `@nocturna/shared` is now a real copy (not a Unix symlink), so the Electron child no longer dies with `MODULE_NOT_FOUND` and a opaque “Health check timeout”.
- Host: bind always `0.0.0.0`; advertise override is QR/join only; health polls `127.0.0.1`; Refresh/lang no longer restart the server; clearer spawn/stderr/port-in-use errors.

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
