# Deployment and operations

## Overview

The repo provides:

- a multi-stage `Dockerfile`,
- runtime Nginx configuration,
- an entrypoint that generates `runtime-config.js`.

There is no `docker-compose.yml` in this repo. The standard deployment flow is `docker build` followed by `docker run`.

## Production Dockerfile

Stages:

1. `node:25-alpine` build image,
2. `npm ci`,
3. `npm run build`,
4. `nginx:1.29-alpine` runtime image,
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

Build image:

```bash
docker build -t demeter-admin-panel .
```

Run locally:

```bash
docker run --rm -p 4173:8080 \
  -e BACKEND_BASE_URL=http://localhost:8080/api/v1 \
  demeter-admin-panel
```

## Minimum smoke checks

```bash
curl -I http://localhost:4173/index.html
curl -I http://localhost:4173/runtime-config.js
curl -I http://localhost:4173/users
curl http://localhost:4173/runtime-config.js
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
