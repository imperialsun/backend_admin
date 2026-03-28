# Deployment and operations

## Overview

The repo provides:

- a multi-stage `Dockerfile`,
- runtime Nginx configuration,
- an entrypoint that generates `runtime-config.js`,
- a production compose stack (`compose.yml`),
- a development compose stack (`compose.dev.yml`).

## Production Dockerfile

Stages:

1. `node:25.8.1-alpine3.23` build image,
2. `npm ci`,
3. `npm run build`,
4. `nginx:1.29.6-alpine3.23` runtime image,
5. copy of `dist/`, Nginx config, and entrypoint.

## Runtime Nginx

Exposed port:

- `8080`

Key files:

- `docker/nginx/admin.conf`
- `docker/nginx/entrypoint.sh`

Responsibilities:

- serve `dist/`,
- SPA fallback to `/index.html`,
- serve `runtime-config.js` as `no-store`,
- serve `/assets/` with immutable cache,
- apply security headers.

## Production compose

Service:

- `admin`: Nginx-backed static app on port `8080`.

The backend URL is set explicitly in `compose.yml` to `https://trapi.demeter-sante.fr/api/v1`.

Environment:

- `BACKEND_BASE_URL=https://trapi.demeter-sante.fr/api/v1`

Start:

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```

## Development compose

Service:

- `admin`: Vite dev server on port `4173`.

The local runtime config fallback in [`public/runtime-config.js`](../../public/runtime-config.js) already targets `http://localhost:8080/api/v1` on localhost, so no runtime variable is needed for the dev stack.

Start:

```bash
docker compose -f compose.dev.yml up -d
```

## Runtime backend injection

The entrypoint reads:

- `BACKEND_BASE_URL`

Then writes:

```js
window.__APP_RUNTIME_CONFIG__ = {
  backendBaseUrl: "<value>",
}
```

Container default value:

- `http://localhost:8080/api/v1`

## Useful commands

Production-like local launch:

```bash
docker compose up --build -d
```

## Minimum smoke checks

```bash
curl -I http://localhost:8080/index.html
curl -I http://localhost:8080/runtime-config.js
curl -I http://localhost:8080/users
curl http://localhost:8080/runtime-config.js
```

Expected:

- `index.html` returns `200`,
- `/users` returns `200` because of SPA fallback,
- `runtime-config.js` contains the correct backend URL,
- security headers are present.

## Update and rollback

Basic update:

1. pull the new code,
2. rebuild the image,
3. restart the container.

Basic rollback:

1. return to a known-good commit,
2. rebuild the previous image,
3. restart the container with the same `BACKEND_BASE_URL`.

## Links

- Security: [`security-privacy.md`](security-privacy.md)
- Troubleshooting: [`troubleshooting.md`](troubleshooting.md)
