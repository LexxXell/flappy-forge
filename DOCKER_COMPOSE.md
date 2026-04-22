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

## Data Persistence

Host paths are mounted into the container:

- `./themes` -> `/app/themes`
- `./builds` -> `/app/builds`
- `./packages/web/data` -> `/app/packages/web/data`

## Reverse Proxy (local nginx)

Use `deploy/nginx/flappy-forge.conf.example` as a base config.
It already includes unbuffered proxy settings for SSE build logs endpoint.
