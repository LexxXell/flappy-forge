# AI Project Memory: Flappy Forge

> MAINTAINER NOTE: Update this file after every meaningful change in architecture, APIs, auth/roles, manifest schema, build pipeline, gameplay input/physics, or deployment flow. Keep the `Last updated` date current.

Last updated: 2026-04-23

## 1) Repository Purpose

Flappy Forge is a small monorepo for:
- building theme-based Flappy Bird style games (assets + JSON manifest),
- previewing and editing themes in a web panel,
- exporting built game bundles (zip) for publishing (including Yandex Games leaderboard support in runtime).

## 2) Monorepo Layout

- `packages/engine`: Phaser game runtime (menu, gameplay, leaderboard scenes).
- `packages/builder`: theme build tool (validates manifest, prepares assets, runs engine build).
- `packages/web`: Express API + React admin/editor UI.
- `themes/<id>`: source theme folders (`manifest.json`, `assets/`, optional `_meta.json`).
- `builds/<id>`: generated static game build output per theme.
- `deploy/nginx/flappy-forge.conf.example`: reverse proxy example with SSE-friendly settings.
- `docker-compose.yml` + `Dockerfile`: containerized deployment.

## 3) Root Scripts

From root `package.json`:
- `npm run web`: runs web server + client dev mode in workspace `packages/web`.
- `npm run web:server`: starts backend (`tsx packages/web/src/server.ts`).
- `npm run web:client`: starts Vite client for web panel.
- `npm run build:theme -- --theme=<id>`: build one theme.
- `npm run build:all`: build every theme in `/themes`.

## 4) Engine (`packages/engine`)

### 4.1 Bootstrap

- Entry: `src/main.ts`.
- Uses generated `src/config.ts` (written by builder from theme manifest).
- Scenes are added conditionally:
- `MenuScene` if `config.menu` exists.
- `GameScene` always.
- `LeaderboardScene` if `config.menu?.leaderboard` exists.
- Canvas/scale options are resolved via `src/ui.ts`.

### 4.2 Gameplay Scene

File: `src/scenes/GameScene.ts`.

Core behavior:
- Loads visual/audio assets from config.
- Creates player, pipes, coins, score HUD.
- Applies gravity/jump physics and progressive difficulty.
- Tracks score when player passes pipe pairs.
- Handles collisions, death, game-over overlay, retry/menu actions.
- Submits leaderboard score if `config.leaderboard` exists.
- Persists and updates best score via `src/state.ts`.

Input behavior:
- Pointer/touch jump: `pointerdown`.
- Keyboard jump (Space): handled as edge-trigger using `Phaser.Input.Keyboard.JustDown(...)`.
- This prevents repeated jumps while holding Space (OS key-repeat no longer causes multiple jumps).

### 4.3 Menu Scene

File: `src/scenes/MenuScene.ts`.

- Draws menu background + title overlay.
- Creates start/mute/leaderboard/custom buttons.
- Supports text or image buttons with hover styling.
- Persists mute/custom toggle states in localStorage-backed state.

### 4.4 Leaderboard Scene

File: `src/scenes/LeaderboardScene.ts`.

- Initializes Yandex SDK and requests leaderboard entries.
- Handles states: loading, unavailable, empty, success.
- Renders configurable panel, table columns, back button.

### 4.5 Audio

File: `src/audio.ts`.

- Preloads music + SFX clips from `audio` config.
- Supports binding events to one or multiple clips.
- Supports binding overrides (volume/rate/loop).
- Auto music start unless disabled or explicitly tied to event binding.

### 4.6 Runtime State

File: `src/state.ts`.

Persistent key: `flappy-forge:state:v1`.

Stored fields:
- `muted`
- `customButtons`
- `bestScore`

### 4.7 Yandex Integration

File: `src/yandex.ts`.

- Lazy-loads `https://yandex.ru/games/sdk/v2`.
- Initializes SDK and leaderboard handle.
- Exposes `submitScore`, `getLeaderboard`, availability state.
- Failures are non-fatal and logged as warnings.

## 5) Builder (`packages/builder`)

File: `src/index.ts`.

Build pipeline for a theme:
1. Read `themes/<id>/manifest.json`.
2. Validate manifest structure and semantic constraints (strict checks for physics, spawn, assets, audio, UI schema, etc.).
3. Ensure placeholder PNGs exist for missing core image assets.
4. Copy `themes/<id>/assets` into `packages/engine/public/assets`.
5. Generate `packages/engine/src/config.ts` from manifest JSON.
6. Run `vite build` in engine and emit to `builds/<id>`.

Important characteristics:
- Build mutates shared engine files (`engine/public/assets`, `engine/src/config.ts`) on every run.
- Audio bindings are validated against known event names and declared clips.
- Fails fast with readable path-specific validation errors.

## 6) Web Backend (`packages/web/src/server.ts`)

Stack:
- Express + multer + archiver + child_process spawn.
- JWT verification middleware for protected routes.
- SQLite-backed identity repository (`src/identityRepository.ts`) for login/user management.

Major public routes:
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/games` (built games list for anonymous users)
- `GET /preview/:theme/*` (serves built game static files)

Creator/admin routes:
- `GET /api/themes`
- `POST /api/themes`
- `DELETE /api/themes/:id` (admin)
- `GET/PUT /api/themes/:id/manifest`
- `GET/POST/DELETE /api/themes/:id/assets`
- `GET /api/themes/:id/asset-file`
- `GET /api/themes/:id/build` (SSE logs + status)
- `GET /api/themes/:id/download` (admin+) zip of build

Notes:
- Build SSE uses query `?token=` because `EventSource` cannot set auth headers.
- CORS in dev allows `http://localhost:5173`.
- Production fallback serves built client from `packages/web/client/dist` if present.
- Auth/user endpoints run in-process against local SQLite through `identityRepository.ts`.

## 7) Identity Repository (`packages/web/src/identityRepository.ts`)

Files:
- `src/identityRepository.ts`
- `src/auth.ts`

Role model:
- `owner` (env-based superuser, not stored in users DB)
- `admin`
- `creator`
- `user`

Behavior:
- Unknown username login returns token with role `user` (guest-like limited account).
- Known DB users must pass bcrypt password check.
- Owner password comes from env vars (`OWNER_PASSWORD`, default warns if unchanged).
- User DB is SQLite at `IDENTITY_DB_PATH` (default `packages/web/data/identity.sqlite`).
- On first launch with empty SQLite DB, service can import legacy users from `packages/web/data/users.json`.

## 8) Web Client (`packages/web/client`)

Stack:
- React + Vite + TypeScript.
- `AuthContext` stores JWT in `localStorage`.
- `I18nProvider` loads locales from `/locales`.

Main screens/components:
- `App.tsx`: root orchestration for editor mode vs gallery mode.
- `GamesGallery.tsx`: anonymous game list + iframe preview + login modal trigger.
- `Sidebar.tsx`: theme list/create/delete + language switch + user actions.
- `BasicSettings.tsx`: form editor for common manifest fields.
- `AssetsPanel.tsx`: slot-based asset upload/delete/preview.
- `JsonEditorPanel.tsx`: raw manifest JSON edit/format/apply.
- `PreviewPanel.tsx`: game iframe + build log + download action.
- `UsersPanel.tsx`: admin/owner user management modal.

## 9) Data and Generated Artifacts

Source of truth:
- theme source: `themes/<id>/manifest.json`, `themes/<id>/assets/**`
- users DB: `packages/web/data/identity.sqlite`

Generated:
- runtime config: `packages/engine/src/config.ts` (generated by builder)
- runtime assets copy: `packages/engine/public/assets/**` (copied by builder)
- final game bundle: `builds/<id>/**`

## 10) Deployment Notes

- `Dockerfile` installs deps, builds web client once, then starts web server by default.
- `docker-compose.yml` runs one service (`flappy-forge`) and mounts persistent host volumes for themes/builds/users DB.
- `docker-compose.yml` also supports image override via `FLAPPY_FORGE_IMAGE` (used by CI deploy).
- Nginx example includes `proxy_buffering off` for SSE build stream endpoint.

## 11) CI/CD (GitHub Actions)

File:
- `.github/workflows/deploy-master.yml`

Behavior on `push` to `master`:
1. Build Docker image (`flappy-forge:<git-sha>`).
2. Save image as artifact (`.tar.gz`).
3. Upload artifact to server over SSH.
4. Load image on server and recreate service with:
- `FLAPPY_FORGE_IMAGE=<git-sha> docker compose up -d --no-build --force-recreate`

Expected secrets:
- `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`
- optional: `DEPLOY_PORT`, `DEPLOY_PATH`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_ENV_FILE`

Server-side expectations:
- Docker + Docker Compose installed.
- Writable deploy directory (default `/opt/flappy-forge`).
- Persistent folders for mounted volumes are created automatically.

## 12) Maintenance Checklist (Keep This File Fresh)

Update this file when any of the following changes:
- route paths, auth policy, role permissions, or token behavior,
- manifest schema or builder validation rules,
- engine scene flow, input handling, scoring, physics, audio binding logic,
- theme storage paths, build artifact locations, deployment flow,
- client navigation/editing workflow or key components.

When updating:
- bump `Last updated` date,
- add a short note under the relevant section,
- keep behavior descriptions implementation-accurate (not aspirational).
