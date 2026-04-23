# Docker Compose Runbook

## Start

```bash
docker compose up -d --build
```

Application will be available at `http://127.0.0.1:3000`.

## Stop

```bash
docker compose down
```

## CI/CD Deploy (GitHub Actions)

Workflow file: `.github/workflows/deploy-master.yml`.

Trigger:
- push to `master`
- manual run (`workflow_dispatch`)

Pipeline behavior:
1. Builds Docker image in GitHub Actions.
2. Packs image into artifact (`flappy-forge-<sha>.tar.gz`).
3. Uploads artifact to server over SSH.
4. Loads image on server and recreates container with:
   - `FLAPPY_FORGE_IMAGE=<sha-tag> docker compose up -d --no-build --force-recreate`

Required GitHub Secrets:
- `DEPLOY_HOST` — server host/IP
- `DEPLOY_USER` — SSH user
- `DEPLOY_SSH_KEY` — private SSH key (multiline)
- `DEPLOY_PORT` — optional, default `22`
- `DEPLOY_PATH` — optional, default `/opt/flappy-forge`
- `DEPLOY_KNOWN_HOSTS` — optional, recommended (`known_hosts` content)
- `DEPLOY_ENV_FILE` — optional, full `.env` content to upload on deploy

Notes:
- `docker-compose.yml` supports image override via `FLAPPY_FORGE_IMAGE`.
- If `.env` is absent on server and `.env.example` exists, it will be copied automatically.
- Persistent directories created automatically on server: `themes`, `builds`, `packages/web/data`.

## Data Persistence

Host paths are mounted into the container:

- `./themes` -> `/app/themes`
- `./builds` -> `/app/builds`
- `./packages/web/data` -> `/app/packages/web/data`

## Reverse Proxy (local nginx)

Use `deploy/nginx/flappy-forge.conf.example` as a base config.
It already includes unbuffered proxy settings for SSE build logs endpoint.
